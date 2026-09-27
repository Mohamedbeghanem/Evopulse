import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { EVENT_TYPES, eventsFor, type BusinessEvent } from "../events";
import { id, IDS } from "../ids";
import type {
  CommitmentRow,
  EvidencePack,
  ExceptionRow,
  ExpectationRow,
} from "../types";
import {
  EXCEPTION_TYPES,
  canonicalExceptionType,
} from "./exception-types";
import {
  OPEN_EXPECTATION_STATUSES,
  TERMINAL_EXPECTATION_STATUSES,
  expectedEventOf,
  getExpectation,
  refreshExpectations,
} from "./expectations";
import { calculateImpact } from "./impact";

/**
 * Event-type aliases for matching. Control stores `customer.response`;
 * Event Layer emits `customer.replied`. Detect matches software-side only.
 */
export const MATCHER_EVENT_ALIASES: Record<string, string[]> = {
  "quote.sent": ["quote.sent", "commitment.fulfilled"],
  "commitment.fulfilled": ["commitment.fulfilled", "quote.sent"],
  "customer.decision": ["customer.decision"],
  "customer.response": ["customer.response", "customer.replied"],
  "customer.replied": ["customer.replied", "customer.response"],
  "shipment.arrived": ["shipment.arrived", "shipment.received"],
  "order.delivered": ["order.delivered"],
  "payment.received": ["payment.received"],
};

const OPEN_SET = new Set<string>(OPEN_EXPECTATION_STATUSES);
const TERMINAL_SET = new Set<string>(TERMINAL_EXPECTATION_STATUSES);

export function aliasesForExpectedEvent(expectedEvent: string): string[] {
  return MATCHER_EVENT_ALIASES[expectedEvent] || [expectedEvent];
}

export function eventMatchesExpected(eventType: string, expectedEvent: string): boolean {
  if (!expectedEvent) return false;
  return aliasesForExpectedEvent(expectedEvent).includes(eventType);
}

export function exceptionTypeForExpectation(exp: ExpectationRow): string {
  const expected = expectedEventOf(exp);
  if (expected === "payment.received" || expected === "payment.expected") return EXCEPTION_TYPES.LATE_PAYMENT;
  if (expected === "customer.response" || expected === "customer.replied" || expected === "customer.decision") {
    return EXCEPTION_TYPES.MISSING_RESPONSE;
  }
  if (expected === "shipment.arrived" || expected === "shipment.received") return EXCEPTION_TYPES.DELIVERY_DELAY;
  if (exp.source_type === "goal") return EXCEPTION_TYPES.GOAL_DRIFT;
  if (exp.type === "dependency" || exp.source_type === "workflow") return EXCEPTION_TYPES.DEPENDENCY_FAILURE;
  if (exp.source_type === "commitment" || expected === "quote.sent" || expected === "commitment.fulfilled") {
    return EXCEPTION_TYPES.MISSED_COMMITMENT;
  }
  return EXCEPTION_TYPES.UNEXPECTED_CHANGE;
}

export type VerificationMatcherSignal = {
  expected_event_type: string;
  status: "SUCCESS" | "FAILED";
  occurred_at: string;
  entity_id?: string | null;
  evidence?: Record<string, unknown>;
};

/**
 * Control can later feed VerificationService SUCCESS/FAIL into this matcher
 * for `expected_event_type` matches. Detect does not write the verifications table.
 */
export function applyVerificationOutcome(db: DatabaseSync, signal: VerificationMatcherSignal): ExpectationRow[] {
  return ExpectedEventMatcher.for(db).applyVerificationOutcome(signal);
}

