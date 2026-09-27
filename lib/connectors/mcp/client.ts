import { assertPublicUrl } from "./net";
import {
  LegacySseTransport,
  McpError,
  StdioTransport,
  StreamableHttpStatus,
  StreamableHttpTransport,
  type AuthProvider,
  type JsonRpcMessage,
  type McpTransport,
  type McpTransportKind,
} from "./transports";

/**
 * MCP client: Streamable HTTP (current spec) with automatic fallback to the legacy HTTP+SSE
 * transport, plus stdio for allowlisted local servers. Supports tools (paginated), resources and
 * prompts listing. Pattern follows OpenManus' MCPClients (one session per server, tools proxied),
 * implemented natively so every hop keeps SSRF / rebinding protection.
 */
export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_PAGES = 10;

export type McpToolDescriptor = {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean; title?: string };
};

export type McpCallResult = {
  content?: { type: string; text?: string; [key: string]: unknown }[];
  structuredContent?: unknown;
  isError?: boolean;
};

export type McpResourceDescriptor = { uri: string; name?: string; description?: string; mimeType?: string };
export type McpPromptDescriptor = { name: string; description?: string; arguments?: { name: string; required?: boolean }[] };

export type McpTransportPreference = "auto" | McpTransportKind;

export type McpClientOptions = {
  transport?: McpTransportPreference;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  auth?: AuthProvider;
  timeoutMs?: number;
};

export type McpServerInfo = {
  serverInfo?: { name?: string; version?: string };
  protocolVersion?: string;
  capabilities?: { tools?: unknown; resources?: unknown; prompts?: unknown };
  instructions?: string;
};

export { McpError };

export class McpClient {
  private transport: McpTransport | null = null;
  private nextId = 1;
  info: McpServerInfo | null = null;

  constructor(private readonly options: McpClientOptions) {}

  get transportKind(): McpTransportKind | null {
    return this.transport?.kind || null;
  }

  private timeout() {
    return this.options.timeoutMs ?? 10_000;
  }

  private initializeMessage(): JsonRpcMessage {
    return {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "evopulse", title: "EvoPulse", version: "0.2.0" } },
    };
  }

  private async finishInitialize(transport: McpTransport, reply: JsonRpcMessage) {
    if (reply.error) throw new McpError(`MCP error: ${String(reply.error.message || "initialize failed")}`);
    const info = (reply.result || {}) as McpServerInfo;
    const version = info.protocolVersion && SUPPORTED_PROTOCOL_VERSIONS.includes(info.protocolVersion) ? info.protocolVersion : MCP_PROTOCOL_VERSION;
    transport.setProtocolVersion(version);
    this.transport = transport;
    this.info = { ...info, protocolVersion: version };
    await transport.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
    return this.info;
  }

  async connect(): Promise<McpServerInfo> {
    if (this.info && this.transport) return this.info;
    const preference = this.options.transport || "auto";
    if (preference === "stdio") {
      const transport = new StdioTransport(this.options.command || "", this.options.args || [], this.options.env);
      return this.finishInitialize(transport, await transport.request(this.initializeMessage(), this.timeout()));
    }
    const url = this.options.url || "";
    await assertPublicUrl(url);
    if (preference !== "sse") {
      const http = new StreamableHttpTransport(url, this.options.auth);
      try {
        return await this.finishInitialize(http, await http.request(this.initializeMessage(), this.timeout()));
      } catch (error) {
        // Spec backwards-compat: 400/404/405 on POST initialize → try the 2024-11-05 HTTP+SSE transport.
        const fallback = error instanceof StreamableHttpStatus && [400, 404, 405].includes(error.status);
        if (!fallback || preference === "streamable-http") throw error;
      }
    }
    const sse = new LegacySseTransport(url, this.options.auth);
    try {
      return await this.finishInitialize(sse, await sse.request(this.initializeMessage(), this.timeout()));
    } catch (error) {
      await sse.close();
      throw error;
    }
  }

  async request<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    await this.connect();
    const reply = await this.transport!.request({ jsonrpc: "2.0", id: this.nextId++, method, params }, this.timeout());
    if (reply.error) throw new McpError(`MCP error: ${String(reply.error.message || "unknown")}`);
    return reply.result as T;
  }

  private async paginate<T>(method: string, key: string, limit: number): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await this.request<Record<string, unknown>>(method, cursor ? { cursor } : {});
      const list = Array.isArray(result?.[key]) ? (result[key] as T[]) : [];
      items.push(...list);
      cursor = typeof result?.nextCursor === "string" && result.nextCursor ? result.nextCursor : undefined;
      if (!cursor || items.length >= limit) break;
    }
    return items.slice(0, limit);
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    return this.paginate<McpToolDescriptor>("tools/list", "tools", 200);
  }

  /** Only when the server advertises the capability ("where cheap"). */
  async listResources(): Promise<McpResourceDescriptor[]> {
    const info = await this.connect();
    if (!info.capabilities?.resources) return [];
    return this.paginate<McpResourceDescriptor>("resources/list", "resources", 100).catch(() => []);
  }

  async listPrompts(): Promise<McpPromptDescriptor[]> {
    const info = await this.connect();
    if (!info.capabilities?.prompts) return [];
    return this.paginate<McpPromptDescriptor>("prompts/list", "prompts", 100).catch(() => []);
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    return this.request<McpCallResult>("tools/call", { name, arguments: args });
  }

  async close() {
    await this.transport?.close();
    this.transport = null;
    this.info = null;
  }
}

/** Back-compat wrapper used by earlier code/tests: Streamable HTTP with optional static Authorization. */
export class McpHttpClient extends McpClient {
  constructor(url: string, authorization?: string, timeoutMs = 10_000) {
    super({ url, transport: "auto", auth: authorization ? async () => authorization : undefined, timeoutMs });
  }
  initialize() {
    return this.connect();
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

export { assertPublicUrl };
