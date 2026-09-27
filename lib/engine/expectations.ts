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
  // Prerequisite state per dependent (keyed by expectation id or commitment id):
  // a MISSED/BLOCKED prerequisite blocks it; an open prerequisite due after the
  // dependent's own deadline puts it at risk.
  const blockedPrereqs = new Set<string>();
  const latestPrereqDue = new Map<string, string>();
  for (const d of all<{ to_id: string; from_id: string }>(
    db,
    "SELECT to_id, from_id FROM dependencies WHERE from_type = 'expectation' OR from_type = 'commitment'",
  )) {
    const prereq = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ? OR commitment_id = ?", [
      d.to_id,
      d.to_id,
    ]);
    if (!prereq) continue;
    if (prereq.status === "MISSED" || prereq.status === "BLOCKED") blockedPrereqs.add(d.from_id);
    else if (prereq.status !== "FULFILLED" && prereq.status !== "CANCELLED") {
      const current = latestPrereqDue.get(d.from_id);
      if (!current || parseIso(prereq.due_at) > parseIso(current)) latestPrereqDue.set(d.from_id, prereq.due_at);
    }
  }

  for (const row of rows) {
    const commitment = commitments.get(row.commitment_id);
    const fulfilled = commitment?.status === "fulfilled" || row.status === "FULFILLED";
    const cancelled = commitment?.status === "cancelled";
    const blocked = blockedPrereqs.has(row.id) || blockedPrereqs.has(row.commitment_id);
    const derived = deriveExpectationStatus({
      dueAt: row.due_at,
      now,
      fulfilled,
      blocked: blocked && !fulfilled,
      cancelled: Boolean(cancelled),
    });
    // A revised due date or a prerequisite scheduled after this deadline is a risk
    // signal. It raises ON_TRACK/UPCOMING to AT_RISK but never masks MISSED/BLOCKED.
    const revised = Boolean(one(db, "SELECT id FROM expectation_changes WHERE expectation_id = ?", [row.id]));
    const prereqDue = latestPrereqDue.get(row.id) ?? latestPrereqDue.get(row.commitment_id);
    const prereqLate = Boolean(prereqDue && parseIso(prereqDue) > parseIso(row.due_at));
    const next =
      (revised || prereqLate) && (derived === "ON_TRACK" || derived === "UPCOMING") ? "AT_RISK" : derived;
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
