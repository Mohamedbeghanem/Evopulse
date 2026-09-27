import type { DatabaseSync } from "node:sqlite";
import { all, run } from "../db";
import type { ActionRow, PolicyOutcome, PolicyRow } from "../types";

export type ProposedAction = {
  type: string;
  payload: Record<string, unknown>;
};

export function loadPolicies(db: DatabaseSync): Record<string, string> {
  const rows = all<PolicyRow>(db, "SELECT * FROM policies");
  return Object.fromEntries(rows.map((p) => [p.key, p.value]));
}

export function evaluatePolicy(
  action: ProposedAction,
  policies: Record<string, string>,
): { outcome: PolicyOutcome; reason: string } {
  if (action.type === "offer_alternative" && policies.financial_commitment_requires_approval === "true") {
    return {
      outcome: "APPROVAL_REQUIRED",
      reason: "Payment terms are a financial commitment and need approval.",
    };
  }

  if (action.type === "apply_discount") {
    const requested = Number(action.payload.percent ?? 0);
    const max = Number(policies.discount_max ?? 5);
    if (requested > max) {
      return {
        outcome: "BLOCKED",
        reason: `Policy discount_max=${max}% blocks a ${requested}% discount.`,
      };
    }
    if (policies.financial_commitment_requires_approval === "true") {
      return {
        outcome: "APPROVAL_REQUIRED",
        reason: "Financial commitments require human approval.",
      };
    }
  }

  if (
    action.type === "send_message" ||
    action.type === "send_simulated_message" ||
    action.type === "draft_message"
  ) {
    if (policies.external_message_requires_approval === "true") {
      return {
        outcome: "APPROVAL_REQUIRED",
        reason: "External customer messages require approval.",
      };
    }
  }

  const amount = Number(action.payload.amount ?? 0);
  if (amount >= 500000 && policies.payment_over_500k_requires_approval === "true") {
    return {
      outcome: "APPROVAL_REQUIRED",
      reason: "Payments over 500,000 require approval.",
    };
  }

  if (action.type === "delete_customer_data" || policies.customer_data_deletion === "forbidden") {
    if (action.type === "delete_customer_data") {
      return { outcome: "BLOCKED", reason: "Customer data deletion is forbidden." };
    }
  }

  return { outcome: "AUTO", reason: "Action is inside policy bounds." };
}

export function planOutcome(
  outcomes: PolicyOutcome[],
): PolicyOutcome {
  if (outcomes.includes("BLOCKED")) return "BLOCKED";
  if (outcomes.includes("APPROVAL_REQUIRED")) return "APPROVAL_REQUIRED";
  return "AUTO";
}

export function parseActionPayload(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Re-evaluate stored policy immediately before approval or execution. */
export function recheckActionPolicy(db: DatabaseSync, action: ActionRow): ActionRow {
  const decision = evaluatePolicy({ type: action.type, payload: parseActionPayload(action.payload) }, loadPolicies(db));
  if (decision.outcome === action.policy_outcome && decision.reason === action.policy_reason) {
    return action;
  }
  run(db, "UPDATE actions SET policy_outcome = ?, policy_reason = ? WHERE id = ?", [
    decision.outcome,
    decision.reason,
    action.id,
  ]);
  return { ...action, policy_outcome: decision.outcome, policy_reason: decision.reason };
}
