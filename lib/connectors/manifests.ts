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

export const MCP_TRANSPORTS = ["auto", "streamable-http", "sse", "stdio"] as const;
export const MCP_AUTH_TYPES = ["none", "bearer", "oauth"] as const;

export const MCP_SERVER: ConnectorManifest = {
  id: "mcp",
  name: "MCP server",
  kinds: ["tool"],
  category: "Plugins",
  summary:
    "Register a Model Context Protocol server (Streamable HTTP, legacy SSE, or allowlisted stdio). Its tools become plugin tools: reads run, writes wait for your approval.",
  capabilities: ["tools.list", "tools.call", "resources.list", "prompts.list", "oauth2.1"],
  readScopes: ["tools:read"],
  writeScopes: ["tools:write"],
  multiInstance: true,
  config: [
    { key: "label", label: "Name", type: "text", required: true, placeholder: "Accounting MCP" },
    { key: "transport", label: "Transport", type: "select", options: MCP_TRANSPORTS, placeholder: "auto" },
    {
      key: "url",
      label: "Server URL",
      type: "url",
      required: true,
      placeholder: "https://mcp.example.com/mcp",
      when: { key: "transport", notIn: ["stdio"] },
    },
    { key: "authType", label: "Authentication", type: "select", options: MCP_AUTH_TYPES, placeholder: "none", when: { key: "transport", notIn: ["stdio"] } },
    {
      key: "authorization",
      label: "API key / bearer token",
      type: "secret",
      placeholder: "Bearer …",
      when: { key: "authType", in: ["bearer"] },
    },
    { key: "clientId", label: "OAuth client ID (optional, if the server has no dynamic registration)", type: "text", advanced: true, when: { key: "authType", in: ["oauth"] } },
    { key: "clientSecret", label: "OAuth client secret (optional)", type: "secret", advanced: true, when: { key: "authType", in: ["oauth"] } },
    { key: "scope", label: "OAuth scopes (optional)", type: "text", advanced: true, when: { key: "authType", in: ["oauth"] } },
    { key: "command", label: "Command (stdio, allowlisted)", type: "text", required: true, placeholder: "npx", when: { key: "transport", in: ["stdio"] } },
    { key: "args", label: "Arguments", type: "text", placeholder: "-y @modelcontextprotocol/server-everything", when: { key: "transport", in: ["stdio"] } },
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
