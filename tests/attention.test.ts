import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { projectAttention } from "../lib/attention";
import { CommandRouter } from "../lib/command";
import { getDb, getMeta, resetDbFile, run } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";
import { wipeAndSeed } from "../lib/seed";
import { SHIP_DELAYED_ISO } from "../lib/clock";
import { DELIVER_A_WARNING_ID, EarlyWarningEngine } from "../lib/warnings";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-attn-")), "attention.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
resetDbFile();

const AFTER_DEADLINE = "2026-09-29T10:01:00+01:00";

function quietProposal(db: ReturnType<typeof getDb>) {
  for (const expectationId of [IDS.expectOurs, IDS.expectTheirs, IDS.expectSign]) {
    run(db, "UPDATE expectations SET status = ? WHERE id = ?", ["FULFILLED", expectationId]);
  }
  for (const commitmentId of [IDS.commitOurs, IDS.commitTheirs, IDS.commitSign]) {
    run(db, "UPDATE commitments SET status = ? WHERE id = ?", ["fulfilled", commitmentId]);
  }
  run(db, "DELETE FROM actions WHERE exception_id = ?", [IDS.excMissed]);
  run(db, "DELETE FROM plans WHERE exception_id = ?", [IDS.excMissed]);
  run(db, "DELETE FROM exceptions WHERE id IN (?, ?)", [IDS.excMissed, IDS.excDiscount]);
}

function situationOf(items: { id: string; sourceExceptionId: string | null; sourceWarningId: string | null }[], exceptionId?: string, warningId?: string) {
  return items.filter(
    (item) =>
      item.id === (exceptionId ? `exception:${exceptionId}` : undefined) ||
      item.id === (warningId ? `warning:${warningId}` : undefined) ||
      (exceptionId && item.sourceExceptionId === exceptionId) ||
      (warningId && item.sourceWarningId === warningId),
  );
}

function fingerprint(db: ReturnType<typeof getDb>) {
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  return {
    events: count("events"),
    warnings: count("early_warnings"),
    exceptions: count("exceptions"),
    plans: count("plans"),
    actions: count("actions"),
    approvals: count("approvals"),
    verifications: count("verifications"),
    outcomes: count("outcomes"),
    decisions: count("autopilot_decisions"),
    sessions: count("command_sessions"),
    now: getMeta(db, "demo_now"),
    phase: getMeta(db, "demo_phase", "seeded"),
    supplier: getMeta(db, "supplier_phase", "stable"),
  };
}

