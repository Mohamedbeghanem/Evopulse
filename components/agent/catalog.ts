export type AgentTone = "slate" | "orange" | "violet";

export type AgentRecord = {
  id: string;
  name: string;
  purpose: string;
  tone: AgentTone;
  scope: string[];
  capabilities: string[];
  /** Standing product role. Only Pulse monitors continuously. */
  standing: "IDLE" | "MONITORING";
  preview?: boolean;
};

export const SCOPE_OPTIONS = [
  "Customers",
  "Suppliers",
  "Orders",
  "Shipments",
  "Invoices",
  "Commitments",
  "Goals",
] as const;

export const CAPABILITY_OPTIONS = [
  "Monitor",
  "Investigate",
  "Simulate",
  "Prepare actions",
  "Execute safe actions",
] as const;

export const BUILT_IN_AGENTS: AgentRecord[] = [
  {
    id: "pulse",
    name: "Pulse",
    purpose: "Watch what needs you across the business.",
    tone: "slate",
    scope: ["Customers", "Orders", "Commitments"],
    capabilities: ["Monitor", "Investigate"],
    standing: "MONITORING",
  },
  {
    id: "revenue-guardian",
    name: "Revenue Guardian",
    purpose: "Protect revenue and customer commitments.",
    tone: "orange",
    scope: ["Customers", "Orders", "Invoices", "Commitments"],
    capabilities: ["Monitor", "Investigate", "Simulate", "Prepare actions"],
    standing: "IDLE",
  },
  {
    id: "operations-guardian",
    name: "Operations Guardian",
    purpose: "Watch shipments, suppliers, and delivery promises.",
    tone: "violet",
    scope: ["Suppliers", "Shipments", "Orders"],
    capabilities: ["Monitor", "Investigate", "Simulate"],
    standing: "IDLE",
  },
  {
    id: "customer-guardian",
    name: "Customer Guardian",
    purpose: "Watch customer commitments and replies.",
    tone: "slate",
    scope: ["Customers", "Commitments"],
    capabilities: ["Monitor", "Investigate"],
    standing: "IDLE",
  },
  {
    id: "cash-guardian",
    name: "Cash Guardian",
    purpose: "Watch expected cash timing. It does not book cash.",
    tone: "slate",
    scope: ["Invoices", "Orders"],
    capabilities: ["Monitor", "Simulate"],
    standing: "IDLE",
  },
];

export const PREVIEW_STORAGE_KEY = "evopulse-agent-preview";

export function agentById(id: string, extra: AgentRecord[] = []): AgentRecord | undefined {
  return [...BUILT_IN_AGENTS, ...extra].find((agent) => agent.id === id);
}
