import { evaluatePolicy, planOutcome } from "../engine/policy";
import type { PolicyOutcome } from "../types";
import type { AutonomyLevel, PolicyCeiling } from "./types";

/** Action types that carry an autonomy profile. Labels are what an operator reads. */
export const AUTONOMY_ACTIONS: { type: string; label: string }[] = [
  { type: "create_checkpoint", label: "Create internal checkpoint" },
  { type: "create_task", label: "Create internal task" },
  { type: "draft_message", label: "Prepare customer follow-up" },
  { type: "prepare_proposal", label: "Prepare proposal" },
  { type: "send_message", label: "Send customer message" },
  { type: "offer_alternative", label: "Offer alternative terms" },
  { type: "apply_discount", label: "Offer discount" },
  { type: "delete_customer_data", label: "Delete customer data" },
];

export function actionLabel(type: string): string {
  return AUTONOMY_ACTIONS.find((a) => a.type === type)?.label || type.replaceAll("_", " ");
}

/**
 * Internal, undoable work: the only kind Execute Safe (L3) may run on its own.
 * Mirrors REVERSIBLE_ACTION_TYPES in the Exception Autopilot's matrix. Once that lands on main, import it instead.
 */
export const REVERSIBLE_INTERNAL_TYPES = new Set(["create_checkpoint", "create_task", "draft_message"]);
/**
 * Work that reaches a customer or carries customer-specific external effects. The gate NEVER authorizes
 * auto-execution of these, at any level: each instance needs a human approval. prepare_proposal is here
 * because executing it has customer-facing effects (autopilot review); remove it only once it is purely internal.
 */
export const CUSTOMER_FACING_TYPES = new Set([
  "prepare_proposal",
  "draft_message",
  "send_message",
  "offer_alternative",
  "apply_discount",
]);
/** Money or commercial terms. When policy wants a human here, autonomy stops at Recommend. */
export const FINANCIAL_TYPES = new Set(["apply_discount", "offer_alternative"]);

/** Representative instance per type. The policy engine judges this to set the type-level ceiling. */
export function canonicalPayload(type: string, policies: Record<string, string>): Record<string, unknown> {
  switch (type) {
    case "draft_message":
    case "send_message":
      return { channel: "email", audience: "customer" };
    case "apply_discount":
      // The largest discount policy could allow. Anything bigger is BLOCKED per instance anyway.
      return { percent: Number(policies.discount_max ?? 5) };
    case "offer_alternative":
      return { terms: "net-14" };
    default:
      return {};
  }
}

/**
 * Policy ceiling = the hard cap on autonomy for a type. Derived from lib/engine/policy.ts every time, so
 * editing a policy row moves the ceiling. AI evidence can never lift it.
 *
 *   BLOCKED                          → 0  Autonomy prohibited
 *   APPROVAL_REQUIRED, financial     → 1  Financial control
 *   APPROVAL_REQUIRED, reversible    → 3  Policy ceiling (a draft stays inside; the policy engine still
 *                                          holds every instance that needs approval)
 *   APPROVAL_REQUIRED, other         → 2  Policy ceiling
 *   AUTO                             → 4  Within policy
 */
export function policyCeiling(type: string, policies: Record<string, string>): PolicyCeiling {
  const { outcome, reason } = evaluatePolicy({ type, payload: canonicalPayload(type, policies) }, policies);
  const make = (level: AutonomyLevel, kind: PolicyCeiling["kind"], label: string): PolicyCeiling => ({
    level,
    kind,
    label,
    policyOutcome: outcome,
    policyReason: reason,
  });
  if (outcome === "BLOCKED") return make(0, "prohibited", "Autonomy prohibited");
  if (outcome === "APPROVAL_REQUIRED") {
    if (FINANCIAL_TYPES.has(type)) return make(1, "financial", "Financial control");
    if (REVERSIBLE_INTERNAL_TYPES.has(type)) return make(3, "policy", "Policy ceiling");
    return make(2, "policy", "Policy ceiling");
  }
  return make(4, "none", "Within policy");
}

/**
 * Policy for one concrete instance. Like the goal engine's safe-execute (lib/goals/execute-safe.ts), the
 * policy engine is re-run on the live payload right before deciding; a stored outcome can only make the
 * answer stricter (planOutcome picks the strictest), never looser.
 */
export function instancePolicy(
  type: string,
  policies: Record<string, string>,
  opts: { payload?: Record<string, unknown>; policyOutcome?: PolicyOutcome; policyReason?: string } = {},
): { outcome: PolicyOutcome; reason: string } {
  const live = evaluatePolicy({ type, payload: opts.payload ?? canonicalPayload(type, policies) }, policies);
  if (!opts.policyOutcome) return live;
  const strictest = planOutcome([live.outcome, opts.policyOutcome]);
  if (strictest === live.outcome) return live;
  return { outcome: strictest, reason: opts.policyReason || `Stored policy decision: ${strictest}.` };
}
