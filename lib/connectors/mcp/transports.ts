import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { basename } from "node:path";
import type { IncomingMessage } from "node:http";
import { MAX_RESPONSE_BYTES, NetError, safeFetch } from "./net";
import { readSse, SseParser } from "./sse";

export type JsonRpcMessage = { jsonrpc: "2.0"; id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { code?: number; message?: string } };

export type McpTransportKind = "streamable-http" | "sse" | "stdio";

export class McpError extends Error {}

/** 401 from the MCP server. Carries the WWW-Authenticate header for OAuth discovery. */
export class McpAuthRequired extends McpError {
  constructor(public readonly wwwAuthenticate: string) {
    super("This MCP server needs you to sign in (OAuth).");
  }
}

/** 403 insufficient_scope: signed in, but the grant does not cover the call. */
export class McpGrantRequired extends McpError {
  constructor(public readonly wwwAuthenticate: string) {
    super("This MCP server needs an additional access grant.");
  }
}

export interface McpTransport {
  readonly kind: McpTransportKind;
  request(message: JsonRpcMessage, timeoutMs: number): Promise<JsonRpcMessage>;
  notify(message: JsonRpcMessage): Promise<void>;
  setProtocolVersion(version: string): void;
  close(): Promise<void>;
}

export type AuthProvider = () => Promise<string | undefined>;

function authFailure(status: number, headers: Record<string, string>) {
  const www = headers["www-authenticate"] || "";
  if (status === 401) return new McpAuthRequired(www);
  if (status === 403 && /insufficient_scope/i.test(www)) return new McpGrantRequired(www);
  return null;
}

/** Streamable HTTP (MCP 2025-03-26 / 2025-06-18): POST JSON-RPC, reply is JSON or an SSE stream. */
export class StreamableHttpTransport implements McpTransport {
  readonly kind = "streamable-http" as const;
  private sessionId: string | null = null;
  private protocolVersion: string | null = null;

  constructor(
    private readonly url: string,
    private readonly auth?: AuthProvider,
  ) {}

  setProtocolVersion(version: string) {
    this.protocolVersion = version;
  }

  private async headers(): Promise<Record<string, string>> {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (this.protocolVersion) headers["MCP-Protocol-Version"] = this.protocolVersion;
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    const authorization = this.auth ? await this.auth() : undefined;
    if (authorization) headers.Authorization = authorization;
    return headers;
  }

  /** Raw POST. Status is returned so the client can decide on the legacy SSE fallback. */
  async post(message: JsonRpcMessage, timeoutMs: number) {
    const res = await safeFetch(this.url, { method: "POST", headers: await this.headers(), body: JSON.stringify(message), timeoutMs });
    const session = res.headers["mcp-session-id"];
    if (session) this.sessionId = session;
    return res;
  }

  async request(message: JsonRpcMessage, timeoutMs: number): Promise<JsonRpcMessage> {
    const res = await this.post(message, timeoutMs);
    const failure = authFailure(res.status, res.headers);
    if (failure) {
      res.stream.resume();
      throw failure;
    }
    if (res.status < 200 || res.status >= 300) {
      res.stream.resume();
      throw new StreamableHttpStatus(res.status);
    }
    const type = res.headers["content-type"] || "";
    if (type.includes("text/event-stream")) {
      let reply: JsonRpcMessage | undefined;
      await readSse(res.stream, (event) => {
        try {
          const parsed = JSON.parse(event.data) as JsonRpcMessage | JsonRpcMessage[];
          const found = [parsed].flat().find((item) => item && item.id === message.id && (item.result !== undefined || item.error));
          if (found) {
            reply = found;
            return true;
          }
        } catch {
          /* keep-alive or non-JSON event */
        }
      });
      if (!reply) throw new McpError("MCP server closed the stream without a response.");
      return reply;
    }
    const body = await res.json<JsonRpcMessage | JsonRpcMessage[]>();
    const reply = [body].flat().find((item) => item && item.id === message.id);
    if (!reply) throw new McpError("MCP server returned no response for the request.");
    return reply;
  }

  async notify(message: JsonRpcMessage) {
    try {
      const res = await this.post(message, 5_000);
      res.stream.resume();
    } catch {
      /* notifications are best-effort */
    }
  }

