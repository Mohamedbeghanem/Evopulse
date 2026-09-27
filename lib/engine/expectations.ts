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

export function refreshExpectations(db: DatabaseSync, now: string) {
  const rows = all<ExpectationRow>(db, "SELECT * FROM expectations");
  const commitments = new Map(
    all<CommitmentRow>(db, "SELECT * FROM commitments").map((c) => [c.id, c]),
  );
  // Per dependent (expectation id or commitment id): a MISSED/BLOCKED prerequisite blocks it;
  // an open prerequisite expected after the dependent's own deadline puts it at risk.
  const blockedPrereqs = new Set<string>();
  const latestPrereqDue = new Map<string, string>();
  for (const d of all<{ to_id: string; from_id: string }>(
    db,
    "SELECT to_id, from_id FROM dependencies WHERE from_type = 'expectation' OR from_type = 'commitment'",
  )) {
    const prereq =
      one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ? OR commitment_id = ?", [d.to_id, d.to_id]);
    if (!prereq) continue;
    if (prereq.status === "MISSED" || prereq.status === "BLOCKED") blockedPrereqs.add(d.from_id);
    else if (prereq.status !== "FULFILLED" && prereq.status !== "CANCELLED") {
      const current = latestPrereqDue.get(d.from_id);
      if (!current || parseIso(expectedAtOf(prereq)) > parseIso(current)) latestPrereqDue.set(d.from_id, expectedAtOf(prereq));
    }
  }

  for (const row of rows) {
    const commitment = commitments.get(row.commitment_id);
    const fulfilled = row.status === "FULFILLED";
    const cancelled = commitment?.status === "cancelled" || row.status === "CANCELLED";
    const blocked = blockedPrereqs.has(row.id) || blockedPrereqs.has(row.commitment_id);
    const derived = deriveExpectationStatus({
      dueAt: expectedAtOf(row),
      now,
      fulfilled,
      blocked: blocked && !fulfilled,
      cancelled,
    });
    // A revised deadline, or a prerequisite expected after this deadline, is a risk signal. It raises
    // ON_TRACK/UPCOMING to AT_RISK but never masks MISSED/BLOCKED — the revised date still follows the clock.
    const revised = Boolean(one(db, "SELECT id FROM expectation_changes WHERE expectation_id = ?", [row.id]));
    const prereqDue = latestPrereqDue.get(row.id) ?? latestPrereqDue.get(row.commitment_id);
    const prereqLate = Boolean(prereqDue && parseIso(prereqDue) > parseIso(expectedAtOf(row)));
    const next = (revised || prereqLate) && (derived === "ON_TRACK" || derived === "UPCOMING") ? "AT_RISK" : derived;
    if (next !== row.status) {
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
}
