import type { DatabaseSync } from "node:sqlite";
import { all } from "../db";
import type { ActionRow, GoalRow } from "../types";
import { buildGoalContext } from "./context";
import { interpretGoal } from "./interpret";
import { buildPlan, hydratePlan } from "./planner";
import { getGoal, insertGoal, listGoals } from "./repository";
import { ensureLiveCascade } from "./seed-risks";
import { refreshGoalStatus } from "./status";
import type { GoalInput, StructuredPlan } from "./types";

export function createGoal(db: DatabaseSync, input: GoalInput, now: string, options: { plan?: boolean } = {}) {
  const interpreted = interpretGoal(input);
  if (
    interpreted.goalType === "protect_business" ||
    interpreted.goalType === "protect_revenue" ||
    interpreted.goalType === "protect_cash" ||
    interpreted.goalType === "protect_customer_commitments"
  ) {
    ensureLiveCascade(db);
  }
  const goal = insertGoal(db, interpreted, now, input.source || "command");
  let plan: StructuredPlan | undefined;
  if (options.plan !== false) {
    plan = buildPlan(db, goal.id, now);
    refreshGoalStatus(db, goal.id, now);
  }
  const context = buildGoalContext(db, interpreted, goal.id);
  return {
    goal: getGoal(db, goal.id)!,
    interpreted,
    context,
    plan,
  };
}

export function getGoalBundle(db: DatabaseSync, goalId: string) {
  const goal = getGoal(db, goalId);
  if (!goal) return null;
  const interpreted = interpretGoal({
    goalType: goal.goal_type,
    scope: goal.scope,
    deadline: goal.deadline,
    constraints: safeJson(goal.constraints),
  });
  const context = buildGoalContext(db, interpreted, goal.id);
  const planRow = all<{ id: string }>(db, "SELECT id FROM plans WHERE goal_id = ? ORDER BY created_at DESC", [goalId])[0];
  const plan = planRow ? hydratePlan(db, planRow.id) : null;
  const actions = plan
    ? all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ? ORDER BY priority, created_at", [plan.id || ""])
    : [];
  return { goal, context, plan, actions };
}

export function listGoalSummaries(db: DatabaseSync): GoalRow[] {
  return listGoals(db).filter((goal) => goal.goal_type);
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export { interpretGoal };
