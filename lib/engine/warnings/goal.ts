import type { DatabaseSync } from "node:sqlite";
import { all } from "../../db";
import type { ExceptionRow } from "../../types";
import { listWarningViews } from "./evaluate";
import { HIGH_CONFIDENCE } from "./scenario";
import type { GoalContext } from "./types";

export const DEFAULT_PROTECT_GOAL = "Protect everything at risk this week.";

/**
 * Read model for a planner. Does not build a plan.
 * High-confidence active warnings sit next to current exceptions so prevention
 * can be considered before failure.
 */
export function buildGoalContext(db: DatabaseSync, now: string, goal = DEFAULT_PROTECT_GOAL): GoalContext {
  const exceptions = all<ExceptionRow>(
    db,
    "SELECT * FROM exceptions WHERE status != 'resolved' ORDER BY created_at DESC",
  );
  const earlyWarnings = listWarningViews(db).filter(
    (warning) => warning.status === "ACTIVE" && warning.confidence >= HIGH_CONFIDENCE,
  );

  return {
    goal,
    generatedAt: now,
    exceptions: exceptions.map((exception) => ({
      id: exception.id,
      title: exception.title,
      kind: exception.kind,
      attention: exception.attention,
      status: exception.status,
    })),
    earlyWarnings: earlyWarnings.map((warning) => ({
      id: warning.id,
      headline: warning.headline,
      summary: warning.summary,
      severity: warning.severity,
      confidence: warning.confidence,
      entityId: warning.entityId,
      shortfallHours: warning.shortfallHours,
      valueAmount: warning.valueAmount,
      currency: warning.currency,
    })),
    note: "The planner can read this context. Early warnings are included so preventive actions can be considered before failure. This does not generate a plan.",
  };
}
