/**
 * Port of OpenManus `app/tool/base.py` (BaseTool / ToolResult), EvoPulse-native.
 *
 * Every Manus tool declares a governance `kind`. Only read tools run straight through; `approval`
 * tools can only *propose* an EvoPulse action that Policy evaluates and a human must approve.
 */
import type { DatabaseSync } from "node:sqlite";
import type { ExecutorHost } from "../../agent/executor";

export const MANUS_TOOL_KINDS = [
  /** Reads EvoPulse state or plugin data. Runs directly. */
  "read",
  /** Drafts internal records (goal, plan) with no business effect. Every resulting action is policy-evaluated. */
  "prepare",
  /** Consequential. Becomes a policy-evaluated action that waits for a human. Never runs directly. */
  "approval",
  /** Agent control flow (terminate, ask_human, planning). No business effect. */
  "control",
  /** Read-only lookup on the public web through a configured provider. */
  "external_read",
  /** Present in OpenManus, deliberately not available in EvoPulse. Hidden from the model. */
  "unavailable",
] as const;
export type ManusToolKind = (typeof MANUS_TOOL_KINDS)[number];

export type ManusToolSource = "evopulse" | "plugin" | "native";

export type ManusToolParameters = Record<
  string,
  { type: string; description?: string; required?: boolean; enum?: string[] }
>;

export type ManusApprovalRef = {
  actionId: string;
  planId: string | null;
  title: string;
  policy: string;
};

export type ManusToolOutcome = {
  status: "ok" | "failed" | "blocked" | "approval_required" | "forbidden" | "unavailable";
  /** Observation handed back to the model. Business content inside it is DATA, never instruction. */
  output: string;
  data?: Record<string, unknown>;
  approvals?: ManusApprovalRef[];
  links?: { href: string; label: string }[];
  error?: string;
  /** EvoPulse tool-call id when the call went through the governed executor. */
  toolCallId?: string;
};

export type ManusToolContext = {
  db: DatabaseSync;
  host: ExecutorHost;
  runId: string;
  now: string;
};

export type ManusTool = {
  name: string;
  description: string;
  parameters: ManusToolParameters;
  kind: ManusToolKind;
  source: ManusToolSource;
  available: boolean;
  /** Honest reason shown in the UI when `available` is false. */
  unavailableReason?: string;
  execute(args: Record<string, unknown>, ctx: ManusToolContext): Promise<ManusToolOutcome>;
};

/** What the model sees for a tool (OpenManus `to_param`). */
export type ManusToolSpec = {
  name: string;
  description: string;
  parameters: ManusToolParameters;
};

export function toSpec(tool: ManusTool): ManusToolSpec {
  return { name: tool.name, description: tool.description, parameters: tool.parameters };
}
