import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { executeAction } from "../engine/execute";
import type { ActionRow, PlanRow } from "../types";
import { hydratePlan } from "./planner";
import { refreshGoalStatus } from "./status";

export function executeSafeActions(db: DatabaseSync, planId: string, now: string, actor = "operator") {
  const plan = one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [planId]);
  if (!plan) throw new Error("Plan not found");

  const actions = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ? ORDER BY priority, created_at", [planId]);
  const auto = actions.filter((action) => action.policy_outcome === "AUTO" && action.status !== "executed");
  const skippedApproval = actions.filter((action) => action.policy_outcome === "APPROVAL_REQUIRED");
  const skippedBlocked = actions.filter((action) => action.policy_outcome === "BLOCKED");

  const executed: ActionRow[] = [];
  // `auto` is already filtered to policy_outcome === "AUTO", so the re-checks that used to sit here
  // were unreachable — and the compiler flagged them as comparisons that can never hold.
  for (const action of auto) {
    executed.push(executeAction(db, action.id, now, actor)!);
  }

  run(db, "UPDATE plans SET status = ? WHERE id = ?", ["safe_executed", planId]);
  if (plan.goal_id) refreshGoalStatus(db, plan.goal_id, now);

  const after = hydratePlan(db, planId);
  const live = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ?", [planId]);
  return {
    plan: after,
    executed: executed.map((row) => row.id),
    pendingApproval: skippedApproval.map((row) => row.id),
    blocked: skippedBlocked.map((row) => row.id),
    counts: {
      prepared: live.length,
      executed: live.filter((row) => row.policy_outcome === "AUTO" && row.status === "executed").length,
      waitingForApproval: live.filter((row) => row.policy_outcome === "APPROVAL_REQUIRED" && row.status !== "executed").length,
      blocked: live.filter((row) => row.policy_outcome === "BLOCKED").length,
    },
  };
}

export function approvePlanAction(db: DatabaseSync, planId: string, actionId: string, now: string, actor = "operator") {
  const action = one<ActionRow>(db, "SELECT * FROM actions WHERE id = ? AND plan_id = ?", [actionId, planId]);
  if (!action) throw new Error("Action not found");
  if (action.policy_outcome === "BLOCKED") {
    throw new Error(action.policy_reason || "Blocked actions cannot be approved.");
  }
  run(db, "UPDATE actions SET status = ? WHERE id = ?", ["approved", actionId]);
  run(
    db,
    "INSERT INTO approvals (id, plan_id, action_id, status, decided_at, decided_by) VALUES (?, ?, ?, ?, ?, ?)",
    [`apr_${actionId}`, planId, actionId, "approved", now, actor],
  );
  return one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId]);
}
