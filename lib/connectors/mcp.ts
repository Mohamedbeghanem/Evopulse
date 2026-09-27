import type { DatabaseSync } from "node:sqlite";
import { boundedText, looksLikeInstruction } from "./data";
import { McpHttpClient, mcpResultText, type McpToolDescriptor } from "./mcp-client";
import { ConnectorError, ConnectorRegistry } from "./registry";
import { redactSecrets } from "./secrets";
import type { PluginToolSpec } from "./types";

/** readOnlyHint=true is the only way a remote tool is treated as READ. Everything else is WRITE (fail closed). */
export function toPluginTool(tool: McpToolDescriptor): PluginToolSpec {
  return {
    name: boundedText(tool.name, 80),
    description: boundedText(tool.description || tool.annotations?.title || tool.name, 300),
    inputSchema: tool.inputSchema && typeof tool.inputSchema === "object" ? tool.inputSchema : { type: "object" },
    permission: tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint !== true ? "READ" : "WRITE",
  };
}

export function mcpClientFor(registry: ConnectorRegistry, installId: string): McpHttpClient {
  const resolved = registry.resolve(installId);
  if (resolved.manifest.id !== "mcp") throw new ConnectorError("Not an MCP connector.");
  if (!resolved.configured) throw new ConnectorError("MCP server is not configured.", 409);
  return new McpHttpClient(resolved.values.url, resolved.values.authorization || undefined);
}

/** Connect, list tools, cache them on the install. Used by "Test connection" and "Refresh tools". */
export async function refreshMcpTools(db: DatabaseSync, workspaceId: string, installId: string) {
  const registry = ConnectorRegistry.for(db, workspaceId);
  try {
    const client = mcpClientFor(registry, installId);
    const info = await client.initialize();
    const tools = (await client.listTools()).map(toPluginTool);
    registry.setTools(installId, tools);
    const reads = tools.filter((tool) => tool.permission === "READ").length;
    const summary = `${info?.serverInfo?.name ? `${boundedText(info.serverInfo.name, 60)}: ` : ""}${tools.length} tools (${reads} read, ${tools.length - reads} need approval).`;
    registry.recordRun(installId, "test", "ok", summary, { tools: tools.length, reads });
    return { ok: true as const, summary, tools };
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "MCP connection failed.", registry.knownSecretValues(installId));
    registry.recordRun(installId, "test", "error", message);
    return { ok: false as const, summary: message, tools: [] as PluginToolSpec[] };
  }
}

/** READ tools only. Output is business data: bounded, flagged, never executed. */
export async function callMcpReadTool(
  db: DatabaseSync,
  workspaceId: string,
  installId: string,
  tool: PluginToolSpec,
  args: Record<string, unknown>,
) {
  if (tool.permission !== "READ") throw new ConnectorError("Write tools require human approval.", 403);
  const registry = ConnectorRegistry.for(db, workspaceId);
  const client = mcpClientFor(registry, installId);
  const result = await client.callTool(tool.name, args);
  const output = redactSecrets(mcpResultText(result), registry.knownSecretValues(installId));
  return { output, isError: Boolean(result.isError), flaggedAsInstruction: looksLikeInstruction(output) };
}

export async function callMcpWriteToolApproved(
  db: DatabaseSync,
  workspaceId: string,
  installId: string,
  toolName: string,
  args: Record<string, unknown>,
) {
  const registry = ConnectorRegistry.for(db, workspaceId);
  const client = mcpClientFor(registry, installId);
  const result = await client.callTool(toolName, args);
  const output = redactSecrets(mcpResultText(result), registry.knownSecretValues(installId));
  return { output, isError: Boolean(result.isError) };
}
