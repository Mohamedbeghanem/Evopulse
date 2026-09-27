import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import type { ExceptionRow, GoalRow } from "../types";
import { getGoal, updateGoalStatus } from "./repository";

/**
 * Plan generated ≠ goal achieved. Action executed ≠ goal achieved.
 * Completion waits for the underlying exceptions to actually resolve
 * (Verification / Outcome Ledger will own that signal later).
 */
export function refreshGoalStatus(db: DatabaseSync, goalId: string, now: string): GoalRow | undefined {
  const goal = getGoal(db, goalId);
  if (!goal) return undefined;
  if (goal.status === "CANCELLED" || goal.status === "COMPLETED") return goal;

  const plan = one<{ id: string }>(db, "SELECT id FROM plans WHERE goal_id = ?", [goalId]);
  const actionExceptionIds = all<{ exception_id: string }>(
    db,
    `SELECT DISTINCT exception_id FROM actions
     WHERE plan_id IN (SELECT id FROM plans WHERE goal_id = ?) AND exception_id != ''`,
    [goalId],
  ).map((row) => row.exception_id);

  if (actionExceptionIds.length === 0) {
    if (plan && goal.status === "DRAFT") updateGoalStatus(db, goalId, "ACTIVE", now);
    return getGoal(db, goalId);
  }

  const exceptions = actionExceptionIds
    .map((id) => one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [id]))
    .filter((row): row is ExceptionRow => Boolean(row));
  const open = exceptions.filter(
    (row) => row.status !== "resolved" && row.attention !== "HANDLED" && row.attention !== "HEALTHY",
  );

  if (exceptions.length > 0 && open.length === 0) {
    updateGoalStatus(db, goalId, "COMPLETED", now, now);
    return getGoal(db, goalId);
  }

  if (goal.status === "DRAFT" || goal.status === "ACTIVE") {
    updateGoalStatus(db, goalId, "ACTIVE", now);
  }
  return getGoal(db, goalId);
}
