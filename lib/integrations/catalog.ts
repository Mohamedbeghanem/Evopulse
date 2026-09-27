export const CONNECTOR_CATEGORIES = [
  "CRM",
  "Accounting",
  "Email",
  "Calendar",
  "Commerce",
  "Payments",
  "Support",
  "Messaging",
  "Project management",
  "Databases",
  "Files",
] as const;

export type ConnectorCategory = (typeof CONNECTOR_CATEGORIES)[number];
export type ConnectorStatus = "AVAILABLE" | "CONNECTED" | "SYNCING" | "NEEDS_ATTENTION" | "COMING_SOON";

export type ConnectorDefinition = {
  id: string;
  name: string;
  category: ConnectorCategory;
  summary: string;
  backend: boolean;
};

/**
 * Only connectors with backend:true may leave COMING_SOON.
 * No live CRM/accounting adapters exist in this codebase — do not claim they work.
 */
export const CONNECTOR_CATALOG: ConnectorDefinition[] = [
  {
    id: "manual-profile",
    name: "Business profile",
    category: "Files",
    summary: "What you already told Pulse about your business.",
    backend: true,
  },
  {
    id: "manual-notes",
    name: "Describe your operations",
    category: "Files",
    summary: "Add customers, suppliers, and commitments as governed notes.",
    backend: true,
  },
  { id: "hubspot", name: "HubSpot", category: "CRM", summary: "Customers and deals.", backend: false },
  { id: "salesforce", name: "Salesforce", category: "CRM", summary: "Accounts and pipeline.", backend: false },
  { id: "quickbooks", name: "QuickBooks", category: "Accounting", summary: "Invoices and cash.", backend: false },
  { id: "xero", name: "Xero", category: "Accounting", summary: "Books and bills.", backend: false },
  { id: "gmail", name: "Gmail", category: "Email", summary: "Commitments in mail.", backend: false },
  { id: "outlook", name: "Outlook", category: "Email", summary: "Commitments in mail.", backend: false },
  { id: "google-calendar", name: "Google Calendar", category: "Calendar", summary: "Deadlines and meetings.", backend: false },
  { id: "shopify", name: "Shopify", category: "Commerce", summary: "Orders and fulfillments.", backend: false },
  { id: "stripe", name: "Stripe", category: "Payments", summary: "Payments and payouts.", backend: false },
  { id: "zendesk", name: "Zendesk", category: "Support", summary: "Tickets and promises.", backend: false },
  { id: "slack", name: "Slack", category: "Messaging", summary: "Decisions in channels.", backend: false },
  { id: "linear", name: "Linear", category: "Project management", summary: "Work and delivery.", backend: false },
  { id: "postgres", name: "Postgres", category: "Databases", summary: "Operational tables.", backend: false },
  { id: "drive", name: "Google Drive", category: "Files", summary: "Contracts and exports.", backend: false },
];
