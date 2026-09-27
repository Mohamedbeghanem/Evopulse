// Minimal stdio MCP server for tests: newline-delimited JSON-RPC.
import { createInterface } from "node:readline";
const rl = createInterface({ input: process.stdin });
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
process.stdout.write("stdio fixture booting (non-JSON log line)\n");
rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === undefined) return;
  if (msg.method === "initialize") send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2025-06-18", serverInfo: { name: "local-stdio" }, capabilities: { tools: {} } } });
  else if (msg.method === "tools/list")
    send({ jsonrpc: "2.0", id: msg.id, result: { tools: [{ name: "local_lookup", description: "Local read", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } }] } });
  else if (msg.method === "tools/call") send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: "local ok" }] } });
  else send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "no" } });
});
