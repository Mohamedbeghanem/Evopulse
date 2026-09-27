import type { DatabaseSync } from "node:sqlite";
import type { ActionRow } from "../types";
import { gateAction } from "./service";
import type { AutonomyGateResult } from "./types";

/**
 * AUTOPILOT INTEGRATION SEAM — adapter for the Exception Autopilot (lib/autopilot, branch feat/exception-autopilot).
 *
 * Shaped like the autopilot's other adapters (ExceptionSource, EarlyWarningSource, ResponsePlanner in
 * lib/autopilot/adapters.ts) so it can be registered with `setAutopilotAdapters({ autonomy: adaptiveAutonomyGate })`
 * once the autopilot's Adapters type has an `autonomy` slot. Wiring, when the autopilot is on main:
 *
 *   1. adapters.ts: add `autonomy: AutonomyGateSource` to Adapters, default `policyOnlyGate` (today's behaviour).
 *   2. engine.ts autoExecute(): run only actions where `adapters.autonomy.gate(db, action, now).mayAutoExecute`.
 *   3. engine.ts gatherFacts(): `reversible` becomes "every allowed action's gate says AUTO", so rule
 *      R12_SAFE_AUTO fires only for earned autonomy and R13 routes the rest to NEEDS_APPROVAL.
 *
 * The autonomy module does not import lib/autopilot, so it merges independently of that branch.
 */
export interface AutonomyGateSource {
  name: string;
  gate(
    db: DatabaseSync,
    action: Pick<ActionRow, "type" | "payload" | "policy_outcome"> & { policy_reason?: string },
    now: string,
  ): AutonomyGateResult;
}

/** Earned, per-action autonomy: pause → suspension → policy → earned level. */
export const adaptiveAutonomyGate: AutonomyGateSource = {
  name: "adaptive-autonomy",
  gate: (db, action, now) => gateAction(db, action, now),
};

/**
 * Pre-autonomy behaviour, for comparison and as the autopilot's default: policy alone decides.
 * Mirrors the autopilot's actionGate(): AUTO runs, APPROVAL_REQUIRED waits, BLOCKED never runs.
 */
export const policyOnlyGate: AutonomyGateSource = {
  name: "policy-only",
  gate: (_db, action) => {
    const mode = action.policy_outcome === "AUTO" ? "auto" : action.policy_outcome === "BLOCKED" ? "blocked" : "prepare";
    return {
      actionType: action.type,
      level: mode === "auto" ? 4 : mode === "blocked" ? 0 : 2,
      levelName: mode === "auto" ? "Operate Within Policy" : mode === "blocked" ? "Observe" : "Prepare",
      ceiling: mode === "auto" ? 4 : mode === "blocked" ? 0 : 2,
      mode,
      mayAutoExecute: mode === "auto",
      requiresApproval: mode === "prepare",
      blocked: mode === "blocked",
      policyOutcome: action.policy_outcome,
      actionGate: mode === "auto" ? "AUTO" : mode === "blocked" ? "BLOCKED" : "NEEDS_APPROVAL",
      reason: `Policy only: ${action.policy_outcome}.`,
    };
  },
};
