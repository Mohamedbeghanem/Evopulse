import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import { ExceptionAutopilotService } from "../lib/autopilot";
import { CommandRouter } from "../lib/command";
import { SHIP_EXPECTED_ISO } from "../lib/clock";
import { getDb, getMeta, resetDbFile, run } from "../lib/db";
import { executeAction, executePlan } from "../lib/engine/execute";
import { calculateGraphImpact } from "../lib/engine/impact";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { eventsFor } from "../lib/events";
import { createGoal } from "../lib/goals";
import { IDS } from "../lib/ids";
import { expireAndRecord, VerificationService } from "../lib/learning";
import { wipeAndSeed } from "../lib/seed";
import { runSimulation } from "../lib/simulation";
import { DELIVER_A_WARNING_ID, EarlyWarningEngine } from "../lib/warnings";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-hard-")), "hardening.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
resetDbFile();

const AFTER_DEADLINE = "2026-09-29T10:01:00+01:00";

describe("unified intelligence loop", { concurrency: 1 }, () => {
  it("320K LOOP: approve → execute → pending verification → reply → HANDLED → outcome", async () => {
    resetDbFile();
    const db = getDb();
    wipeAndSeed(db);
    const now = getMeta(db, "demo_now");
    const before = ExceptionAutopilotService.for(db).evaluateSituation(now);
    assert.equal(before.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "NEEDS_APPROVAL");

    executePlan(db, IDS.planRecovery, now);
    const pending = VerificationService.for(db).getPendingVerifications(IDS.excMissed);
    assert.ok(pending.length >= 1);
    const afterExecute = ExceptionAutopilotService.for(db).evaluateSituation(now);
    assert.equal(afterExecute.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "MONITORING");

    await ingestSeedDiscount(db);
    const handled = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    assert.equal(handled.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "HANDLED");
    const outcomes = db.prepare("SELECT COUNT(*) AS n FROM outcomes").get() as { n: number };
    assert.ok(outcomes.n >= 1);
  });

  it("10% POLICY: planner may propose, policy and Autopilot stay BLOCKED, command explains", async () => {
    const db = getDb();
    const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    const card = snapshot.cards.find((item) => item.exceptionId === IDS.excDiscount);
    assert.ok(card);
    assert.equal(card.classification, "BLOCKED");
    const ten = db.prepare("SELECT status FROM actions WHERE id = ?").get(IDS.actDiscount) as { status: string } | undefined;
    if (ten) assert.notEqual(ten.status, "executed");
    assert.throws(() => executeAction(db, IDS.actDiscount, getMeta(db, "demo_now")));
    const command = new CommandRouter(db).route("Why did you block the 10% discount?");
    assert.match(command.summary, /blocked/i);
    assert.equal(command.status, "BLOCKED");
  });

  it("SUPPLIER CASCADE: 3/3/850K/540K, warning AT RISK, Autopilot NEEDS_YOU", () => {
    resetDbFile();
    const db = getDb();
    triggerSupplierDelay(db);
    const impact = calculateGraphImpact(db, IDS.shipment);
    assert.equal(impact.affected_orders.length, 3);
    assert.equal(impact.affected_customers.length, 3);
    assert.equal(impact.associated_revenue, 850000);
    assert.equal(impact.affected_expected_cash, 540000);
    const warning = EarlyWarningEngine.for(db).get(DELIVER_A_WARNING_ID);
    assert.ok(warning);
    assert.notEqual(warning.status, "ESCALATED");
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.ok(pulse.comingNext.some((row) => row.buffer_state === "AT_RISK" && !row.failed));
    const card = pulse.autopilot.cards.find((item) => item.exceptionId === IDS.excDelay);
    assert.equal(card?.classification, "NEEDS_YOU");
  });

  it("WARNING RESOLUTION: earlier arrival clears the warning card", () => {
    const db = getDb();
    EarlyWarningEngine.for(db).reviseShipmentArrival(SHIP_EXPECTED_ISO, getMeta(db, "demo_now"));
    const after = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
    assert.equal(
      after.cards.find((card) => card.warningId === DELIVER_A_WARNING_ID),
      undefined,
    );
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.ok(!pulse.comingNext.some((row) => row.id === DELIVER_A_WARNING_ID && row.status !== "RESOLVED"));
  });

  it("WARNING → EXCEPTION: one Detect-owned miss after the deadline", () => {
    resetDbFile();
    const db = getDb();
    triggerSupplierDelay(db);
    pulseSummary(db, AFTER_DEADLINE);
    const warning = EarlyWarningEngine.for(db).get(DELIVER_A_WARNING_ID);
    assert.ok(warning?.status === "ESCALATED" || warning?.status === "RESOLVED");
    const misses = db
      .prepare("SELECT COUNT(*) AS n FROM exceptions WHERE expectation_id = ? AND kind IN ('commitment_missed', 'missed_commitment')")
      .get(IDS.expectDeliverA) as { n: number };
    assert.equal(misses.n, 1);
    const after = ExceptionAutopilotService.for(db).evaluateSituation(AFTER_DEADLINE);
    assert.equal(after.cards.filter((card) => card.warningId === DELIVER_A_WARNING_ID).length, 0);
  });

  it("SIMULATION +3 days leaves reality unchanged", () => {
    resetDbFile();
    const db = getDb();
    triggerSupplierDelay(db);
    const due = db.prepare("SELECT due_at FROM expectations WHERE id = ?").get(IDS.expectShip) as { due_at: string };
    const events = (db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n;
    const result = runSimulation(db, { type: "supplier_delay", targetId: IDS.shipment, days: 3 });
    assert.equal(result.isolation.unchanged, true);
    assert.equal(
      (db.prepare("SELECT due_at FROM expectations WHERE id = ?").get(IDS.expectShip) as { due_at: string }).due_at,
      due.due_at,
    );
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM events").get() as { n: number }).n, events);
    assert.equal(getMeta(db, "supplier_phase"), "delayed");
  });

  it("GOAL: protect this week does not fire supplier delay or send a quote", () => {
    resetDbFile();
    const db = getDb();
    const quotes = (db.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'quote.sent'").get() as { n: number }).n;
    const created = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    assert.notEqual(created.goal.status, "COMPLETED");
    assert.equal(getMeta(db, "supplier_phase", "stable"), "stable");
    assert.equal(
      (db.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'quote.sent'").get() as { n: number }).n,
      quotes,
    );
  });

  it("HANDLE SAFE: AUTO once, approval held, blocked held, repeat is idempotent", () => {
    resetDbFile();
    const db = getDb();
    const first = ExceptionAutopilotService.for(db).handleSafe(getMeta(db, "demo_now"));
    assert.ok(first.handleSafe.executed.includes(IDS.actPrepare) || first.handleSafe.executed.includes(IDS.actCheck));
    assert.ok(first.handleSafe.pendingApproval.includes(IDS.actDraft));
    const second = ExceptionAutopilotService.for(db).handleSafe(getMeta(db, "demo_now"));
    assert.equal(second.handleSafe.executed.length, 0);
    const draft = db.prepare("SELECT status FROM actions WHERE id = ?").get(IDS.actDraft) as { status: string };
    assert.notEqual(draft.status, "executed");
  });

  it("COMMAND FOLLOW-UP: 850K context then +3 days simulates the shipment", () => {
    resetDbFile();
    const db = getDb();
    triggerSupplierDelay(db);
    const command = new CommandRouter(db);
    const first = command.route("Why is 850K at risk?");
    const second = command.route("What if it is another 3 days late?", first.session.id);
    assert.equal(second.intent, "SIMULATION");
    assert.equal(second.data.targetId, IDS.shipment);
    assert.equal(second.data.realityUnchanged, true);
  });

  it("UNKNOWN COMMAND does not fabricate an answer", () => {
    const result = new CommandRouter(getDb()).route("What is the weather in Tokyo?");
    assert.equal(result.intent, "UNKNOWN");
    assert.match(result.summary, /don't have enough structured business data/);
  });

  it("REPLAY does not mutate the original event or duplicate the warning", async () => {
    resetDbFile();
    const db = getDb();
    triggerSupplierDelay(db);
    const original = db.prepare("SELECT payload FROM events WHERE id = ?").get(IDS.evtShipDelayed) as { payload: string };
    const warnings = (db.prepare("SELECT COUNT(*) AS n FROM early_warnings").get() as { n: number }).n;
    await eventsFor(db).replay(IDS.evtShipDelayed);
    const after = db.prepare("SELECT payload FROM events WHERE id = ?").get(IDS.evtShipDelayed) as { payload: string };
    assert.equal(after.payload, original.payload);
    assert.equal((db.prepare("SELECT COUNT(*) AS n FROM early_warnings").get() as { n: number }).n, warnings);
  });

  it("VERIFICATION FAILURE re-enters NEEDS_YOU, not HANDLED", () => {
    resetDbFile();
    const db = getDb();
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    expireAndRecord(db, "2026-09-29T12:00:00+01:00");
    const card = ExceptionAutopilotService.for(db)
      .evaluateSituation("2026-09-29T12:00:00+01:00")
      .cards.find((item) => item.exceptionId === IDS.excMissed);
    assert.equal(card?.classification, "NEEDS_YOU");
    assert.notEqual(card?.classification, "HANDLED");
  });

  it("stale AUTO 10% cannot execute after a live policy recheck", () => {
    resetDbFile();
    const db = getDb();
    run(
      db,
      `INSERT INTO actions (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "act_stale_ten",
        IDS.excMissed,
        IDS.planRecovery,
        "apply_discount",
        "Stale 10%",
        "tampered",
        JSON.stringify({ percent: 10 }),
        "AUTO",
        "stale",
        "proposed",
        getMeta(db, "demo_now"),
      ],
    );
    assert.throws(() => executeAction(db, "act_stale_ten", getMeta(db, "demo_now")));
    const row = db.prepare("SELECT policy_outcome, status FROM actions WHERE id = ?").get("act_stale_ten") as {
      policy_outcome: string;
      status: string;
    };
    assert.equal(row.policy_outcome, "BLOCKED");
    assert.notEqual(row.status, "executed");
  });

  it("EXISTING DB MIGRATION: older events table upgrades and keeps rows", () => {
    const dir = mkdtempSync(join(tmpdir(), "evopulse-mig-"));
    const keep = join(dir, "legacy-keep.db");
    mkdirSync(dir, { recursive: true });
    const rebuilt = new DatabaseSync(keep);
    rebuilt.exec(`
      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        occurred_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );
      CREATE TABLE commitments (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        deadline TEXT NOT NULL,
        status TEXT NOT NULL,
        source_event_id TEXT,
        evidence TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 1,
        model TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      );
      CREATE TABLE expectations (
        id TEXT PRIMARY KEY,
        commitment_id TEXT NOT NULL,
        description TEXT NOT NULL,
        due_at TEXT NOT NULL,
        status TEXT NOT NULL,
        actual TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE exceptions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        expectation_id TEXT,
        opportunity_id TEXT,
        attention TEXT NOT NULL,
        severity TEXT NOT NULL,
        urgency TEXT NOT NULL,
        impact_json TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        confidence REAL NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO events (id, type, source, payload, occurred_at, created_at)
        VALUES ('evt_legacy', 'message.received', 'seed', '{"keep":true}', '2026-09-27T09:00:00+01:00', '2026-09-27T09:00:00+01:00');
      INSERT INTO entities (id, type, name, payload, created_at)
        VALUES ('ent_legacy', 'company', 'Legacy Co', '{}', '2026-09-27T09:00:00+01:00');
      INSERT INTO meta (key, value) VALUES ('demo_now', '2026-09-27T09:12:00+01:00');
    `);
    rebuilt.close();
    const g = globalThis as unknown as { evopulseDb?: DatabaseSync };
    if (g.evopulseDb) {
      try {
        g.evopulseDb.close();
      } catch {
        /* ignore */
      }
      g.evopulseDb = undefined;
    }
    process.env.DB_PATH = keep;
    const db = getDb();
    const kept = db.prepare("SELECT payload, received_at FROM events WHERE id = ?").get("evt_legacy") as {
      payload: string;
      received_at: string;
    };
    assert.match(kept.payload, /keep/);
    assert.ok(kept.received_at);
    const warnings = db.prepare("SELECT name FROM sqlite_master WHERE name = 'early_warnings'").get() as { name: string };
    const decisions = db.prepare("SELECT name FROM sqlite_master WHERE name = 'autopilot_decisions'").get() as {
      name: string;
    };
    const sessions = db.prepare("SELECT name FROM sqlite_master WHERE name = 'command_sessions'").get() as {
      name: string;
    };
    assert.equal(warnings.name, "early_warnings");
    assert.equal(decisions.name, "autopilot_decisions");
    assert.equal(sessions.name, "command_sessions");
    assert.equal(existsSync(keep), true);
  });
});
