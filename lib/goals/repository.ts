import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { id } from "../ids";
import type { GoalRow, GoalStatus } from "../types";
import type { InterpretedGoal } from "./types";

export function insertGoal(db: DatabaseSync, interpreted: InterpretedGoal, now: string, source = "command"): GoalRow {
  const goalId = id("gol");
  run(
    db,
    `INSERT INTO goals
      (id, name, target, payload, objective, goal_type, scope, metric, deadline, constraints,
       priority, status, source, created_at, updated_at, completed_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goalId,
      interpreted.objective,
      interpreted.target,
      JSON.stringify({ scope: interpreted.scope }),
      interpreted.objective,
      interpreted.goalType,
      interpreted.scope,
      interpreted.metric,
      interpreted.deadline,
      JSON.stringify(interpreted.constraints),
      1,
      "DRAFT",
      source,
      now,
      now,
      null,
      JSON.stringify({ interpreter: interpreted.source }),
    ],
  );
  return getGoal(db, goalId)!;
}

export function getGoal(db: DatabaseSync, goalId: string): GoalRow | undefined {
  return one<GoalRow>(db, "SELECT * FROM goals WHERE id = ?", [goalId]);
}

export function listGoals(db: DatabaseSync): GoalRow[] {
  return all<GoalRow>(db, "SELECT * FROM goals ORDER BY created_at DESC");
}

export function updateGoalStatus(db: DatabaseSync, goalId: string, status: GoalStatus, now: string, completedAt?: string | null) {
  run(db, "UPDATE goals SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?", [
    status,
    now,
    completedAt ?? null,
    goalId,
  ]);
}
