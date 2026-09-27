import type { ActionRow } from "../types";
import type { ActionGate, ClassificationInput, Decision, Risk } from "./types";

/**
 * Anything at or above this associated value is a judgment call for a human,
 * whatever the policy says. Amounts are DZD, same unit as the impact engine.
 */
export const ESCALATION_THRESHOLD = 100_000;

/** Internal, undoable work. External sends, money and commercial terms are never on this list. */
export const REVERSIBLE_ACTION_TYPES = new Set([
  "create_task",
  "create_checkpoint",
  "prepare_proposal",
  "draft_message",
]);

export function isReversible(actionType: string): boolean {
  return REVERSIBLE_ACTION_TYPES.has(actionType);
}

export function riskFromSeverity(severity: string): Risk {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  if (severity === "low") return "low";
  return "none";
}

type Rule = {
  id: string;
  when: (i: ClassificationInput) => boolean;
  state: Decision["state"];
  reason: (i: ClassificationInput) => string;
};

const money = (n: number) => `${n.toLocaleString("en-US")} DZD`;

/**
 * THE decision matrix: risk × policy outcome × impact value × reversibility (+ lifecycle facts) → state.
 * Ordered; first match wins. Lifecycle rules come first so a verified or executed item never
 * falls back to an earlier state. The final rule is a fail-safe: unknown means a human looks.
 */
export const DECISION_MATRIX: readonly Rule[] = [
  {
    id: "R01_EXECUTION_FAILED",
    when: (i) => i.execution === "failed",
    state: "NEEDS_YOU",
    reason: () => "An action failed to execute. Nothing further runs until a human looks.",
  },
  {
    id: "R02_POLICY_BLOCKED",
    when: (i) => i.policy === "BLOCKED" && i.execution === "none",
    state: "BLOCKED",
    reason: () => "Company policy blocks the requested action. An allowed alternative is prepared.",
  },
  {
    id: "R03_VERIFICATION_FAILED",
    when: (i) => i.verification === "FAILED",
    state: "NEEDS_YOU",
    reason: () => "The action ran but the expected result never arrived. Escalated.",
  },
  {
    id: "R04_VERIFIED",
    when: (i) => i.verification === "SUCCESS",
    state: "HANDLED",
    reason: () => "Verification succeeded — the expected result was observed.",
  },
  {
    id: "R05_AWAITING_VERIFICATION",
    when: (i) => i.execution === "executed" && i.verification === "PENDING",
    state: "MONITORING",
    reason: () => "Executed. Waiting for verification before calling it handled.",
  },
  {
    id: "R06_AUTO_EXECUTED",
    when: (i) => i.execution === "executed" && i.executedBy === "autopilot" && i.verification === "none",
    state: "AUTO_HANDLED",
    reason: () => "Low-risk, reversible, internal fix executed automatically inside policy.",
  },
  {
    id: "R07_EXECUTED_NO_VERIFICATION",
    when: (i) => i.execution === "executed" && i.verification === "none",
    state: "HANDLED",
    reason: () => "Executed by a human; nothing external to verify.",
  },
  {
    id: "R08_RESOLVED",
    when: (i) => i.resolved,
    state: "HANDLED",
    reason: () => "Marked resolved.",
  },
  {
    id: "R09_NO_SIGNAL",
    when: (i) => i.risk === "none" && i.policy === "NONE",
    state: "NORMAL",
    reason: () => "Routine business event. Observed silently.",
  },
  {
    id: "R10_HIGH_IMPACT",
    when: (i) => i.risk === "high" || i.impactValue >= ESCALATION_THRESHOLD,
    state: "NEEDS_YOU",
    reason: (i) =>
      i.impactValue >= ESCALATION_THRESHOLD
        ? `${money(i.impactValue)} associated value is at or above the ${money(ESCALATION_THRESHOLD)} escalation threshold — a human judgment call.`
        : "High-risk situation — a human judgment call.",
  },
  {
    id: "R11_APPROVAL_REQUIRED",
    when: (i) => i.policy === "APPROVAL_REQUIRED",
    state: "NEEDS_APPROVAL",
    reason: () => "Response prepared. Policy requires a human to approve it before it leaves the company.",
  },
  {
    id: "R12_SAFE_AUTO",
    when: (i) => i.policy === "AUTO" && i.hasActions && i.reversible && i.risk === "low",
    state: "AUTO_HANDLED",
    reason: () => "Low-risk, reversible, internal fix inside policy — handled automatically.",
  },
  {
    id: "R13_AUTO_NOT_SAFE",
    when: (i) => i.policy === "AUTO" && i.hasActions,
    state: "NEEDS_APPROVAL",
    reason: () => "Policy allows it, but it is not low-risk and reversible — prepared for approval.",
  },
  {
    id: "R14_WATCH",
    when: (i) => !i.hasActions && (i.risk === "low" || i.risk === "medium"),
    state: "MONITORING",
    reason: () => "Early warning. Nothing to do yet — watching for the expected event.",
  },
  {
    id: "R15_FAIL_SAFE",
    when: () => true,
    state: "NEEDS_YOU",
    reason: () => "No rule matched. Fail-safe: a human decides.",
  },
];

export function classify(input: ClassificationInput): Decision {
  const rule = DECISION_MATRIX.find((r) => r.when(input))!;
  return { state: rule.state, rule: rule.id, reason: rule.reason(input) };
}

/** Per-action gate: what the autopilot may do with this single action. */
export function actionGate(action: Pick<ActionRow, "policy_outcome" | "status">): ActionGate {
  if (action.status === "executed") return "EXECUTED";
  if (action.status === "failed") return "FAILED";
  if (action.policy_outcome === "BLOCKED") return "BLOCKED";
  if (action.status === "approved") return "APPROVED";
  if (action.policy_outcome === "APPROVAL_REQUIRED") return "NEEDS_APPROVAL";
  return "AUTO";
}
