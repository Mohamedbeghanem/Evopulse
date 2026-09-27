import type { DatabaseSync } from "node:sqlite";
import { parseIso } from "../clock";
import { all, one, run } from "../db";
import { id } from "../ids";
import type {
  CommitmentRow,
  ExpectationRow,
  ExpectationSourceType,
  ExpectationStatus,
} from "../types";

export const OPEN_EXPECTATION_STATUSES: ExpectationStatus[] = [
  "ON_TRACK",
  "UPCOMING",
  "AT_RISK",
  "BLOCKED",
  "MISSED",
];

export const TERMINAL_EXPECTATION_STATUSES: ExpectationStatus[] = ["FULFILLED", "CANCELLED"];

/** Commitment action → expected business event. Software-owned; not LLM output. */
export const EXPECTED_EVENT_FROM_ACTION: Record<string, string> = {
  send_revised_proposal: "quote.sent",
  provide_decision: "customer.decision",
  receive_shipment: "shipment.arrived",
  deliver_order: "order.delivered",
};

export type ExpectationWrite = {
  id?: string;
  commitment_id?: string;
  description: string;
  due_at: string;
  status?: ExpectationStatus;
  actual?: string;
  created_at: string;
  updated_at?: string;
  type?: string;
  entity_id?: string | null;
  expected_event?: string;
  expected_at?: string;
  source_type?: ExpectationSourceType | string;
  source_id?: string | null;
  confidence?: number;
  condition?: string | Record<string, unknown>;
  resolved_at?: string | null;
};

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

export function expectedAtOf(row: ExpectationRow): string {
  return row.expected_at || row.due_at;
}

export function expectedEventOf(row: ExpectationRow): string {
  return row.expected_event || "";
}

export function inferredExpectedEvent(action: string): string {
  return EXPECTED_EVENT_FROM_ACTION[action] || "";
}

export function getExpectation(db: DatabaseSync, expectationId: string): ExpectationRow | undefined {
  return one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [expectationId]);
}

export function listExpectations(db: DatabaseSync, status?: ExpectationStatus): ExpectationRow[] {
  if (status) return all<ExpectationRow>(db, "SELECT * FROM expectations WHERE status = ?", [status]);
  return all<ExpectationRow>(db, "SELECT * FROM expectations");
}

export function upsertExpectation(db: DatabaseSync, input: ExpectationWrite): ExpectationRow {
  const sourceType = input.source_type || "commitment";
  const sourceId = input.source_id ?? input.commitment_id ?? "";
  const commitmentId = input.commitment_id || sourceId || "";
  const dueAt = input.due_at;
  const expectedAt = input.expected_at || dueAt;
  const expectedEvent = input.expected_event || "";
  const condition =
    typeof input.condition === "string" ? input.condition : JSON.stringify(input.condition ?? {});
  const rowId = input.id || id("exp");
  const updatedAt = input.updated_at || input.created_at;
  const status = input.status || "ON_TRACK";

  run(
    db,
    `INSERT INTO expectations
      (id, commitment_id, description, due_at, status, actual, created_at, updated_at,
       type, entity_id, expected_event, expected_at, source_type, source_id, confidence, condition, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       commitment_id = excluded.commitment_id,
       description = excluded.description,
       due_at = excluded.due_at,
       status = excluded.status,
       actual = excluded.actual,
       updated_at = excluded.updated_at,
       type = excluded.type,
       entity_id = excluded.entity_id,
       expected_event = excluded.expected_event,
       expected_at = excluded.expected_at,
       source_type = excluded.source_type,
       source_id = excluded.source_id,
       confidence = excluded.confidence,
       condition = excluded.condition,
       resolved_at = excluded.resolved_at`,
    [
      rowId,
      commitmentId,
      input.description,
      dueAt,
      status,
      input.actual || "",
      input.created_at,
      updatedAt,
      input.type || "event",
      input.entity_id ?? null,
      expectedEvent,
      expectedAt,
      sourceType,
      sourceId,
      input.confidence ?? 1,
      condition,
      input.resolved_at ?? null,
    ],
  );
  return getExpectation(db, rowId)!;
}

export function markExpectationResolved(
  db: DatabaseSync,
  expectationId: string,
  status: Extract<ExpectationStatus, "FULFILLED" | "CANCELLED" | "MISSED">,
  now: string,
  actual: string,
) {
  run(db, "UPDATE expectations SET status = ?, actual = ?, updated_at = ?, resolved_at = ? WHERE id = ?", [
    status,
    actual,
    now,
    now,
    expectationId,
  ]);
  return getExpectation(db, expectationId);
}

/** How many times the cascade may be re-derived before we accept it as settled. */
const MAX_CASCADE_PASSES = 50;

/**
 * Recompute every expectation's status from the clock, its commitment, and its prerequisites.
 *
 * Statuses cascade: a prerequisite turning MISSED blocks its dependents, which can in turn block
 * theirs. The prerequisite statuses used to be snapshotted from the database before the update
 * loop ran, so a status decided during the loop was invisible to the rows after it and the cascade
 * only settled on a second call — callers papered over that by invoking this twice. The derivation
 * now runs against an in-memory working set and repeats until nothing changes, so one call
 * converges. Only rows whose status actually moved are written, once.
 *
 * Every lookup is also hoisted out of the loop. The prerequisite of each dependency and the
 * "deadline was revised" flag were each a separate SELECT per row, so this cost O(dependencies +
 * expectations) queries per refresh; it is now a fixed four reads regardless of table size.
 */