describe("attention projection", { concurrency: 1 }, () => {
  it("NORMAL: no warning, no exception, no decision → no attention card", () => {
    const db = getDb();
    wipeAndSeed(db);
    quietProposal(db);
    const attention = projectAttention(db, getMeta(db, "demo_now"));
    assert.equal(attention.items.length, 0);
    assert.equal(attention.needsMe.length, 0);
    assert.equal(attention.watching.length, 0);
    assert.equal(attention.summary.needsYou, 0);
    assert.equal(attention.summary.needsApproval, 0);
    assert.equal(attention.summary.monitoring, 0);
  });

  it("EARLY WARNING: one warning → one MONITORING card", () => {
    const db = getDb();
    wipeAndSeed(db);
    quietProposal(db);
    EarlyWarningEngine.for(db).reviseShipmentArrival(SHIP_DELAYED_ISO, getMeta(db, "demo_now"));
    const attention = projectAttention(db, getMeta(db, "demo_now"));
    const warningCards = situationOf(attention.items, undefined, DELIVER_A_WARNING_ID);
    assert.equal(warningCards.length, 1);
    assert.equal(warningCards[0].classification, "MONITORING");
    assert.equal(attention.watching.length, 1);
    assert.equal(attention.needsMe.filter((item) => item.sourceWarningId === DELIVER_A_WARNING_ID).length, 0);
    const warning = db.prepare("SELECT status FROM early_warnings WHERE id = ?").get(DELIVER_A_WARNING_ID) as {
      status: string;
    };
    assert.ok(warning.status === "ACTIVE" || warning.status === "MONITORING");
  });

  it("SUPPLIER CASCADE: warning + impact + Autopilot → one NEEDS_YOU card", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    const cascade = situationOf(pulse.attention.items, IDS.excDelay, DELIVER_A_WARNING_ID);
    assert.equal(cascade.length, 1);
    assert.equal(cascade[0].classification, "NEEDS_YOU");
    assert.equal(cascade[0].id, `exception:${IDS.excDelay}`);
    assert.equal(cascade[0].impact.orders, 3);
    assert.equal(cascade[0].impact.customers, 3);
    assert.equal(cascade[0].impact.associatedRevenue, 850000);
    assert.equal(cascade[0].impact.expectedCash, 540000);
    assert.ok(cascade[0].layers.some((layer) => layer.kind === "WARNING"));
    assert.ok(cascade[0].layers.some((layer) => layer.kind === "EXCEPTION"));
    assert.ok(cascade[0].layers.some((layer) => layer.kind === "IMPACT"));
    assert.equal(pulse.attention.summary.needsYou, 1);
    const command = new CommandRouter(db).route("What needs me?");
    const items = command.data.items as { situationId: string; kind: string }[];
    assert.equal(items.filter((item) => item.situationId === `exception:${IDS.excDelay}`).length, 1);
    assert.equal(items.find((item) => item.situationId === `exception:${IDS.excDelay}`)?.kind, "NEEDS_YOU");
    const cascadeSummary = command.data.autopilot as { needsYou: number };
    assert.equal(cascadeSummary.needsYou, pulse.attention.summary.needsYou);
  });

  it("320K: exception + plan + approval + Autopilot → one NEEDS_APPROVAL card", () => {
    const db = getDb();
    wipeAndSeed(db);
    const attention = projectAttention(db, getMeta(db, "demo_now"));
    const missed = situationOf(attention.items, IDS.excMissed);
    assert.equal(missed.length, 1);
    assert.equal(missed[0].classification, "NEEDS_APPROVAL");
    assert.equal(attention.needsMe.filter((item) => item.sourceExceptionId === IDS.excMissed).length, 1);
    const plan = db.prepare("SELECT COUNT(*) AS n FROM plans WHERE exception_id = ?").get(IDS.excMissed) as { n: number };
    const draft = db.prepare("SELECT policy_outcome, status FROM actions WHERE id = ?").get(IDS.actDraft) as {
      policy_outcome: string;
      status: string;
    };
    assert.equal(plan.n, 1);
    assert.equal(draft.policy_outcome, "APPROVAL_REQUIRED");
    assert.notEqual(draft.status, "executed");
  });

  it("10%: blocked action + Autopilot → one BLOCKED situation", async () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    const attention = projectAttention(db, getMeta(db, "demo_now"));
    const blocked = situationOf(attention.items, IDS.excDiscount);
    assert.equal(blocked.length, 1);
    assert.equal(blocked[0].classification, "BLOCKED");
    const ten = db.prepare("SELECT policy_outcome, status FROM actions WHERE id = ?").get(IDS.actDiscount) as {
      policy_outcome: string;
      status: string;
    };
    assert.equal(ten.policy_outcome, "BLOCKED");
    assert.notEqual(ten.status, "executed");
    assert.equal(attention.needsMe.filter((item) => item.classification === "BLOCKED").length, 1);
  });

  it("VERIFICATION PENDING: one MONITORING situation", () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    const pending = db.prepare("SELECT COUNT(*) AS n FROM verifications WHERE exception_id = ? AND status = 'PENDING'").get(IDS.excMissed) as {
      n: number;
    };
    assert.ok(pending.n >= 1);
    const attention = projectAttention(db, getMeta(db, "demo_now"));
    const missed = situationOf(attention.items, IDS.excMissed);
    assert.equal(missed.length, 1);
    assert.equal(missed[0].classification, "MONITORING");
    assert.equal(missed[0].reasonCode, "VERIFICATION_PENDING");
    assert.equal(attention.watching.filter((item) => item.sourceExceptionId === IDS.excMissed).length, 1);
  });

  it("VERIFIED: one HANDLED situation", async () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    const attention = projectAttention(db, getMeta(db, "demo_now"));
    const missed = situationOf(attention.items, IDS.excMissed);
    assert.equal(missed.length, 1);
    assert.equal(missed[0].classification, "HANDLED");
    const verification = db.prepare("SELECT status FROM verifications WHERE exception_id = ? ORDER BY created_at DESC").get(IDS.excMissed) as {
      status: string;
    };
    assert.equal(verification.status, "SUCCESS");
  });

  it("WARNING → EXCEPTION: one card before deadline, one after, never two", () => {
    const db = getDb();
    wipeAndSeed(db);
    quietProposal(db);
    triggerSupplierDelay(db);
    const before = projectAttention(db, getMeta(db, "demo_now"));
    const beforeCards = situationOf(before.items, IDS.excDelay, DELIVER_A_WARNING_ID);
    assert.equal(beforeCards.length, 1);
    assert.equal(beforeCards[0].situationType, "exception");
    assert.equal(beforeCards[0].classification, "NEEDS_YOU");

    pulseSummary(db, AFTER_DEADLINE);
    const after = projectAttention(db, AFTER_DEADLINE);
    const afterCards = situationOf(after.items, IDS.excDelay, DELIVER_A_WARNING_ID);
    const warningStandalone = after.items.filter((item) => item.id === `warning:${DELIVER_A_WARNING_ID}`);
    const escalated = db.prepare("SELECT status FROM early_warnings WHERE id = ?").get(DELIVER_A_WARNING_ID) as {
      status: string;
    };
    const misses = db
      .prepare("SELECT id FROM exceptions WHERE expectation_id = ? AND kind IN ('commitment_missed', 'missed_commitment')")
      .all(IDS.expectDeliverA) as { id: string }[];
    assert.ok(escalated.status === "ESCALATED" || escalated.status === "RESOLVED");
    assert.equal(misses.length, 1);
    assert.equal(warningStandalone.length, 0);
    assert.equal(afterCards.length, 1);
    assert.equal(afterCards[0].id, `exception:${IDS.excDelay}`);
    assert.equal(after.items.filter((item) => item.id === `exception:${misses[0].id}`).length, 0);
  });

  it("Pulse and Command share the same needs-me classification", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    const command = new CommandRouter(db).route("What needs me?");
    const pulseKeys = pulse.attention.needsMe.map((item) => `${item.id}:${item.classification}`).sort();
    const commandKeys = (command.data.items as { situationId: string; kind: string }[])
      .map((item) => `${item.situationId}:${item.kind}`)
      .sort();
    assert.deepEqual(commandKeys, pulseKeys);
    const shared = command.data.autopilot as { needsYou: number; needsApproval: number };
    assert.equal(shared.needsYou, pulse.attention.summary.needsYou);
    assert.equal(shared.needsApproval, pulse.attention.summary.needsApproval);
  });

  it("RESET is deterministic across two wipes", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const first = fingerprint(db);
    wipeAndSeed(db);
    const reset = fingerprint(db);
    wipeAndSeed(db);
    const again = fingerprint(db);
    assert.deepEqual(again, reset);
    assert.notEqual(first.exceptions, reset.exceptions);
    assert.equal(reset.now, "2026-09-27T08:18:00+01:00");
    assert.equal(reset.supplier, "stable");
    assert.equal(reset.sessions, 0);
    assert.equal(reset.exceptions, again.exceptions);
    assert.equal(reset.events, again.events);
  });
});
