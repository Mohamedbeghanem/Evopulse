import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Minimal MCP client over Streamable HTTP (JSON-RPC 2.0; JSON or SSE responses).
 * OpenManus proxies MCP tools through the official SDK over SSE/stdio. EvoPulse deliberately
 * supports HTTP only: no stdio, so registering a server can never spawn a local process.
 */
export const MCP_PROTOCOL_VERSION = "2025-03-26";
const MAX_BYTES = 1_000_000;

export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; title?: string };
};

export type McpCallResult = {
  content?: { type: string; text?: string; [key: string]: unknown }[];
  structuredContent?: unknown;
  isError?: boolean;
};

export class McpError extends Error {}

function privateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::") return true;
    if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? privateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

/** Block loopback / private / link-local targets unless EVOPULSE_MCP_ALLOW_PRIVATE=true (local dev, tests). */
export async function assertPublicUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new McpError("MCP server URL must be http(s).");
  if (process.env.EVOPULSE_MCP_ALLOW_PRIVATE === "true") return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new McpError("Private network MCP servers are disabled on this deploy.");
  }
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((item) => item.address);
  if (addresses.some(privateAddress)) throw new McpError("Private network MCP servers are disabled on this deploy.");
}

function parseSse(text: string): unknown[] {
  const out: unknown[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      out.push(JSON.parse(data));
    } catch {
      /* ignore keep-alives */
    }
  }
  return out;
}

export class McpHttpClient {
  private sessionId: string | null = null;
  private nextId = 1;
  private initialized = false;

  constructor(
    private readonly url: string,
    private readonly authorization?: string,
    private readonly timeoutMs = 10_000,
  ) {}

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (this.initialized) headers["MCP-Protocol-Version"] = MCP_PROTOCOL_VERSION;
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    if (this.authorization) headers.Authorization = this.authorization;
    return headers;
  }

  private async post(body: Record<string, unknown>): Promise<Response> {
    await assertPublicUrl(this.url);
    const res = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const session = res.headers.get("mcp-session-id");
    if (session) this.sessionId = session;
    return res;
  }

  async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const requestId = this.nextId++;
    const res = await this.post({ jsonrpc: "2.0", id: requestId, method, params });
    if (!res.ok) throw new McpError(`MCP server answered HTTP ${res.status}.`);
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new McpError("MCP response too large.");
    const type = res.headers.get("content-type") || "";
    const messages = type.includes("text/event-stream") ? parseSse(text) : [JSON.parse(text || "null") as unknown].flat();
    const reply = messages.find(
      (msg): msg is { id: number; result?: T; error?: { message?: string } } =>
        Boolean(msg) && typeof msg === "object" && (msg as { id?: unknown }).id === requestId,
    );
    if (!reply) throw new McpError("MCP server returned no response for the request.");
    if (reply.error) throw new McpError(`MCP error: ${String(reply.error.message || "unknown")}`);
    return reply.result as T;
  }

  async initialize() {
    const result = await this.request<{ serverInfo?: { name?: string; version?: string }; protocolVersion?: string }>("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "evopulse", version: "0.1.0" },
    });
    this.initialized = true;
    try {
      await this.post({ jsonrpc: "2.0", method: "notifications/initialized" });
    } catch {
      /* notification delivery is best-effort */
    }
    return result;
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    if (!this.initialized) await this.initialize();
    const tools: McpToolDescriptor[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 10; page += 1) {
      const result = await this.request<{ tools?: McpToolDescriptor[]; nextCursor?: string }>("tools/list", cursor ? { cursor } : {});
      tools.push(...(result.tools || []));
      cursor = result.nextCursor;
      if (!cursor) break;
    }
    return tools.slice(0, 200);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    if (!this.initialized) await this.initialize();
    return this.request<McpCallResult>("tools/call", { name, arguments: args });
  }
}

export function mcpResultText(result: McpCallResult, max = 4000): string {
  const text = (result.content || [])
    .map((item) => (item.type === "text" && typeof item.text === "string" ? item.text : `[${item.type} content]`))
    .join("\n");
  const structured = !text && result.structuredContent !== undefined ? JSON.stringify(result.structuredContent) : "";
  const out = text || structured || "No output returned.";
  return out.length > max ? `${out.slice(0, max)}…` : out;
}
