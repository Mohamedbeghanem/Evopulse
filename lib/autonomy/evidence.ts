import type { DatabaseSync } from "node:sqlite";
import { all } from "../db";
import { successRate } from "../learning/confidence";
import { RECENT_WINDOW, SEVERE_RESULTS } from "./rules";
import type { AutonomyEvidence } from "./types";

/**
 * Context signature for historical autonomy outcomes that predate a live action row
 * (seeded synthetic history). Live outcomes are attributed through outcomes.action_id → actions.type.
 */
export function autonomyHistorySignature(actionType: string): string {
  return `problem:autonomy_history|action_type:${actionType}`;
}

type OutcomeLite = { id: string; action_id: string | null; success: number; result: string };

/**
 * Everything is read from the Outcome Ledger (`outcomes`) and human feedback (`action_feedback`).
 * Nothing here is a stored label: re-running on the same rows always gives the same numbers.
 */
export function evidenceFor(db: DatabaseSync, actionType: string): AutonomyEvidence {
  const outcomes = all<OutcomeLite>(
    db,
    `SELECT o.id, o.action_id, o.success, o.result
       FROM outcomes o
       LEFT JOIN actions a ON a.id = o.action_id
      WHERE a.type = ? OR o.context_signature = ?
      ORDER BY o.created_at DESC, o.id DESC`,
    [actionType, autonomyHistorySignature(actionType)],
  );

  const verified = outcomes.length;
  const successes = outcomes.filter((o) => Number(o.success) === 1).length;
  const recent = outcomes.slice(0, RECENT_WINDOW);
  const recentSuccesses = recent.filter((o) => Number(o.success) === 1).length;
  let failureStreak = 0;
  for (const o of outcomes) {
    if (Number(o.success) === 1) break;
    failureStreak += 1;
  }

  const actionIds = [...new Set(outcomes.map((o) => o.action_id).filter((v): v is string => Boolean(v)))];
  const feedback = all<{ decision: string }>(
    db,
    `SELECT decision FROM action_feedback
      WHERE action_id IN (SELECT id FROM actions WHERE type = ?)
         OR action_id IN (SELECT value FROM json_each(?))`,
    [actionType, JSON.stringify(actionIds)],
  );
  const overrides = feedback.filter((f) => f.decision === "EDIT" || f.decision === "REJECT").length;

  return {
    verified,
    successes,
    failures: verified - successes,
    successRate: successRate(successes, verified),
    recentVerified: recent.length,
    recentSuccessRate: successRate(recentSuccesses, recent.length),
    failureStreak,
    feedbackTotal: feedback.length,
    overrides,
    overrideRate: successRate(overrides, feedback.length),
    synthetic: outcomes.filter((o) => o.id.startsWith("syn_")).length,
    outcomeIds: outcomes.map((o) => o.id),
    severeOutcomeIds: outcomes.filter((o) => SEVERE_RESULTS.has(o.result)).map((o) => o.id),
  };
}

export function evidenceText(e: AutonomyEvidence): string {
  if (e.verified === 0) return "No verified outcomes";
  const base = `${e.verified} verified outcome${e.verified === 1 ? "" : "s"} · ${e.successes} successful`;
  return base;
}
