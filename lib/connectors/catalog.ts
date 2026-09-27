import { manifestFor } from "./manifests";

/**
 * The admin catalog: built-in connectors plus remote MCP presets, in the style of modern AI
 * assistant connector galleries. Presets are ordinary MCP installs with the URL / transport / auth
 * prefilled; they go through the same OAuth 2.1 discovery and the same Policy gating.
 * `icon` is a lucide-react icon name (brand logos are not shipped; presets use a monogram tile).
 */
export type CatalogAuth = "oauth" | "api_key" | "none" | "file" | "custom";

export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  category: "Data" | "Email" | "Messaging" | "Payments" | "Productivity" | "Engineering" | "Plugins";
  icon: string;
  monogram?: string;
  accent?: string;
  connectorId: string;
  auth: CatalogAuth;
  preset?: { url: string; transport: "auto" | "streamable-http" | "sse"; authType: "oauth" | "bearer" | "none" };
  /** Honest label: presets have not been exercised against the real provider from this codebase. */
  verified: boolean;
  docsUrl?: string;
};

export const CATALOG: readonly CatalogEntry[] = [
  {
    id: "csv-import",
    name: "CSV / Excel import",
    description: "Orders, invoices, customers, suppliers and products from .csv or .xlsx.",
    category: "Data",
    icon: "FileSpreadsheet",
    connectorId: "csv-import",
    auth: "file",
    verified: true,
  },
  {
    id: "email-imap",
    name: "Email (IMAP)",
    description: "Read one mailbox and record new messages as business events.",
    category: "Email",
    icon: "Mail",
    connectorId: "email-imap",
    auth: "api_key",
    verified: false,
  },
  {
    id: "whatsapp-cloud",
    name: "WhatsApp Business",
    description: "Inbound customer messages via webhook; approved replies via Cloud API.",
    category: "Messaging",
    icon: "MessageCircle",
    connectorId: "whatsapp-cloud",
    auth: "api_key",
    verified: false,
  },
  {
    id: "local-outbox",
    name: "Local outbox",
    description: "Approved outbound messages land in a local outbox. Safe default channel.",
    category: "Messaging",
    icon: "Inbox",
    connectorId: "local-outbox",
    auth: "none",
    verified: true,
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payments, invoices and customers through Stripe's remote MCP server.",
    category: "Payments",
    icon: "CreditCard",
    monogram: "S",
    accent: "#635bff",
    connectorId: "mcp",
    auth: "oauth",
    preset: { url: "https://mcp.stripe.com", transport: "auto", authType: "oauth" },
    verified: false,
    docsUrl: "https://docs.stripe.com/mcp",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Search and read pages and databases in your Notion workspace.",
    category: "Productivity",
    icon: "NotebookText",
    monogram: "N",
    accent: "#e6e6e6",
    connectorId: "mcp",
    auth: "oauth",
    preset: { url: "https://mcp.notion.com/mcp", transport: "auto", authType: "oauth" },
    verified: false,
    docsUrl: "https://developers.notion.com/docs/mcp",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issues, projects and cycles from Linear.",
    category: "Engineering",
    icon: "ListChecks",
    monogram: "L",
    accent: "#5e6ad2",
    connectorId: "mcp",
    auth: "oauth",
    preset: { url: "https://mcp.linear.app/mcp", transport: "auto", authType: "oauth" },
    verified: false,
    docsUrl: "https://linear.app/docs/mcp",
  },
  {
    id: "atlassian",
    name: "Jira & Confluence",
    description: "Atlassian remote MCP: Jira issues and Confluence pages.",
    category: "Productivity",
    icon: "KanbanSquare",
    monogram: "A",
    accent: "#2684ff",
    connectorId: "mcp",
    auth: "oauth",
    preset: { url: "https://mcp.atlassian.com/v1/sse", transport: "sse", authType: "oauth" },
    verified: false,
  },
  {
    id: "asana",
    name: "Asana",
    description: "Tasks and projects from Asana.",
    category: "Productivity",
    icon: "CircleCheck",
    monogram: "As",
    accent: "#f06a6a",
    connectorId: "mcp",
    auth: "oauth",
    preset: { url: "https://mcp.asana.com/sse", transport: "sse", authType: "oauth" },
    verified: false,
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repositories, issues and pull requests (personal access token).",
    category: "Engineering",
    icon: "GitBranch",
    monogram: "GH",
    accent: "#e6e6e6",
    connectorId: "mcp",
    auth: "api_key",
    preset: { url: "https://api.githubcopilot.com/mcp/", transport: "streamable-http", authType: "bearer" },
    verified: false,
  },
  {
    id: "custom-mcp",
    name: "Custom MCP server",
    description: "Any MCP server: Streamable HTTP, legacy SSE, or an allowlisted local stdio command.",
    category: "Plugins",
    icon: "Blocks",
    connectorId: "mcp",
    auth: "custom",
    verified: true,
  },
];

export function catalogEntry(id: string): CatalogEntry | undefined {
  return CATALOG.find((entry) => entry.id === id);
}

export function catalogFor(connectorId: string, catalogId: string): CatalogEntry | undefined {
  return catalogEntry(catalogId) || (connectorId === "mcp" ? catalogEntry("custom-mcp") : catalogEntry(connectorId));
}

export function assertCatalogIntegrity() {
  for (const entry of CATALOG) if (!manifestFor(entry.connectorId)) throw new Error(`Catalog entry ${entry.id} has no manifest.`);
}
