import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ExceptionAutopilotService, classifySituation, type AutopilotCard } from "../lib/autopilot";
import { getDb, getMeta, resetDbFile, run } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { calculateGraphImpact } from "../lib/engine/impact";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { EVENT_TYPES, EventRepository, eventsFor } from "../lib/events";
import { createGoal } from "../lib/goals";
import { IDS } from "../lib/ids";
import { expireAndRecord, VerificationService } from "../lib/learning";
import { wipeAndSeed } from "../lib/seed";
import { EarlyWarningEngine, DELIVER_A_WARNING_ID } from "../lib/warnings";
import { SHIP_EXPECTED_ISO } from "../lib/clock";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-auto-")), "autopilot.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
resetDbFile();

const AFTER_DEADLINE = "2026-09-29T10:01:00+01:00";

describe("exception autopilot", { concurrency: 1 }, () => {
  it("NORMAL: no warning and no exception requires no intervention", () => {
    const result = classifySituation({
      hasException: false,
      isSupplierCascade: false,
      affectedOrders: 0,
      associatedRevenue: 0,
      warningActive: false,
      deadlineFuture: true,
      hasPlan: false,
      hasApprovalRequired: false,
      hasFinancialApproval: false,
      hasBlockedAction: false,
      hasAutoExecuted: false,
      verificationStatus: null,
    });
    assert.equal(result.classification, "NORMAL");
    assert.equal(result.reasonCode, "NO_INTERVENTION_REQUIRED");
  });

  it("EARLY WARNING: future AT RISK is MONITORING, not missed", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const now = getMeta(db, "demo_now");
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(now);
    const warning = snapshot.cards.find((card: AutopilotCard) => card.warningId === DELIVER_A_WARNING_ID);
    assert.ok(warning);
    assert.equal(warning.classification, "MONITORING");
    assert.equal(warning.reasonCode, "EARLY_WARNING_MONITORING");
    assert.notEqual(warning.classification, "HANDLED");
    const row = EarlyWarningEngine.for(db).get(DELIVER_A_WARNING_ID);
    assert.notEqual(row?.status, "ESCALATED");
  });

  it("SAFE AUTO: internal checkpoint executes exactly once as AUTO_HANDLED", () => {
    const db = getDb();
    wipeAndSeed(db);
    const now = getMeta(db, "demo_now");
    const service = ExceptionAutopilotService.for(db);
    service.evaluateSituation(now);
    const first = service.handleSafe(now);
    assert.ok(first.handleSafe.executed.includes(IDS.actCheck));
    const checkpoint = service.listDecisions().find((row) => row.action_id === IDS.actCheck);
    assert.equal(checkpoint?.classification, "AUTO_HANDLED");
    const second = service.handleSafe(now);
    assert.ok(!second.handleSafe.executed.includes(IDS.actCheck));
    const checks = service.listDecisions().filter((row) => row.action_id === IDS.actCheck);
    assert.equal(checks.length, 1);
  });

  it("320K APPROVAL: external follow-up is NEEDS_APPROVAL and not executed", () => {
    const db = getDb();
    wipeAndSeed(db);
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    const card = snapshot.cards.find((item: AutopilotCard) => item.exceptionId === IDS.excMissed);
    assert.ok(card);
    assert.equal(card.classification, "NEEDS_APPROVAL");
    assert.equal(card.reasonCode, "EXTERNAL_ACTION_REQUIRES_APPROVAL");
    const draft = db.prepare("SELECT * FROM actions WHERE id = ?").get(IDS.actDraft) as { status: string };
    assert.notEqual(draft.status, "executed");
  });

  it("10% BLOCK: policy_blocked stays BLOCKED with 5% intact", async () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    const card = snapshot.cards.find((item: AutopilotCard) => item.exceptionId === IDS.excDiscount);
    assert.ok(card);
    assert.equal(card.classification, "BLOCKED");
    assert.equal(card.reasonCode, "POLICY_BLOCKED");
    const max = db.prepare("SELECT value FROM policies WHERE key = ?").get("discount_max") as { value: string };
    assert.equal(max.value, "5");
  });

  it("SUPPLIER NEEDS YOU: cascade is a human tradeoff, impact from graph", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const impact = calculateGraphImpact(db, IDS.shipment);
    assert.equal(impact.affected_orders.length, 3);
    assert.equal(impact.affected_customers.length, 3);
    assert.equal(impact.associated_revenue, 850000);
    assert.equal(impact.affected_expected_cash, 540000);
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    const card = snapshot.cards.find((item: AutopilotCard) => item.exceptionId === IDS.excDelay);
    assert.ok(card);
    assert.equal(card.classification, "NEEDS_YOU");
    assert.equal(card.reasonCode, "HIGH_IMPACT_HUMAN_JUDGMENT");
    assert.equal(card.associatedRevenue, 850000);
  });

  it("EXECUTED != SOLVED: verification pending is MONITORING", () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    const pending = VerificationService.for(db).getPendingVerifications(IDS.excMissed);
    assert.ok(pending.length >= 1);
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    const card = snapshot.cards.find((item: AutopilotCard) => item.exceptionId === IDS.excMissed);
    assert.equal(card?.classification, "MONITORING");
    assert.equal(card?.reasonCode, "VERIFICATION_PENDING");
  });

  it("VERIFICATION SUCCESS: only then HANDLED", async () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    const recovered = snapshot.cards.find((item: AutopilotCard) => item.exceptionId === IDS.excMissed);
    assert.equal(recovered?.classification, "HANDLED");
    assert.equal(recovered?.reasonCode, "VERIFIED_RESOLVED");
  });

  it("VERIFICATION FAILURE: re-evaluates to NEEDS_YOU, not HANDLED", () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    expireAndRecord(db, "2026-09-29T12:00:00+01:00");
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation("2026-09-29T12:00:00+01:00");
    const card = snapshot.cards.find((item: AutopilotCard) => item.exceptionId === IDS.excMissed);
    assert.equal(card?.classification, "NEEDS_YOU");
    assert.equal(card?.reasonCode, "VERIFICATION_FAILED");
    assert.notEqual(card?.classification, "HANDLED");
  });

  it("IDEMPOTENCY: evaluate twice does not duplicate plans or decisions", () => {
    const db = getDb();
    wipeAndSeed(db);
    const service = ExceptionAutopilotService.for(db);
    const now = getMeta(db, "demo_now");
    service.evaluateSituation(now);
    const plans1 = (db.prepare("SELECT COUNT(*) as c FROM plans").get() as { c: number }).c;
    const actions1 = (db.prepare("SELECT COUNT(*) as c FROM actions").get() as { c: number }).c;
    const decisions1 = service.listDecisions().length;
    service.evaluateSituation(now);
    assert.equal((db.prepare("SELECT COUNT(*) as c FROM plans").get() as { c: number }).c, plans1);
    assert.equal((db.prepare("SELECT COUNT(*) as c FROM actions").get() as { c: number }).c, actions1);
    assert.equal(service.listDecisions().length, decisions1);
  });

  it("HANDLE SAFE: only AUTO executes among mixed policy outcomes", () => {
    const db = getDb();
    wipeAndSeed(db);
    const result = ExceptionAutopilotService.for(db).handleSafe(getMeta(db, "demo_now"));
    const prepare = db.prepare("SELECT status FROM actions WHERE id = ?").get(IDS.actPrepare) as { status: string };
    const draft = db.prepare("SELECT status, policy_outcome FROM actions WHERE id = ?").get(IDS.actDraft) as {
      status: string;
      policy_outcome: string;
    };
    const ten = db.prepare("SELECT id FROM actions WHERE type = 'apply_discount' AND payload LIKE '%10%'").get() as
      | { id: string }
      | undefined;
    assert.equal(prepare.status, "executed");
    assert.notEqual(draft.status, "executed");
    assert.equal(draft.policy_outcome, "APPROVAL_REQUIRED");
    assert.ok(result.handleSafe.executed.includes(IDS.actPrepare));
    assert.ok(result.handleSafe.pendingApproval.includes(IDS.actDraft));
    if (ten) {
      assert.ok(!result.handleSafe.executed.includes(ten.id));
    }
  });

  it("POLICY RECHECK: safe execute uses current policy, not the plan-time snapshot", async () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    run(db, "UPDATE policies SET value = ? WHERE key = ?", ["3", "discount_max"]);
    ExceptionAutopilotService.for(db).handleSafe(getMeta(db, "demo_now"));
    const five = db.prepare("SELECT policy_outcome FROM actions WHERE id = ?").get(IDS.actAlt5) as {
      policy_outcome: string;
    };
    assert.equal(five.policy_outcome, "BLOCKED");
    const executed = db.prepare("SELECT status FROM actions WHERE id = ?").get(IDS.actAlt5) as { status: string };
    assert.notEqual(executed.status, "executed");
  });

  it("WARNING RESOLUTION: resolved warning leaves Autopilot attention", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const service = ExceptionAutopilotService.for(db);
    service.evaluateSituation(getMeta(db, "demo_now"));
    EarlyWarningEngine.for(db).reviseShipmentArrival(SHIP_EXPECTED_ISO, getMeta(db, "demo_now"));
    const after = service.evaluateSituation(getMeta(db, "demo_now"));
    const warningCard = after.cards.find((card: AutopilotCard) => card.warningId === DELIVER_A_WARNING_ID);
    assert.equal(warningCard, undefined);
  });

  it("WARNING → EXCEPTION: one active control item after the deadline", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const service = ExceptionAutopilotService.for(db);
    service.evaluateSituation(getMeta(db, "demo_now"));
    pulseSummary(db, AFTER_DEADLINE);
    const after = service.evaluateSituation(AFTER_DEADLINE);
    const warningCards = after.cards.filter((card: AutopilotCard) => card.warningId === DELIVER_A_WARNING_ID);
    assert.equal(warningCards.length, 0);
    const warning = EarlyWarningEngine.for(db).get(DELIVER_A_WARNING_ID);
    assert.ok(warning?.status === "ESCALATED" || warning?.status === "RESOLVED");
  });

  it("GOAL stays incomplete while exceptions remain open", () => {
    const db = getDb();
    wipeAndSeed(db);
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    assert.notEqual(result.goal.status, "COMPLETED");
  });

  it("EVENT REPLAY does not rewrite the original event body", async () => {
    const db = getDb();
    wipeAndSeed(db);
    const repo = new EventRepository(db);
    const original = repo.getById(IDS.message1);
    assert.ok(original);
    const before = JSON.stringify(original.payload);
    await eventsFor(db).replay(IDS.message1);
    const after = repo.getById(IDS.message1);
    assert.equal(JSON.stringify(after?.payload), before);
  });

  it("SIMULATION seam: Autopilot does not invent a simulator on this stack", () => {
    assert.equal(existsSync(join(process.cwd(), "lib/simulation/engine.ts")), false);
    const db = getDb();
    const before = (db.prepare("SELECT COUNT(*) as c FROM events").get() as { c: number }).c;
    ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    const after = (db.prepare("SELECT COUNT(*) as c FROM events").get() as { c: number }).c;
    assert.equal(after, before);
  });

  it("320K offline demo and 10% BLOCK still work", async () => {
    process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-auto-reg-")), "loop.db");
    resetDbFile();
    const db = getDb();
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.match(pulse.headline, /320/);
    assert.equal(pulse.counts.NEEDS_YOU, 1);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    assert.equal(getMeta(db, "demo_phase"), "discount_blocked");
    const blocked = pulseSummary(db, getMeta(db, "demo_now")).exceptions.find((row) => row.id === IDS.excDiscount);
    assert.equal(blocked?.attention, "NEEDS_YOU");
  });
});