export function refreshExpectations(db: DatabaseSync, now: string) {
  const rows = all<ExpectationRow>(db, "SELECT * FROM expectations");
  if (!rows.length) return;
  const commitments = new Map(
    all<CommitmentRow>(db, "SELECT * FROM commitments").map((c) => [c.id, c]),
  );
  const dependencies = all<{ to_id: string; from_id: string }>(
    db,
    "SELECT to_id, from_id FROM dependencies WHERE from_type = 'expectation' OR from_type = 'commitment'",
  );
  // One read instead of one per expectation.
  const revisedIds = new Set(
    all<{ expectation_id: string }>(
      db,
      "SELECT DISTINCT expectation_id FROM expectation_changes",
    ).map((r) => r.expectation_id),
  );

  // Resolve each dependency's prerequisite from the rows already in hand. Mirrors the previous
  // "WHERE id = ? OR commitment_id = ?" single-row lookup: an id match wins, otherwise the first
  // row carrying that commitment id.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byCommitment = new Map<string, ExpectationRow>();
  for (const row of rows) {
    if (row.commitment_id && !byCommitment.has(row.commitment_id)) byCommitment.set(row.commitment_id, row);
  }
  const prereqOf = new Map<string, ExpectationRow[]>();
  for (const d of dependencies) {
    const prereq = byId.get(d.to_id) ?? byCommitment.get(d.to_id);
    if (!prereq) continue;
    const list = prereqOf.get(d.from_id);
    if (list) list.push(prereq);
    else prereqOf.set(d.from_id, [prereq]);
  }

  // The working status of every row. Seeded from the database, then iterated to a fixed point.
  const status = new Map(rows.map((row) => [row.id, row.status]));
  const statusOf = (row: ExpectationRow) => status.get(row.id) ?? row.status;

  const derive = (row: ExpectationRow): ExpectationStatus => {
    const commitment = commitments.get(row.commitment_id);
    const own = statusOf(row);
    const fulfilled = own === "FULFILLED";
    const cancelled = commitment?.status === "cancelled" || own === "CANCELLED";

    // Per dependent: a MISSED/BLOCKED prerequisite blocks it; an open prerequisite expected after
    // the dependent's own deadline puts it at risk.
    let blocked = false;
    let blockerDue: string | undefined;
    let prereqDue: string | undefined;
    for (const prereq of [...(prereqOf.get(row.id) ?? []), ...(prereqOf.get(row.commitment_id) ?? [])]) {
      const prereqStatus = statusOf(prereq);
      const prereqAt = expectedAtOf(prereq);
      if (prereqStatus === "MISSED" || prereqStatus === "BLOCKED") {
        blocked = true;
        if (!blockerDue || parseIso(prereqAt) < parseIso(blockerDue)) blockerDue = prereqAt;
      } else if (prereqStatus !== "FULFILLED" && prereqStatus !== "CANCELLED") {
        if (!prereqDue || parseIso(prereqAt) > parseIso(prereqDue)) prereqDue = prereqAt;
      }
    }

    const derived = deriveExpectationStatus({
      dueAt: expectedAtOf(row),
      now,
      fulfilled,
      blocked: blocked && !fulfilled,
      cancelled,
    });
    // A revised deadline, or a prerequisite expected after this deadline, is a risk signal. It raises
    // ON_TRACK/UPCOMING to AT_RISK but never masks MISSED/BLOCKED — the revised date still follows the clock.
    const revised = revisedIds.has(row.id);
    const prereqLate = Boolean(prereqDue && parseIso(prereqDue) > parseIso(expectedAtOf(row)));
    // Never relabel a real miss as BLOCKED: keep MISSED if it was already MISSED, or if this deadline passed
    // before the blocking prerequisite's own deadline (it missed first). A dependent whose prerequisite
    // missed first (the 320K Friday decision after the Thursday proposal) stays BLOCKED.
    const missedFirst =
      parseIso(expectedAtOf(row)) < parseIso(now) &&
      Boolean(blockerDue && parseIso(expectedAtOf(row)) < parseIso(blockerDue));
    const keepMissed = derived === "BLOCKED" && (own === "MISSED" || missedFirst);
    if (keepMissed) return "MISSED";
    if ((revised || prereqLate) && (derived === "ON_TRACK" || derived === "UPCOMING")) return "AT_RISK";
    return derived;
  };

  // Settle the cascade in memory. Each pass can only move rows further along
  // open -> AT_RISK -> BLOCKED/MISSED, so this converges; the cap is a guard, not the mechanism.
  for (let pass = 0; pass < MAX_CASCADE_PASSES; pass += 1) {
    let changed = false;
    for (const row of rows) {
      const next = derive(row);
      if (next !== statusOf(row)) {
        status.set(row.id, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const row of rows) {
    const next = statusOf(row);
    if (next === row.status) continue;
    const actual =
      next === "MISSED"
        ? "No matching fulfilment event before deadline"
        : next === "BLOCKED"
          ? "Blocked by a missed prerequisite"
          : row.actual;
    const resolvedAt =
      next === "FULFILLED" || next === "CANCELLED" || next === "MISSED" ? now : row.resolved_at ?? null;
    run(
      db,
      "UPDATE expectations SET status = ?, actual = ?, updated_at = ?, resolved_at = ? WHERE id = ?",
      [next, actual, now, resolvedAt, row.id],
    );
  }
}
