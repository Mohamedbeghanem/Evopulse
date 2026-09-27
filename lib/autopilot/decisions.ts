import type { DatabaseSync } from "node:sqlite";
import { all, audit, one, run } from "../db";
import type { Decision, DecisionRow } from "./types";

/**
 * Append-only decision log. A row is written only when a subject's (state, rule) changes,
 * so re-running the autopilot N times writes nothing new. Ids are deterministic:
 * apd_<subject>_<n>, where n is the subject's decision count.
 */
export class DecisionLog {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new DecisionLog(db);
  }

  latestAll(): Map<string, DecisionRow> {
    const rows = all<DecisionRow>(
      this.db,
      `SELECT d.* FROM autopilot_decisions d
       JOIN (SELECT subject_type, subject_id, MAX(rowid) AS r FROM autopilot_decisions GROUP BY subject_type, subject_id) m
         ON d.rowid = m.r`,
    );
    return new Map(rows.map((r) => [key(r.subject_type, r.subject_id), r]));
  }

  latest(subjectType: DecisionRow["subject_type"], subjectId: string): DecisionRow | undefined {
    return one<DecisionRow>(
      this.db,
      "SELECT * FROM autopilot_decisions WHERE subject_type = ? AND subject_id = ? ORDER BY rowid DESC LIMIT 1",
      [subjectType, subjectId],
    );
  }

  history(subjectType: DecisionRow["subject_type"], subjectId: string): DecisionRow[] {
    return all<DecisionRow>(
      this.db,
      "SELECT * FROM autopilot_decisions WHERE subject_type = ? AND subject_id = ? ORDER BY rowid",
      [subjectType, subjectId],
    );
  }

  /** Returns true when a new row was written. */
  record(
    subjectType: DecisionRow["subject_type"],
    subjectId: string,
    decision: Decision,
    input: unknown,
    now: string,
    previous?: DecisionRow,
  ): boolean {
    const last = previous ?? this.latest(subjectType, subjectId);
    if (last && last.state === decision.state && last.rule === decision.rule) return false;
    const count = one<{ c: number }>(
      this.db,
      "SELECT COUNT(*) AS c FROM autopilot_decisions WHERE subject_type = ? AND subject_id = ?",
      [subjectType, subjectId],
    )!.c;
    run(
      this.db,
      `INSERT INTO autopilot_decisions (id, subject_type, subject_id, state, rule, reason, input_json, decided_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `apd_${subjectId}_${count + 1}`,
        subjectType,
        subjectId,
        decision.state,
        decision.rule,
        decision.reason,
        JSON.stringify(input),
        now,
      ],
    );
    if (subjectType === "exception") {
      audit(this.db, "autopilot", "autopilot.classify", subjectType, subjectId, {
        from: last?.state ?? null,
        to: decision.state,
        rule: decision.rule,
        reason: decision.reason,
        at: now,
      });
    }
    return true;
  }
}

function key(type: string, id: string) {
  return `${type}:${id}`;
}

export function decisionKey(type: DecisionRow["subject_type"], id: string) {
  return key(type, id);
}
