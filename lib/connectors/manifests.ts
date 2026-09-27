import type { ConnectorManifest } from "./types";

export const CSV_IMPORT: ConnectorManifest = {
  id: "csv-import",
  name: "CSV / Excel import",
  kinds: ["source"],
  category: "Files",
  summary: "Import orders, invoices, customers, suppliers and products from .csv or .xlsx. Preview and validate first.",
  capabilities: ["import.preview", "import.commit"],
  readScopes: [],
  writeScopes: ["entities:write", "events:write"],
  config: [],
};

export const EMAIL_IMAP: ConnectorManifest = {
  id: "email-imap",
  name: "Email (IMAP)",
  kinds: ["source"],
  category: "Email",
  summary: "Reads new messages from one mailbox and records them as business events. Message text is data, never instructions.",
  capabilities: ["ingest.poll"],
  readScopes: ["messages:read"],
  writeScopes: ["events:write"],
  config: [
    { key: "host", label: "IMAP host", type: "text", required: true, env: "EVOPULSE_IMAP_HOST", placeholder: "imap.example.com" },
    { key: "port", label: "Port", type: "number", env: "EVOPULSE_IMAP_PORT", placeholder: "993" },
    { key: "user", label: "Username", type: "text", required: true, env: "EVOPULSE_IMAP_USER" },
    { key: "password", label: "Password / app password", type: "secret", required: true, env: "EVOPULSE_IMAP_PASSWORD" },
    { key: "mailbox", label: "Mailbox", type: "text", env: "EVOPULSE_IMAP_MAILBOX", placeholder: "INBOX" },
    { key: "tls", label: "Use TLS", type: "boolean", env: "EVOPULSE_IMAP_TLS", placeholder: "true" },
  ],
};

export const WHATSAPP_CLOUD: ConnectorManifest = {
  id: "whatsapp-cloud",
  name: "WhatsApp Business (Cloud API)",
  kinds: ["source", "outbound"],
  category: "Messaging",
  summary: "Inbound webhook records customer messages as events. Outbound messages always pass Policy and, by default, your approval.",
  capabilities: ["ingest.webhook", "outbound.message"],
  readScopes: ["messages:read"],
  writeScopes: ["events:write", "messages:send"],
  config: [
    { key: "phoneNumberId", label: "Phone number ID", type: "text", required: true, env: "WHATSAPP_PHONE_NUMBER_ID" },
    { key: "accessToken", label: "Access token", type: "secret", required: true, env: "WHATSAPP_ACCESS_TOKEN" },
    { key: "verifyToken", label: "Webhook verify token", type: "secret", required: true, env: "WHATSAPP_VERIFY_TOKEN" },
    { key: "appSecret", label: "App secret (signature check)", type: "secret", required: true, env: "WHATSAPP_APP_SECRET" },
    { key: "apiVersion", label: "Graph API version", type: "text", env: "WHATSAPP_API_VERSION", placeholder: "v21.0" },
  ],
};

export const MCP_SERVER: ConnectorManifest = {
  id: "mcp",
  name: "MCP server",
  kinds: ["tool"],
  category: "Plugins",
  summary: "Register a Model Context Protocol server (Streamable HTTP). Its tools become plugin tools: reads run, writes wait for your approval.",
  capabilities: ["tools.list", "tools.call"],
  readScopes: ["tools:read"],
  writeScopes: ["tools:write"],
  multiInstance: true,
  config: [
    { key: "label", label: "Name", type: "text", required: true, placeholder: "Accounting MCP" },
    { key: "url", label: "Server URL", type: "url", required: true, placeholder: "https://mcp.example.com/mcp" },
    { key: "authorization", label: "Authorization header (optional)", type: "secret", placeholder: "Bearer …" },
  ],
};

export const LOCAL_OUTBOX: ConnectorManifest = {
  id: "local-outbox",
  name: "Local outbox",
  kinds: ["outbound"],
  category: "Messaging",
  summary: "Approved outbound messages are written to a local outbox instead of leaving the building. Safe default channel.",
  capabilities: ["outbound.message"],
  readScopes: [],
  writeScopes: ["messages:send"],
  config: [],
};

export const CONNECTOR_MANIFESTS: readonly ConnectorManifest[] = [CSV_IMPORT, EMAIL_IMAP, WHATSAPP_CLOUD, MCP_SERVER, LOCAL_OUTBOX];

export function manifestFor(connectorId: string): ConnectorManifest | undefined {
  return CONNECTOR_MANIFESTS.find((item) => item.id === connectorId);
}
