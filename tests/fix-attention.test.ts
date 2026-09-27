import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ExceptionAutopilotService } from "../lib/autopilot";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import { wipeAndSeed } from "../lib/seed";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-fixa-")), "fixa.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
resetDbFile();

const count = (sql: string, params: string[] = []) =>
  (getDb().prepare(sql).get(...params) as { c: number }).c;

describe("attention hardening", { concurrency: 1 }, () => {
  it("hooks evaluate on the demo clock, not on an event's own timestamp", () => {
    const db = getDb();
    wipeAndSeed(db);
    const now = getMeta(db, "demo_now");
    // Settle the state at the demo clock first, so only the event's timestamp differs.
    ExceptionAutopilotService.for(db).evaluateSituation(now);
    const exceptionsBefore = count("SELECT COUNT(*) AS c FROM exceptions");
    const statusOf = (id: string) =>
      (db.prepare("SELECT status FROM expectations WHERE id = ?").get(id) as { status: string }).status;
    const shipBefore = statusOf(IDS.expectShip);
    const deliverBefore = statusOf(IDS.expectDeliverA);

    // A reply stamped a week in the future must not move the business clock.
    eventsFor(db).append({
      type: EVENT_TYPES.CUSTOMER_REPLIED,
      source: "inbox",
      source_id: "test_future_reply",
      actor_id: IDS.contact,
      entity_type: "contact",
      entity_id: IDS.contact,
      payload: { text: "Late reply", from: "Amine Khelifi" },
      occurred_at: "2026-10-05T10:00:00+01:00",
      received_at: "2026-10-05T10:00:00+01:00",
      idempotent: true,
    });

    assert.equal(getMeta(db, "demo_now"), now);
    assert.equal(statusOf(IDS.expectShip), shipBefore);
    assert.equal(statusOf(IDS.expectDeliverA), deliverBefore);
    assert.notEqual(statusOf(IDS.expectShip), "MISSED");
    assert.notEqual(statusOf(IDS.expectDeliverA), "MISSED");
    assert.equal(count("SELECT COUNT(*) AS c FROM exceptions"), exceptionsBefore);
  });

  it("a human reject / take-over stays NEEDS_YOU across later evaluations", () => {
    const db = getDb();
    wipeAndSeed(db);
    const now = getMeta(db, "demo_now");
    const service = ExceptionAutopilotService.for(db);
    service.evaluateSituation(now);
    const id = `apd_exception_${IDS.excMissed}`;
    assert.equal(service.get(id)?.classification, "NEEDS_APPROVAL");

    service.reject(id, now);
    assert.equal(service.get(id)?.classification, "NEEDS_YOU");
    service.evaluateSituation(now);
    service.evaluateSituation(now);
    assert.equal(service.get(id)?.classification, "NEEDS_YOU", "reject must survive the next Pulse load");

    wipeAndSeed(db);
    service.evaluateSituation(now);
    service.takeOver(id, now);
    service.evaluateSituation(now);
    service.evaluateSituation(now);
    assert.equal(service.get(id)?.classification, "NEEDS_YOU", "take-over must survive the next Pulse load");
  });

  it("approve executes through the plan path and moves the card to MONITORING", () => {
    const db = getDb();
    wipeAndSeed(db);
    const now = getMeta(db, "demo_now");
    const service = ExceptionAutopilotService.for(db);
    service.evaluateSituation(now);
    const id = `apd_exception_${IDS.excMissed}`;
    service.reject(id, now);
    service.approve(id, now);

    const actions = db
      .prepare("SELECT id, status, policy_outcome FROM actions WHERE plan_id = ?")
      .all(IDS.planRecovery) as { id: string; status: string; policy_outcome: string }[];
    assert.ok(actions.length > 0);
    for (const action of actions) {
      if (action.policy_outcome !== "BLOCKED") assert.equal(action.status, "executed", action.id);
    }
    assert.equal(count("SELECT COUNT(*) AS c FROM verifications WHERE exception_id = ? AND status = 'PENDING'", [IDS.excMissed]), 1);
    assert.equal(service.get(id)?.classification, "MONITORING");
    service.evaluateSituation(now);
    assert.equal(service.get(id)?.classification, "MONITORING", "approved + executed never falls back to NEEDS_APPROVAL");
  });

  it("revenue comes from the exception's own impact, not a 320K constant", () => {
    const db = getDb();
    wipeAndSeed(db);
    const now = getMeta(db, "demo_now");
    db.prepare(
      `INSERT INTO exceptions (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at)
       VALUES ('exc_test_64k', 'Expected response did not arrive', 'missing_response', NULL, NULL, 'NEEDS_YOU', 'high', 'high', ?, '{}', 0.9, 'open', ?)`,
    ).run(JSON.stringify({ revenueAssociated: 64000, currency: "DZD" }), now);
    const service = ExceptionAutopilotService.for(db);
    service.evaluateSituation(now);
    const row = service.get("apd_exception_exc_test_64k");
    assert.ok(row);
    assert.equal(JSON.parse(row.impact_summary).associated_revenue, 64000);
    assert.match(JSON.parse(row.evidence).impact, /64,000/);
    const card = service.classify().find((item) => item.id === row.id);
    assert.equal(card?.associatedRevenue, 64000);
    // The 320K case still reads 320,000 — from its own impact_json.
    const miss = service.get(`apd_exception_${IDS.excMissed}`);
    assert.equal(JSON.parse(miss!.impact_summary).associated_revenue, 320000);
  });
});
