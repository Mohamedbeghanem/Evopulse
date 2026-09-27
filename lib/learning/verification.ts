import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { eventsFor } from "../events";
import { id } from "../ids";
import type { ActionRow, ExceptionRow } from "../types";
import { EXPECTED_EVENT_ALIASES, type VerificationRow, type VerificationStatus } from "./types";
import { addHours, isAtOrAfter } from "./time";

export const LEARNING_EVENT_TYPES = {
  VERIFICATION_CREATED: "verification.created",
  VERIFICATION_RESOLVED: "verification.resolved",
  VERIFICATION_FAILED: "verification.failed",
  OUTCOME_RECORDED: "outcome.recorded",
  FEEDBACK_RECORDED: "feedback.recorded",
} as const;

const VERIFIABLE_ACTION_TYPES = new Set(["draft_message", "send_message", "prepare_proposal"]);

export function isVerifiableAction(type: string): boolean {
  return VERIFIABLE_ACTION_TYPES.has(type);
}

export class VerificationService {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new VerificationService(db);
  }

  createVerification(input: {
    action_id: string;
    exception_id: string;
    expected_event_type?: string;
    expected_by?: string;
    now: string;
    success_condition?: Record<string, unknown>;
    failure_condition?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    strategy?: string;
  }): VerificationRow {
    const expectedEventType = input.expected_event_type || "customer.response";
    const pending = this.getPendingForException(input.exception_id, expectedEventType);
    if (pending) return pending;

    const expectedBy = input.expected_by || addHours(input.now, 24);
    const row: VerificationRow = {
      id: id("ver"),
      action_id: input.action_id,
      exception_id: input.exception_id,
      expected_event_type: expectedEventType,
      expected_by: expectedBy,
      status: "PENDING",
      success_condition: JSON.stringify(
        input.success_condition || { event_type: expectedEventType },
      ),
      failure_condition: JSON.stringify(input.failure_condition || { deadline_passed: true }),
      created_at: input.now,
      resolved_at: null,
      evidence: JSON.stringify({}),
      metadata: JSON.stringify({
        strategy: input.strategy || null,
        ...(input.metadata || {}),
      }),
    };

    run(
      this.db,
      `INSERT INTO verifications
        (id, action_id, exception_id, expected_event_type, expected_by, status,
         success_condition, failure_condition, created_at, resolved_at, evidence, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.action_id,
        row.exception_id,
        row.expected_event_type,
        row.expected_by,
        row.status,
        row.success_condition,
        row.failure_condition,
        row.created_at,
        row.resolved_at,
        row.evidence,
        row.metadata,
      ],
    );

    eventsFor(this.db).append({
      type: LEARNING_EVENT_TYPES.VERIFICATION_CREATED,
      source: "verification-engine",
      source_id: row.id,
      entity_type: "verification",
      entity_id: row.id,
      payload: {
        actionId: row.action_id,
        exceptionId: row.exception_id,
        expectedEventType: row.expected_event_type,
        expectedBy: row.expected_by,
      },
      occurred_at: input.now,
      received_at: input.now,
      confidence: 1,
      idempotent: true,
    });

    return this.getById(row.id)!;
  }

  getById(verificationId: string): VerificationRow | undefined {
    return one<VerificationRow>(this.db, "SELECT * FROM verifications WHERE id = ?", [verificationId]);
  }

  getPendingVerifications(exceptionId?: string): VerificationRow[] {
    if (exceptionId) {
      return all<VerificationRow>(
        this.db,
        "SELECT * FROM verifications WHERE status = 'PENDING' AND exception_id = ? ORDER BY created_at",
        [exceptionId],
      );
    }
    return all<VerificationRow>(
      this.db,
      "SELECT * FROM verifications WHERE status = 'PENDING' ORDER BY created_at",
    );
  }

  getPendingForException(exceptionId: string, expectedEventType?: string): VerificationRow | undefined {
    if (expectedEventType) {
      return one<VerificationRow>(
        this.db,
        "SELECT * FROM verifications WHERE exception_id = ? AND status = 'PENDING' AND expected_event_type = ?",
        [exceptionId, expectedEventType],
      );
    }
    return one<VerificationRow>(
      this.db,
      "SELECT * FROM verifications WHERE exception_id = ? AND status = 'PENDING'",
      [exceptionId],
    );
  }

  evaluateVerification(
    verificationId: string,
    incoming: { type: string; occurred_at: string; id?: string; payload?: Record<string, unknown> },
  ): VerificationRow {
    const verification = this.getById(verificationId);
    if (!verification) throw new Error("Verification not found");
    if (verification.status !== "PENDING") return verification;

    const aliases = EXPECTED_EVENT_ALIASES[verification.expected_event_type] || [
      verification.expected_event_type,
    ];
    if (!aliases.includes(incoming.type)) {
      return verification;
    }

    if (isAtOrAfter(incoming.occurred_at, verification.expected_by)) {
      return this.resolveVerification(verificationId, "FAILED", incoming.occurred_at, {
        reason: "Matching event arrived after the deadline.",
        eventId: incoming.id || null,
        eventType: incoming.type,
      });
    }

    return this.resolveVerification(verificationId, "SUCCESS", incoming.occurred_at, {
      reason: "Expected event arrived before the deadline.",
      eventId: incoming.id || null,
      eventType: incoming.type,
      payload: incoming.payload || {},
    });
  }

  resolveVerification(
    verificationId: string,
    status: Exclude<VerificationStatus, "PENDING">,
    now: string,
    evidence: Record<string, unknown> = {},
  ): VerificationRow {
    const verification = this.getById(verificationId);
    if (!verification) throw new Error("Verification not found");
    if (verification.status !== "PENDING") return verification;

    run(
      this.db,
      "UPDATE verifications SET status = ?, resolved_at = ?, evidence = ? WHERE id = ?",
      [status, now, JSON.stringify(evidence), verificationId],
    );

    const eventType =
      status === "FAILED"
        ? LEARNING_EVENT_TYPES.VERIFICATION_FAILED
        : LEARNING_EVENT_TYPES.VERIFICATION_RESOLVED;

    eventsFor(this.db).append({
      type: eventType,
      source: "verification-engine",
      source_id: verificationId,
      entity_type: "verification",
      entity_id: verificationId,
      payload: { status, exceptionId: verification.exception_id, actionId: verification.action_id, evidence },
      occurred_at: now,
      received_at: now,
      confidence: 1,
      idempotent: true,
    });

    return this.getById(verificationId)!;
  }

  failExpiredVerifications(now: string): VerificationRow[] {
    const pending = this.getPendingVerifications();
    const failed: VerificationRow[] = [];
    for (const verification of pending) {
      if (!isAtOrAfter(now, verification.expected_by)) continue;
      failed.push(
        this.resolveVerification(verification.id, "FAILED", now, {
          reason: "Deadline passed with no matching event.",
          expectedBy: verification.expected_by,
          now,
        }),
      );
    }
    return failed;
  }

  afterActionExecuted(action: ActionRow, now: string): VerificationRow | null {
    if (!isVerifiableAction(action.type)) return null;
    const payload = safeJson(action.payload);
    const strategy =
      typeof payload.strategy === "string" ? payload.strategy : inferStrategyFromAction(action);
    const target = verificationTargetFor(this.db, action);
    return this.createVerification({
      action_id: action.id,
      exception_id: action.exception_id,
      now,
      strategy,
      metadata: { actionType: action.type, planId: action.plan_id, ...(target ? { target } : {}) },
    });
  }
}

/** The party a verifiable action was aimed at. A reply only verifies an action sent to the party that replied. */
export type VerificationTarget = { entityId: string | null; name: string | null };

/**
 * Target of a verifiable action, from its own payload: `targetEntityId`, else `to`.
 * A `to` name is resolved to a single business entity (exact name, or the name followed by a word,
 * e.g. "Oran Fresh" → "Oran Fresh Market") so replies stamped with the entity id also match.
 * Returns null when the action names no party; such verifications keep accepting any reply.
 */
export function verificationTargetFor(db: DatabaseSync, action: ActionRow): VerificationTarget | null {
  const payload = safeJson(action.payload);
  const name = typeof payload.to === "string" && payload.to.trim() ? payload.to.trim() : null;
  let entityId = typeof payload.targetEntityId === "string" && payload.targetEntityId ? payload.targetEntityId : null;
  if (!entityId && name) {
    const matches = all<{ id: string }>(
      db,
      "SELECT id FROM entities WHERE lower(name) = lower(?) OR lower(name) LIKE lower(?) || ' %'",
      [name, name],
    );
    if (matches.length === 1) entityId = matches[0].id;
  }
  if (!entityId && !name) return null;
  return { entityId, name };
}

/** True when a reply event comes from the verification's target. Unscoped verifications accept any reply. */
export function replyMatchesTarget(
  verification: Pick<VerificationRow, "metadata">,
  event: { actor_id?: string | null; entity_id?: string | null; payload?: Record<string, unknown> },
): boolean {
  const target = safeJson(verification.metadata).target as VerificationTarget | null | undefined;
  if (!target || (!target.entityId && !target.name)) return true;
  if (target.entityId && (event.actor_id === target.entityId || event.entity_id === target.entityId)) return true;
  const from = typeof event.payload?.from === "string" ? event.payload.from.trim().toLowerCase() : "";
  return Boolean(target.name && from && from === target.name.toLowerCase());
}

export function inferStrategyFromAction(action: ActionRow): string {
  const payload = safeJson(action.payload);
  if (typeof payload.strategy === "string") return payload.strategy;
  if (action.type === "draft_message" || action.type === "send_message") {
    const body = `${action.description} ${JSON.stringify(payload)}`.toLowerCase();
    if (body.includes("amine") || body.includes("320") || body.includes("revised")) {
      return "personalized_followup";
    }
    return "generic_followup";
  }
  if (action.type === "prepare_proposal") return "personalized_followup";
  return "generic_followup";
}

export function markExceptionAwaitingVerification(db: DatabaseSync, exceptionId: string) {
  const exception = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [exceptionId]);
  if (!exception) return;
  if (exception.status === "resolved") return;
  run(db, "UPDATE exceptions SET status = ?, attention = ? WHERE id = ?", [
    "awaiting_verification",
    "MONITORING",
    exceptionId,
  ]);
}

export function applyVerificationToException(db: DatabaseSync, verification: VerificationRow) {
  if (verification.status === "SUCCESS") {
    run(db, "UPDATE exceptions SET status = ?, attention = ? WHERE id = ?", [
      "resolved",
      "HANDLED",
      verification.exception_id,
    ]);
    return;
  }
  if (verification.status === "FAILED") {
    run(db, "UPDATE exceptions SET status = ?, attention = ? WHERE id = ?", [
      "open",
      "NEEDS_YOU",
      verification.exception_id,
    ]);
  }
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