  async close() {
    if (!this.sessionId) return;
    try {
      const res = await safeFetch(this.url, { method: "DELETE", headers: await this.headers(), timeoutMs: 3_000 });
      res.stream.resume();
    } catch {
      /* best effort */
    }
  }
}

export class StreamableHttpStatus extends McpError {
  constructor(public readonly status: number) {
    super(`MCP server answered HTTP ${status}.`);
  }
}

/**
 * Legacy HTTP+SSE transport (MCP 2024-11-05): GET opens an event stream whose first `endpoint`
 * event names the POST URL; responses arrive on the stream. The endpoint must be same-origin.
 */
export class LegacySseTransport implements McpTransport {
  readonly kind = "sse" as const;
  private endpoint: string | null = null;
  private stream: IncomingMessage | null = null;
  private pending = new Map<string, (message: JsonRpcMessage) => void>();
  private closed = false;

  constructor(
    private readonly url: string,
    private readonly auth?: AuthProvider,
  ) {}

  setProtocolVersion() {
    /* legacy transport has no version header */
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const authorization = this.auth ? await this.auth() : undefined;
    return authorization ? { Authorization: authorization } : {};
  }

  async open(timeoutMs: number) {
    if (this.endpoint) return;
    const res = await safeFetch(this.url, { method: "GET", headers: { Accept: "text/event-stream", ...(await this.authHeaders()) }, timeoutMs: 0 });
    const failure = authFailure(res.status, res.headers);
    if (failure) {
      res.stream.resume();
      throw failure;
    }
    if (res.status !== 200 || !(res.headers["content-type"] || "").includes("text/event-stream")) {
      res.stream.resume();
      throw new McpError(`Legacy SSE endpoint answered HTTP ${res.status}.`);
    }
    this.stream = res.stream;
    const parser = new SseParser();
    let size = 0;
    const origin = new URL(this.url).origin;
    const endpoint = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new McpError("Legacy SSE server sent no endpoint.")), timeoutMs);
      res.stream.setEncoding("utf8");
      res.stream.on("data", (chunk: string) => {
        size += Buffer.byteLength(chunk);
        if (size > MAX_RESPONSE_BYTES * 10) {
          res.stream.destroy();
          return;
        }
        for (const event of parser.push(chunk)) {
          if (event.event === "endpoint") {
            clearTimeout(timer);
            const target = new URL(event.data.trim(), this.url);
            if (target.origin !== origin) return reject(new McpError("Legacy SSE endpoint must be on the same origin."));
            resolve(target.toString());
            continue;
          }
          try {
            const message = JSON.parse(event.data) as JsonRpcMessage;
            const key = String(message.id);
            const waiter = this.pending.get(key);
            if (waiter) {
              this.pending.delete(key);
              waiter(message);
            }
          } catch {
            /* ignore */
          }
        }
      });
      res.stream.on("error", () => undefined);
      res.stream.on("close", () => {
        clearTimeout(timer);
        this.closed = true;
        reject(new McpError("Legacy SSE stream closed."));
      });
    });
    this.endpoint = await endpoint;
  }

  async request(message: JsonRpcMessage, timeoutMs: number): Promise<JsonRpcMessage> {
    await this.open(timeoutMs);
    if (this.closed) throw new McpError("Legacy SSE stream closed.");
    const reply = new Promise<JsonRpcMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(message.id));
        reject(new McpError("MCP request timed out."));
      }, timeoutMs);
      this.pending.set(String(message.id), (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
    const res = await safeFetch(this.endpoint!, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
      body: JSON.stringify(message),
      timeoutMs,
    });
    res.stream.resume();
    const failure = authFailure(res.status, res.headers);
    if (failure) {
      this.pending.delete(String(message.id));
      throw failure;
    }
    if (res.status < 200 || res.status >= 300) {
      this.pending.delete(String(message.id));
      throw new McpError(`MCP server answered HTTP ${res.status}.`);
    }
    return reply;
  }

  async notify(message: JsonRpcMessage) {
    if (!this.endpoint) return;
    try {
      const res = await safeFetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await this.authHeaders()) },
        body: JSON.stringify(message),
        timeoutMs: 5_000,
      });
      res.stream.resume();
    } catch {
      /* best effort */
    }
  }

  async close() {
    this.closed = true;
    this.stream?.destroy();
    for (const [, waiter] of this.pending) waiter({ jsonrpc: "2.0", error: { message: "closed" } });
    this.pending.clear();
  }
}

