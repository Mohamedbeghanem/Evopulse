import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CommandRouter } from "../lib/command";
import { getDb, getMeta, resetDbFile, run } from "../lib/db";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";
import { EarlyWarningEngine } from "../lib/warnings";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-cmd-")), "command.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
resetDbFile();

describe("command center", { concurrency: 1 }, () => {
  const router = () => new CommandRouter(getDb());

  it("routes the demo questions offline", () => {
    const command = router();
    assert.equal(command.classifyIntent("What changed today?"), "BUSINESS_CHANGES");
    assert.equal(command.classifyIntent("What needs me?"), "ATTENTION");
    assert.equal(command.classifyIntent("What am I about to miss?"), "FUTURE_RISK");
    assert.equal(command.classifyIntent("Why is 850K at risk?"), "CAUSAL_EXPLANATION");
    assert.equal(command.classifyIntent("What if Atlas is another 3 days late?"), "SIMULATION");
    assert.equal(command.classifyIntent("Protect everything at risk this week."), "GOAL");
    assert.equal(command.classifyIntent("What can you handle safely?"), "POLICY");
    assert.equal(command.classifyIntent("Fix everything you're authorized to fix."), "EXECUTION");
    assert.equal(command.extractTimeScope("Protect everything at risk this week."), "this_week");
    assert.equal(command.extractScenarioParameters("another 3 days late", [IDS.supplier])?.days, 3);
  });

  it("returns today's event-layer changes after the supplier delay", () => {
    triggerSupplierDelay(getDb());
    const result = router().route("What changed today?");
    assert.equal(result.intent, "BUSINESS_CHANGES");
    assert.ok(result.evidence.every((item) => item.sourceSystem === "EVENTS"));
    assert.match(result.summary, /meaningful changes/);
    assert.ok(result.evidence.some((item) => item.sourceType === "shipment.delayed"));
  });

  it("returns attention states, not ordinary events", () => {
    const result = router().route("What needs me?");
    assert.equal(result.intent, "ATTENTION");
    const items = result.data.items as { kind: string }[];
    assert.ok(items.some((item) => item.kind === "NEEDS_YOU"));
    assert.ok(items.every((item) => item.kind === "NEEDS_YOU" || item.kind === "NEEDS_APPROVAL" || item.kind === "BLOCKED"));
  });

  it("returns live early-warning buffers and excludes resolved warnings", () => {
    const db = getDb();
    const now = getMeta(db, "demo_now");
    const engine = EarlyWarningEngine.for(db);
    engine.evaluateAll(now);
    const live = engine.getActiveWarnings().map((row) => engine.summarize(row)).find((row) => row.buffer_state !== "MISSED");
    assert.ok(live);
    const result = router().route("What am I about to miss?");
    const cards = result.data.comingNext as { availableMinutes: number; id: string }[];
    assert.equal(result.sourceSystems.includes("EARLY_WARNING"), true);
    assert.ok(cards.some((card) => card.id === live?.id));
    assert.equal(cards.find((card) => card.id === live?.id)?.availableMinutes, live?.available_buffer_minutes);
    assert.ok(cards.every((card) => card.availableMinutes !== 14 * 60 || live?.available_buffer_minutes === 14 * 60));
  });

  it("explains 850K from the graph without calling it a loss", () => {
    const result = router().route("Why is 850K at risk?");
    assert.equal(result.data.orders, 3);
    assert.equal(result.data.customers, 3);
    assert.equal(result.data.associatedRevenue, 850000);
    assert.equal(result.data.expectedCash, 540000);
    assert.equal(result.data.notALoss, true);
    assert.match(result.evidence.map((item) => item.statement).join(" "), /not a claim|graph facts/i);
  });

  it("runs +3 days through simulation and leaves reality unchanged", () => {
    const db = getDb();
    const before = getMeta(db, "supplier_phase");
    const due = db.prepare("SELECT due_at FROM expectations WHERE id = ?").get(IDS.expectShip) as { due_at: string };
    const result = router().route("What if Atlas is another 3 days late?");
    assert.equal(result.intent, "SIMULATION");
    assert.equal(result.data.realityUnchanged, true);
    assert.match(result.summary, /SIMULATION/);
    const after = db.prepare("SELECT due_at FROM expectations WHERE id = ?").get(IDS.expectShip) as { due_at: string };
    assert.equal(after.due_at, due.due_at);
    assert.equal(getMeta(db, "supplier_phase"), before);
  });

  it("creates a protection plan without firing the supplier delay or sending a quote", () => {
    const db = getDb();
    const phase = getMeta(db, "supplier_phase", "stable");
    const quotesBefore = db.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'quote.sent'").get() as { n: number };
    const result = new CommandRouter(db).route("Protect everything at risk this week.");
    assert.equal(result.intent, "GOAL");
    assert.equal(result.data.supplierPhaseUnchanged, true);
    assert.equal(result.data.executed, false);
    assert.equal(getMeta(db, "supplier_phase", "stable"), phase);
    const quotesAfter = db.prepare("SELECT COUNT(*) AS n FROM events WHERE type = 'quote.sent'").get() as { n: number };
    assert.equal(quotesAfter.n, quotesBefore.n);
    assert.ok(Number(result.data.total) >= 1);
  });

  it("classifies safe, approval, and blocked actions from current policy", async () => {
    const db = getDb();
    triggerSupplierDelay(db);
    await ingestSeedDiscount(db);
    const result = new CommandRouter(db).route("What can you handle safely?");
    const blocked = result.data.blocked as { id: string; title: string }[];
    assert.ok(blocked.some((item) => /10%|discount/i.test(item.title)));
    const safe = result.data.safe as { id: string }[];
    const approval = result.data.approval as { id: string }[];
    const blockedIds = new Set(blocked.map((item) => item.id));
    for (const item of safe) assert.equal(blockedIds.has(item.id), false);
    assert.ok(approval.length + safe.length + blocked.length >= 1);
  });

  it("executes only actions that are still AUTO after a policy recheck", () => {
    const db = getDb();
    const planted = "act_planted_discount";
    run(
      db,
      `INSERT INTO actions (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        planted,
        IDS.excMissed,
        IDS.planRecovery,
        "apply_discount",
        "Planted 10% that was marked AUTO",
        "tampered",
        JSON.stringify({ percent: 10 }),
        "AUTO",
        "stale",
        "proposed",
        getMeta(db, "demo_now"),
      ],
    );
    const result = new CommandRouter(db).route("Fix everything you're authorized to fix.");
    const executed = result.data.executed as string[];
    assert.equal(executed.includes(planted), false);
    const row = db.prepare("SELECT policy_outcome, status FROM actions WHERE id = ?").get(planted) as {
      policy_outcome: string;
      status: string;
    };
    assert.equal(row.policy_outcome, "BLOCKED");
    assert.notEqual(row.status, "executed");
    const stillBlocked = db.prepare("SELECT status FROM actions WHERE id = ?").get(IDS.actDiscount) as { status: string } | undefined;
    if (stillBlocked) assert.notEqual(stillBlocked.status, "executed");
  });

  it("answers history from stored outcomes and does not invent a causal rate", () => {
    const result = router().route("What did we do last time this happened?");
    assert.equal(result.intent, "HISTORY");
    assert.match(String(result.data.note), /observations, not predictions/);
    assert.equal(JSON.stringify(result.data).includes("caused a"), false);
  });

  it("returns an audit trace for the blocked discount", async () => {
    const result = router().route("Why did you block the 10% discount?");
    assert.equal(result.answerType, "AUDIT_TRACE");
    assert.match(result.summary, /blocked/);
  });

  it("does not hallucinate an unknown question", () => {
    const result = router().route("What is the weather in Tokyo?");
    assert.equal(result.intent, "UNKNOWN");
    assert.match(result.summary, /don't have enough structured business data/);
  });

  it("keeps supplier context for a follow-up simulation", () => {
    const command = router();
    const first = command.route("Why is 850K at risk?");
    const second = command.route("What if it is 3 days later?", first.session.id);
    assert.equal(second.intent, "SIMULATION");
    assert.equal(second.data.targetId, IDS.shipment);
    assert.equal(second.data.realityUnchanged, true);
  });
});
