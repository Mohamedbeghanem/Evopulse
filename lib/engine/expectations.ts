import type { DatabaseSync } from "node:sqlite";
import { parseIso } from "../clock";
import { all, one, run } from "../db";
import type { CommitmentRow, ExpectationRow, ExpectationStatus } from "../types";

function hoursUntil(dueIso: string, nowIso: string): number {
  return (parseIso(dueIso).getTime() - parseIso(nowIso).getTime()) / 36e5;
}

/** Deterministic expectation state. AI never writes this directly. */
export function deriveExpectationStatus(input: {
  dueAt: string;
  now: string;
  fulfilled: boolean;
  blocked: boolean;
  cancelled: boolean;
}): ExpectationStatus {
  if (input.cancelled) return "CANCELLED";
  if (input.fulfilled) return "FULFILLED";
  if (input.blocked) return "BLOCKED";
  const h = hoursUntil(input.dueAt, input.now);
  if (h < 0) return "MISSED";
  if (h <= 24) return "AT_RISK";
  if (h <= 72) return "UPCOMING";
  return "ON_TRACK";
}

export function refreshExpectations(db: DatabaseSync, now: string) {
  const rows = all<ExpectationRow>(db, "SELECT * FROM expectations");
  const commitments = new Map(
    all<CommitmentRow>(db, "SELECT * FROM commitments").map((c) => [c.id, c]),
  );
  const blockedPrereqs = new Set(
    all<{ to_id: string; from_id: string }>(
      db,
      "SELECT to_id, from_id FROM dependencies WHERE from_type = 'expectation' OR from_type = 'commitment'",
    ).flatMap((d) => {
      const prereq =
        one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ? OR commitment_id = ?", [d.to_id, d.to_id]);
      if (prereq && (prereq.status === "MISSED" || prereq.status === "BLOCKED")) return [d.from_id];
      return [];
    }),
  );

  for (const row of rows) {
    const commitment = commitments.get(row.commitment_id);
    const fulfilled = row.status === "FULFILLED";
    const cancelled = commitment?.status === "cancelled" || row.status === "CANCELLED";
    const blocked = blockedPrereqs.has(row.id) || blockedPrereqs.has(row.commitment_id);
    const next = deriveExpectationStatus({
      dueAt: row.due_at,
      now,
      fulfilled,
      blocked: blocked && !fulfilled,
      cancelled,
    });
    if (next !== row.status) {
      const actual =
        next === "MISSED"
          ? "No matching fulfilment event before deadline"
          : next === "BLOCKED"
            ? "Blocked by a missed prerequisite"
            : row.actual;
      run(db, "UPDATE expectations SET status = ?, actual = ?, updated_at = ? WHERE id = ?", [
        next,
        actual,
        now,
        row.id,
      ]);
    }
  }
}