/** stdio is for locally configured servers only: admin-only, allowlisted command, never on serverless. */
export function stdioPolicy(): { allowed: boolean; reason: string; allowlist: string[] } {
  const allowlist = (process.env.EVOPULSE_MCP_STDIO_ALLOWLIST || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY || process.env.K_SERVICE);
  if (serverless) return { allowed: false, reason: "stdio MCP servers are disabled on serverless deploys.", allowlist };
  if (process.env.EVOPULSE_MCP_STDIO !== "true") return { allowed: false, reason: "stdio MCP servers are off. Set EVOPULSE_MCP_STDIO=true.", allowlist };
  if (!allowlist.length) return { allowed: false, reason: "No stdio commands are allowlisted (EVOPULSE_MCP_STDIO_ALLOWLIST).", allowlist };
  return { allowed: true, reason: "", allowlist };
}

export function assertStdioCommand(command: string) {
  const policy = stdioPolicy();
  if (!policy.allowed) throw new McpError(policy.reason);
  const clean = command.trim();
  if (!clean || /[\s;&|`$<>]/.test(clean)) throw new McpError("stdio command must be a single executable name or path.");
  if (!policy.allowlist.includes(clean) && !policy.allowlist.includes(basename(clean))) {
    throw new McpError(`"${basename(clean)}" is not in EVOPULSE_MCP_STDIO_ALLOWLIST.`);
  }
}

export function parseArgs(raw: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw))) out.push(match[1] ?? match[2] ?? match[3]);
  return out.slice(0, 32);
}

/** Newline-delimited JSON-RPC over a child process (no shell, minimal env). */
export class StdioTransport implements McpTransport {
  readonly kind = "stdio" as const;
  private child: ChildProcessWithoutNullStreams | null = null;
  private pending = new Map<string, (message: JsonRpcMessage) => void>();
  private buffer = "";

  constructor(
    private readonly command: string,
    private readonly args: string[],
    private readonly env: Record<string, string> = {},
  ) {}

  setProtocolVersion() {
    /* not used by stdio */
  }

  private start() {
    if (this.child) return this.child;
    assertStdioCommand(this.command);
    const child: ChildProcessWithoutNullStreams = spawn(this.command, this.args, {
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: process.env.PATH || "", HOME: process.env.HOME || "", ...this.env } as unknown as NodeJS.ProcessEnv,
    });
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      if (this.buffer.length > MAX_RESPONSE_BYTES) {
        child.kill();
        return;
      }
      let index: number;
      while ((index = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, index).trim();
        this.buffer = this.buffer.slice(index + 1);
        if (!line) continue;
        try {
          const message = JSON.parse(line) as JsonRpcMessage;
          const waiter = this.pending.get(String(message.id));
          if (waiter && (message.result !== undefined || message.error)) {
            this.pending.delete(String(message.id));
            waiter(message);
          }
        } catch {
          /* servers may log non-JSON; ignore */
        }
      }
    });
    child.stderr.resume();
    child.on("exit", () => {
      for (const [, waiter] of this.pending) waiter({ jsonrpc: "2.0", error: { message: "stdio server exited" } });
      this.pending.clear();
      this.child = null;
    });
    child.on("error", () => undefined);
    this.child = child;
    return child;
  }

  request(message: JsonRpcMessage, timeoutMs: number): Promise<JsonRpcMessage> {
    const child = this.start();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(String(message.id));
        reject(new McpError("MCP request timed out."));
      }, timeoutMs);
      this.pending.set(String(message.id), (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(`${JSON.stringify(message)}\n`);
    });
  }

  async notify(message: JsonRpcMessage) {
    this.child?.stdin.write(`${JSON.stringify(message)}\n`);
  }

  async close() {
    this.child?.kill();
    this.child = null;
  }
}

export { NetError };
