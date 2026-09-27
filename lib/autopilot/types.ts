import type { Attention, PolicyOutcome } from "../types";

/**
 * Every inbound event and every exception ends in exactly one of these states.
 * Deterministic software assigns them — never an LLM.
 */
export const AUTOPILOT_STATES = [
  "NORMAL",
  "AUTO_HANDLED",
  "MONITORING",
  "NEEDS_APPROVAL",
  "NEEDS_YOU",
  "BLOCKED",
  "HANDLED",
] as const;
export type AutopilotState = (typeof AUTOPILOT_STATES)[number];

/** Autopilot state → persisted exceptions.attention. NORMAL keeps the legacy HEALTHY value. */
export function toAttention(state: AutopilotState): Attention {
  return state === "NORMAL" ? "HEALTHY" : state;
}

export type Risk = "none" | "low" | "medium" | "high";
export type PolicyInput = PolicyOutcome | "NONE";
export type ExecutionInput = "none" | "partial" | "executed" | "failed";
export type VerificationInput = "none" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";

/** Everything the decision matrix is allowed to look at. Plain data — easy to audit and unit-test. */
export type ClassificationInput = {
  risk: Risk;
  policy: PolicyInput;
  impactValue: number;
  reversible: boolean;
  hasActions: boolean;
  execution: ExecutionInput;
  executedBy: "autopilot" | "human" | null;
  verification: VerificationInput;
  resolved: boolean;
  /** Expected event type that the expectation matcher observed and that resolved this exception. */
  resolvedBy: string | null;
};

export type Decision = {
  state: AutopilotState;
  rule: string;
  reason: string;
};

export type DecisionRow = {
  id: string;
  subject_type: "event" | "exception";
  subject_id: string;
  state: AutopilotState;
  rule: string;
  reason: string;
  input_json: string;
  decided_at: string;
};

/** Per-action gate shown on a card (e.g. "external send: NEEDS_APPROVAL"). */
export type ActionGate = "AUTO" | "NEEDS_APPROVAL" | "APPROVED" | "BLOCKED" | "EXECUTED" | "FAILED";

export type ActionTemplate = {
  type: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
};

/** Deterministic reading of one inbound event. `null` means routine: nothing to do. */
export type Signal = {
  kind: string;
  title: string;
  risk: Exclude<Risk, "none">;
  impactValue: number;
  expected: string;
  actual: string;
  actions: ActionTemplate[];
};
