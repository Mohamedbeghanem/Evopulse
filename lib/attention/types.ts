import type { AutopilotReasonCode, AutopilotState, AutopilotSummary } from "../autopilot/types";

export const ATTENTION_PRECEDENCE: AutopilotState[] = [
  "BLOCKED",
  "NEEDS_YOU",
  "NEEDS_APPROVAL",
  "MONITORING",
  "AUTO_HANDLED",
  "PREPARED",
  "HANDLED",
  "NORMAL",
];

export type AttentionLayerKind =
  | "WARNING"
  | "EXCEPTION"
  | "IMPACT"
  | "GRAPH"
  | "PLAN"
  | "POLICY"
  | "AUTOPILOT"
  | "VERIFICATION";

export type AttentionLayer = {
  kind: AttentionLayerKind;
  id?: string;
  label: string;
  href?: string;
};

export type AttentionImpact = {
  associatedRevenue: number | null;
  expectedCash: number | null;
  orders: number | null;
  customers: number | null;
  currency: string;
};

export type AttentionItem = {
  id: string;
  situationType: "exception" | "warning";
  entityType: string;
  entityId: string;
  sourceWarningId: string | null;
  sourceExceptionId: string | null;
  autopilotDecisionId: string | null;
  classification: AutopilotState;
  reasonCode: AutopilotReasonCode;
  title: string;
  summary: string;
  needsFromYou: string;
  impact: AttentionImpact;
  layers: AttentionLayer[];
  href: string;
  alreadyDone: string[];
};

export type AttentionProjection = {
  items: AttentionItem[];
  needsMe: AttentionItem[];
  watching: AttentionItem[];
  handled: AttentionItem[];
  summary: AutopilotSummary;
};

export function attentionRank(state: AutopilotState): number {
  const index = ATTENTION_PRECEDENCE.indexOf(state);
  return index === -1 ? ATTENTION_PRECEDENCE.length : index;
}

export function isNeedsMe(state: AutopilotState): boolean {
  return state === "BLOCKED" || state === "NEEDS_YOU" || state === "NEEDS_APPROVAL";
}

export function summarizeClassifications(eventsProcessed: number, classifications: AutopilotState[]): AutopilotSummary {
  const count = (state: AutopilotState) => classifications.filter((item) => item === state).length;
  const attention = count("NEEDS_YOU") + count("NEEDS_APPROVAL") + count("BLOCKED") + count("MONITORING");
  return {
    eventsProcessed,
    normal: Math.max(0, eventsProcessed - attention),
    monitoring: count("MONITORING"),
    prepared: count("PREPARED"),
    autoHandled: count("AUTO_HANDLED"),
    needsApproval: count("NEEDS_APPROVAL"),
    needsYou: count("NEEDS_YOU"),
    blocked: count("BLOCKED"),
    handled: count("HANDLED"),
  };
}
