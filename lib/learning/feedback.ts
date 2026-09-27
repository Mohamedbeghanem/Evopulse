import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { eventsFor } from "../events";
import { id } from "../ids";
import type { ActionRow } from "../types";
import { LEARNING_EVENT_TYPES, inferStrategyFromAction } from "./verification";
import type { ActionFeedbackRow, FeedbackDecision } from "./types";

export class HumanFeedbackService {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new HumanFeedbackService(db);
  }

  record(input: {
    action_id: string;
    decision: FeedbackDecision;
    original_strategy?: string;
    final_strategy?: string;
    reason?: string;
    created_at: string;
  }): ActionFeedbackRow {
    if (!["ACCEPT", "EDIT", "REJECT"].includes(input.decision)) {
      throw new Error("Feedback decision must be ACCEPT, EDIT, or REJECT");
    }

    const action = one<ActionRow>(this.db, "SELECT * FROM actions WHERE id = ?", [input.action_id]);
    const inferred = action ? inferStrategyFromAction(action) : "";
    const original = input.original_strategy || inferred;
    const final =
      input.decision === "ACCEPT"
        ? original
        : input.final_strategy || (input.decision === "REJECT" ? "" : original);

    const rowId = id("fbk");
    run(
      this.db,
      `INSERT INTO action_feedback
        (id, action_id, decision, original_strategy, final_strategy, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rowId, input.action_id, input.decision, original, final, input.reason || "", input.created_at],
    );

    eventsFor(this.db).append({
      type: LEARNING_EVENT_TYPES.FEEDBACK_RECORDED,
      source: "feedback-engine",
      source_id: rowId,
      entity_type: "action",
      entity_id: input.action_id,
      payload: {
        decision: input.decision,
        original_strategy: original,
        final_strategy: final,
        correction: input.decision === "EDIT" && original && final && original !== final,
      },
      occurred_at: input.created_at,
      received_at: input.created_at,
      confidence: 1,
      idempotent: true,
    });

    return this.getById(rowId)!;
  }

  getById(feedbackId: string): ActionFeedbackRow | undefined {
    return one<ActionFeedbackRow>(this.db, "SELECT * FROM action_feedback WHERE id = ?", [feedbackId]);
  }

  listForAction(actionId: string): ActionFeedbackRow[] {
    return all<ActionFeedbackRow>(
      this.db,
      "SELECT * FROM action_feedback WHERE action_id = ? ORDER BY created_at",
      [actionId],
    );
  }

  /**
   * Correction observations only. Does not rewrite learned_patterns or change planner defaults.
   * Foundation for later: "Managers changed X in N of M cases."
   */
  getCorrectionStats(originalStrategy?: string): {
    total: number;
    edits: number;
    rejects: number;
    accepts: number;
    changed_to: Record<string, number>;
    wording: string | null;
  } {
    const rows = originalStrategy
      ? all<ActionFeedbackRow>(
          this.db,
          "SELECT * FROM action_feedback WHERE original_strategy = ?",
          [originalStrategy],
        )
      : all<ActionFeedbackRow>(this.db, "SELECT * FROM action_feedback");

    const changedTo: Record<string, number> = {};
    let edits = 0;
    let rejects = 0;
    let accepts = 0;
    for (const row of rows) {
      if (row.decision === "EDIT") {
        edits += 1;
        if (row.final_strategy && row.final_strategy !== row.original_strategy) {
          changedTo[row.final_strategy] = (changedTo[row.final_strategy] || 0) + 1;
        }
      } else if (row.decision === "REJECT") rejects += 1;
      else accepts += 1;
    }

    const wording =
      edits > 0 && originalStrategy
        ? `Managers changed ${originalStrategy} in ${edits} of ${rows.length} recorded feedback cases.`
        : null;

    return {
      total: rows.length,
      edits,
      rejects,
      accepts,
      changed_to: changedTo,
      wording,
    };
  }
}
