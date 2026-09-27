import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, one, resetDbFile } from "../lib/db";
import { upsertExpectation } from "../lib/engine/expectations";
import { EXCEPTION_TYPES } from "../lib/engine/exception-types";
import {
  ExpectedEventMatcher,
  applyVerificationOutcome,
  eventMatchesExpected,
} from "../lib/engine/matcher";
import { pulseSummary } from "../lib/engine/pulse";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import type { ExceptionRow, ExpectationRow } from "../lib/types";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-match-")), "matcher.db");
resetDbFile();

describe("ExpectedEventMatcher", { concurrency: 1 }, () => {
  it("keeps the 320K seed miss + PLAN fields intact", () => {
    const db = getDb();
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.match(pulse.headline, /320/);
    const miss = pulse.exceptions.find((e) => e.id === IDS.excMissed);
    assert.ok(miss);
    assert.equal(miss?.kind, EXCEPTION_TYPES.MISSED_COMMITMENT);
    assert.equal(miss?.type, EXCEPTION_TYPES.MISSED_COMMITMENT);
    assert.ok(miss?.detected_at);

    const exp = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectOurs]);
    assert.ok(exp);
    assert.equal(exp?.status, "MISSED");
    assert.equal(exp?.expected_event, "quote.sent");
    assert.equal(exp?.source_type, "commitment");
    assert.equal(exp?.source_id, IDS.commitOurs);
    assert.equal(exp?.entity_id, IDS.opportunity);
    assert.ok(exp?.expected_at);
  });

  it("fulfills an open expectation when a matching event type arrives — no LLM", () => {
    const db = getDb();
    upsertExpectation(db, {
      id: "exp_pay_match",
      commitment_id: "",
      description: "Atlas payment received",
      due_at: "2026-10-02T17:00:00+01:00",
      status: "ON_TRACK",
      created_at: getMeta(db, "demo_now"),
      type: "event",
      entity_id: IDS.opportunity,
      expected_event: "payment.received",
      source_type: "manual",
      source_id: "manual_pay",
      confidence: 1,
      condition: { event_type: "payment.received" },
    });

    const event = eventsFor(db).append({
      type: EVENT_TYPES.PAYMENT_RECEIVED,
      source: "test",
      source_id: "pay_match_1",
      entity_type: "opportunity",
      entity_id: IDS.opportunity,
      payload: { amount: 320000 },
      occurred_at: getMeta(db, "demo_now"),
      received_at: getMeta(db, "demo_now"),
    });

    const exp = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", ["exp_pay_match"]);
    assert.equal(exp?.status, "FULFILLED");
    assert.match(exp?.actual || "", /payment.received/);
    assert.equal(exp?.resolved_at, event.received_at);
  });

  it("does not fulfill from message text — type mismatch is a miss", () => {
    const db = getDb();
    upsertExpectation(db, {
      id: "exp_pay_nomatch",
      commitment_id: "",
      description: "Payment still expected",
      due_at: "2026-10-02T17:00:00+01:00",
      status: "ON_TRACK",
      created_at: getMeta(db, "demo_now"),
      expected_event: "payment.received",
      entity_id: IDS.opportunity,
      source_type: "manual",
      source_id: "manual_pay_2",
    });

    eventsFor(db).append({
      type: EVENT_TYPES.MESSAGE_RECEIVED,
      source: "test",
      source_id: "msg_claims_paid",
      entity_type: "opportunity",
      entity_id: IDS.opportunity,
      payload: { text: "We sent the payment of 320,000 DZD just now." },
      occurred_at: getMeta(db, "demo_now"),
      received_at: getMeta(db, "demo_now"),
    });

    const exp = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", ["exp_pay_nomatch"]);
    assert.equal(exp?.status, "ON_TRACK");
    assert.equal(eventMatchesExpected(EVENT_TYPES.MESSAGE_RECEIVED, "payment.received"), false);
  });

  it("marks MISSED and creates a typed exception when the deadline passes with no event", () => {
    const db = getDb();
    upsertExpectation(db, {
      id: "exp_deadline_miss",
      commitment_id: "",
      description: "Follow-up quote send",
      due_at: "2026-09-20T18:00:00+01:00",
      status: "ON_TRACK",
      created_at: "2026-09-18T10:00:00+01:00",
      expected_event: "quote.sent",
      expected_at: "2026-09-20T18:00:00+01:00",
      entity_id: IDS.opportunity,
      source_type: "commitment",
      source_id: "cmt_deadline_miss",
      confidence: 0.9,
    });

    const created = ExpectedEventMatcher.for(db).evaluateClock(getMeta(db, "demo_now"));
    const exp = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", ["exp_deadline_miss"]);
    assert.equal(exp?.status, "MISSED");
    assert.ok(exp?.resolved_at);
    const exception = one<ExceptionRow>(
      db,
      "SELECT * FROM exceptions WHERE expectation_id = ?",
      ["exp_deadline_miss"],
    );
    assert.ok(exception);
    assert.equal(exception?.kind, EXCEPTION_TYPES.MISSED_COMMITMENT);
    assert.ok(created.some((row) => row.id === exception?.id));
    assert.ok(exception?.detected_at);
  });

  it("applyVerificationOutcome SUCCESS fulfills a matching expected_event — Control hook", () => {
    const db = getDb();
    upsertExpectation(db, {
      id: "exp_verify_hook",
      commitment_id: "",
      description: "Customer response after follow-up",
      due_at: "2026-09-28T10:00:00+01:00",
      status: "ON_TRACK",
      created_at: getMeta(db, "demo_now"),
      expected_event: "customer.response",
      entity_id: IDS.contact,
      source_type: "verification",
      source_id: "ver_hook",
    });

    const touched = applyVerificationOutcome(db, {
      expected_event_type: "customer.replied",
      status: "SUCCESS",
      occurred_at: getMeta(db, "demo_now"),
      entity_id: IDS.contact,
    });

    assert.equal(touched.length, 1);
    assert.equal(touched[0].status, "FULFILLED");
    const exp = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", ["exp_verify_hook"]);
    assert.equal(exp?.status, "FULFILLED");
  });

  it("is idempotent — a second clock sweep does not duplicate the exception", () => {
    const db = getDb();
    const matcher = ExpectedEventMatcher.for(db);
    matcher.evaluateClock(getMeta(db, "demo_now"));
    matcher.evaluateClock(getMeta(db, "demo_now"));
    const rows = db
      .prepare("SELECT COUNT(*) AS c FROM exceptions WHERE expectation_id = ?")
      .get("exp_deadline_miss") as { c: number };
    assert.equal(rows.c, 1);
  });
});