export class ExpectedEventMatcher {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new ExpectedEventMatcher(db);
  }

  /** Dispatcher entry. Miss vs match is type/entity/clock — never LLM text. */
  onEvent(event: BusinessEvent) {
    if (event.type === EVENT_TYPES.TIME_ADVANCED) {
      const to = typeof event.payload.to === "string" ? event.payload.to : event.occurred_at;
      this.evaluateClock(to || event.received_at);
      return;
    }
    if (event.type === "verification.resolved" || event.type === "verification.failed") {
      const expectedEventType =
        typeof event.payload.expectedEventType === "string" ? event.payload.expectedEventType : "";
      const status = event.payload.status === "FAILED" || event.type === "verification.failed" ? "FAILED" : "SUCCESS";
      if (expectedEventType) {
        this.applyVerificationOutcome({
          expected_event_type: expectedEventType,
          status,
          occurred_at: event.occurred_at,
          entity_id: event.entity_id,
          evidence: typeof event.payload.evidence === "object" && event.payload.evidence
            ? (event.payload.evidence as Record<string, unknown>)
            : {},
        });
      }
      return;
    }
    this.matchEvent(event);
  }

  evaluateClock(now: string) {
    refreshExpectations(this.db, now);
    return this.raiseExceptionsForMisses(now);
  }

  matchEvent(event: BusinessEvent): ExpectationRow[] {
    const fulfilled: ExpectationRow[] = [];
    for (const exp of this.openExpectations()) {
      if (!eventMatchesExpected(event.type, expectedEventOf(exp))) continue;
      if (!this.entityScopeMatches(exp, event)) continue;
      const next = this.fulfill(exp, event);
      if (next) fulfilled.push(next);
    }
    return fulfilled;
  }

  applyVerificationOutcome(signal: VerificationMatcherSignal): ExpectationRow[] {
    const touched: ExpectationRow[] = [];
    for (const exp of this.openExpectations()) {
      if (!eventMatchesExpected(signal.expected_event_type, expectedEventOf(exp))) continue;
      if (signal.entity_id && exp.entity_id && signal.entity_id !== exp.entity_id) continue;
      if (signal.status === "SUCCESS") {
        const next = this.fulfill(exp, {
          id: `verification:${signal.expected_event_type}`,
          type: signal.expected_event_type,
          source: "verification-engine",
          source_id: null,
          actor_id: null,
          entity_type: null,
          entity_id: signal.entity_id ?? null,
          payload: signal.evidence || {},
          occurred_at: signal.occurred_at,
          received_at: signal.occurred_at,
          confidence: 1,
          metadata: { via: "verification-hook" },
        });
        if (next) touched.push(next);
        continue;
      }
      const missed = this.markMissed(
        exp,
        signal.occurred_at,
        "Verification FAILED — expected event did not arrive in time",
      );
      if (missed) {
        this.raiseException(missed, signal.occurred_at);
        touched.push(missed);
      }
    }
    return touched;
  }

  raiseExceptionsForMisses(now: string): ExceptionRow[] {
    const missed = all<ExpectationRow>(this.db, "SELECT * FROM expectations WHERE status = 'MISSED'");
    const created: ExceptionRow[] = [];
    for (const exp of missed) {
      const row = this.raiseException(exp, now);
      if (row) created.push(row);
    }
    return created;
  }

  private openExpectations(): ExpectationRow[] {
    return all<ExpectationRow>(this.db, "SELECT * FROM expectations").filter((row) => OPEN_SET.has(row.status));
  }

  private entityScopeMatches(exp: ExpectationRow, event: BusinessEvent): boolean {
    if (!exp.entity_id || !event.entity_id) return true;
    return (
      event.entity_id === exp.entity_id ||
      event.entity_id === exp.commitment_id ||
      event.entity_id === exp.source_id
    );
  }

  private fulfill(exp: ExpectationRow, event: BusinessEvent): ExpectationRow | undefined {
    if (TERMINAL_SET.has(exp.status) && exp.status === "CANCELLED") return undefined;
    if (exp.status === "FULFILLED") return getExpectation(this.db, exp.id);
    const now = event.received_at || event.occurred_at;
    const actual = `Matched ${event.type} (${event.id})`;
    run(
      this.db,
      "UPDATE expectations SET status = ?, actual = ?, updated_at = ?, resolved_at = ? WHERE id = ?",
      ["FULFILLED", actual, now, now, exp.id],
    );
    if (exp.commitment_id) {
      const commitment = one<CommitmentRow>(this.db, "SELECT * FROM commitments WHERE id = ?", [exp.commitment_id]);
      if (commitment && commitment.status !== "fulfilled" && commitment.status !== "cancelled") {
        run(this.db, "UPDATE commitments SET status = ? WHERE id = ?", ["fulfilled", exp.commitment_id]);
      }
    }
    return getExpectation(this.db, exp.id);
  }

  private markMissed(exp: ExpectationRow, now: string, actual: string): ExpectationRow | undefined {
    if (exp.status === "CANCELLED" || exp.status === "FULFILLED") return undefined;
    if (exp.status !== "MISSED") {
      run(
        this.db,
        "UPDATE expectations SET status = ?, actual = ?, updated_at = ?, resolved_at = ? WHERE id = ?",
        ["MISSED", actual, now, now, exp.id],
      );
    }
    return getExpectation(this.db, exp.id);
  }

  private raiseException(exp: ExpectationRow, now: string): ExceptionRow | undefined {
    const existing = one<ExceptionRow>(
      this.db,
      "SELECT * FROM exceptions WHERE expectation_id = ? AND status != 'resolved'",
      [exp.id],
    );
    if (existing) return undefined;

    const commitment = exp.commitment_id
      ? one<CommitmentRow>(this.db, "SELECT * FROM commitments WHERE id = ?", [exp.commitment_id])
      : undefined;
    const kind = exceptionTypeForExpectation(exp);
    const impact = calculateImpact(this.db);
    const evidence: EvidencePack = {
      source: commitment ? "Customer conversation" : "Expectation engine",
      quote: commitment?.evidence || "",
      expected: exp.description,
      actual: exp.actual || "No matching fulfilment event before deadline",
      deal: `${impact.revenueAssociated.toLocaleString("en-US")} ${impact.currency}`,
      confidence: exp.confidence ?? commitment?.confidence ?? 0.9,
    };
    const isOurs = commitment?.actor === "company" || exp.id === IDS.expectOurs;
    const exceptionId = exp.id === IDS.expectOurs ? IDS.excMissed : id("exc");
    const title = isOurs
      ? "Our commitment missed — revised proposal never sent"
      : kind === EXCEPTION_TYPES.MISSING_RESPONSE
        ? "Expected response did not arrive"
        : kind === EXCEPTION_TYPES.DELIVERY_DELAY
          ? "Expected delivery did not arrive"
          : kind === EXCEPTION_TYPES.LATE_PAYMENT
            ? "Expected payment did not arrive"
            : "Expected event missed";

    run(
      this.db,
      `INSERT INTO exceptions
        (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exceptionId,
        title,
        kind,
        exp.id,
        IDS.opportunity,
        isOurs ? "NEEDS_YOU" : "MONITORING",
        isOurs ? "critical" : "high",
        "high",
        JSON.stringify(impact),
        JSON.stringify(evidence),
        evidence.confidence,
        "open",
        now,
        now,
      ],
    );

    const events = eventsFor(this.db);
    if (canonicalExceptionType(kind) === EXCEPTION_TYPES.MISSED_COMMITMENT) {
      events.append({
        type: EVENT_TYPES.COMMITMENT_MISSED,
        source: "pulse-engine",
        source_id: exp.id,
        actor_id: commitment?.actor_entity_id || IDS.company,
        entity_type: "commitment",
        entity_id: commitment?.id || exp.commitment_id,
        payload: {
          expectationId: exp.id,
          expected: exp.description,
          actual: exp.actual || "No fulfilment event recorded",
        },
        occurred_at: exp.due_at,
        received_at: now,
        confidence: evidence.confidence,
        idempotent: true,
      });
    }
    events.append({
      type: EVENT_TYPES.EXCEPTION_CREATED,
      source: "pulse-engine",
      source_id: exceptionId,
      actor_id: commitment?.actor_entity_id || IDS.company,
      entity_type: "opportunity",
      entity_id: IDS.opportunity,
      payload: { kind, exceptionId, expectationId: exp.id },
      occurred_at: now,
      received_at: now,
      confidence: evidence.confidence,
      idempotent: true,
    });

    return one<ExceptionRow>(this.db, "SELECT * FROM exceptions WHERE id = ?", [exceptionId]);
  }
}

export function detectFromClock(db: DatabaseSync, now: string) {
  return ExpectedEventMatcher.for(db).evaluateClock(now);
}
