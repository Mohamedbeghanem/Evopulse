import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

// OFFLINE: no model keys, and any network call fails the test run.
for (const key of ["OPENAI_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) delete process.env[key];
const realFetch = globalThis.fetch;
let networkCalls = 0;
globalThis.fetch = (async () => {
  networkCalls += 1;
  throw new Error("network disabled in autopilot tests");
}) as typeof fetch;

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-ap-")), "autopilot.db");

import { getDb, getMeta, resetDbFile } from "../lib/db";
import {
  ANOMALY_EVENTS,
  CUSTOMER_REPLY_EVENT_ID,
  DECISION_MATRIX,
  DecisionLog,
  ESCALATION_THRESHOLD,
  ROUTINE_EVENT_COUNT,
  autopilotSummary,
  classify,
  gatherFacts,
  receiveCustomerReply,
  resetAutopilotAdapters,
  runAutopilot,
  setAutopilotAdapters,
  signalExceptionId,
  templatePlanner,
  type ClassificationInput,
} from "../lib/autopilot";
import { executeAction, executePlan } from "../lib/engine/execute";
import { createGoal, executeSafeActions } from "../lib/goals";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import { VerificationService } from "../lib/learning";
import { wipeAndSeed } from "../lib/seed";
import type { ActionRow, ExceptionRow } from "../lib/types";

resetDbFile();
after(() => {
  globalThis.fetch = realFetch;
});

const BASE: ClassificationInput = {
  risk: "none",
  policy: "NONE",
  impactValue: 0,
  reversible: true,
  hasActions: false,
  execution: "none",
  executedBy: null,
  verification: "none",
  resolved: false,
};

function counts() {
  const db = getDb();
  const c = (table: string) => (db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }).c;
  return {
    events: c("events"),
    exceptions: c("exceptions"),
    plans: c("plans"),
    actions: c("actions"),
    verifications: c("verifications"),
    outcomes: c("outcomes"),
    decisions: c("autopilot_decisions"),
    audit: c("audit_logs"),
    approvals: c("approvals"),
  };
}

function exception(id: string) {
  return getDb().prepare("SELECT * FROM exceptions WHERE id = ?").get(id) as ExceptionRow;
}

function actionsOf(exceptionId: string) {
  return getDb().prepare("SELECT * FROM actions WHERE exception_id = ? ORDER BY id").all(exceptionId) as ActionRow[];
}

function state(id: string) {
  return DecisionLog.for(getDb()).latest("exception", id)?.state;
}

describe("decision matrix (pure)", () => {
  const cases: [string, Partial<ClassificationInput>, string, string][] = [
    ["routine event", {}, "NORMAL", "R09_NO_SIGNAL"],
    ["low-risk reversible AUTO fix", { risk: "low", policy: "AUTO", hasActions: true }, "AUTO_HANDLED", "R12_SAFE_AUTO"],
    ["AUTO but irreversible", { risk: "low", policy: "AUTO", hasActions: true, reversible: false }, "NEEDS_APPROVAL", "R13_AUTO_NOT_SAFE"],
    ["AUTO but medium risk", { risk: "medium", policy: "AUTO", hasActions: true }, "NEEDS_APPROVAL", "R13_AUTO_NOT_SAFE"],
    ["external send", { risk: "medium", policy: "APPROVAL_REQUIRED", hasActions: true, impactValue: 64_000 }, "NEEDS_APPROVAL", "R11_APPROVAL_REQUIRED"],
    ["high impact beats approval", { risk: "medium", policy: "APPROVAL_REQUIRED", hasActions: true, impactValue: ESCALATION_THRESHOLD }, "NEEDS_YOU", "R10_HIGH_IMPACT"],
    ["high impact beats AUTO", { risk: "low", policy: "AUTO", hasActions: true, impactValue: 320_000 }, "NEEDS_YOU", "R10_HIGH_IMPACT"],
    ["high risk, no plan", { risk: "high" }, "NEEDS_YOU", "R10_HIGH_IMPACT"],
    ["policy violation", { risk: "high", policy: "BLOCKED", hasActions: true, impactValue: 320_000 }, "BLOCKED", "R02_POLICY_BLOCKED"],
    ["warning, nothing to do", { risk: "low" }, "MONITORING", "R14_WATCH"],
    ["executed, verification pending", { risk: "high", policy: "APPROVAL_REQUIRED", hasActions: true, execution: "executed", executedBy: "human", verification: "PENDING" }, "MONITORING", "R05_AWAITING_VERIFICATION"],
    ["verified", { risk: "high", execution: "executed", verification: "SUCCESS" }, "HANDLED", "R04_VERIFIED"],
    ["verification failed", { risk: "high", execution: "executed", verification: "FAILED" }, "NEEDS_YOU", "R03_VERIFICATION_FAILED"],
    ["autopilot executed, nothing to verify", { risk: "low", policy: "AUTO", hasActions: true, execution: "executed", executedBy: "autopilot" }, "AUTO_HANDLED", "R06_AUTO_EXECUTED"],
    ["human executed, nothing to verify", { risk: "high", hasActions: true, execution: "executed", executedBy: "human" }, "HANDLED", "R07_EXECUTED_NO_VERIFICATION"],
    ["execution failed", { risk: "low", policy: "AUTO", hasActions: true, execution: "failed" }, "NEEDS_YOU", "R01_EXECUTION_FAILED"],
  ];
  for (const [name, input, expectedState, expectedRule] of cases) {
    it(`${name} → ${expectedState}`, () => {
      const decision = classify({ ...BASE, ...input });
      assert.equal(decision.state, expectedState);
      assert.equal(decision.rule, expectedRule);
      assert.ok(decision.reason.length > 0);
    });
  }

  it("every state is reachable and the fail-safe is last", () => {
    const reachable = new Set(DECISION_MATRIX.map((r) => r.state));
    for (const s of ["NORMAL", "AUTO_HANDLED", "MONITORING", "NEEDS_APPROVAL", "NEEDS_YOU", "BLOCKED", "HANDLED"]) {
      assert.ok(reachable.has(s as never), `${s} unreachable`);
    }
    assert.equal(DECISION_MATRIX.at(-1)?.id, "R15_FAIL_SAFE");
  });
});

describe("autopilot on the seeded business", { concurrency: 1 }, () => {
  before(() => wipeAndSeed(getDb()));

  it("BULK SAFE: many routine events → NORMAL, no exceptions or actions for them", () => {
    const db = getDb();
    const pass = runAutopilot(db);
    const routine = eventsFor(db)
      .list()
      .filter((e) => e.id.startsWith("evt_rt_") && !e.id.startsWith("evt_rt_sig_"));
    assert.equal(routine.length, ROUTINE_EVENT_COUNT);
    assert.ok(routine.length >= 150);
    for (const event of routine) {
      assert.equal(pass.eventStates[event.id], "NORMAL", event.id);
      assert.equal(exception(signalExceptionId(event.id)), undefined);
    }
    const routineActions = db
      .prepare("SELECT COUNT(*) AS c FROM actions WHERE id LIKE 'act_ap_evt_rt_%' AND id NOT LIKE 'act_ap_evt_rt_sig_%'")
      .get() as { c: number };
    assert.equal(routineActions.c, 0);
    const signalActions = db.prepare("SELECT COUNT(*) AS c FROM actions WHERE id LIKE 'act_ap_evt_rt_%'").get() as { c: number };
    const signalsWithActions = ANOMALY_EVENTS.filter((e) => !["payment.at_risk", "delivery.eta_changed"].includes(e.type));
    assert.equal(signalActions.c, signalsWithActions.length);
  });

  it("AUTO-HANDLE: low-risk reversible internal fix executes through the action engine as the autopilot", () => {
    const db = getDb();
    const id = signalExceptionId("evt_rt_sig_inv_0");
    assert.equal(state(id), "AUTO_HANDLED");
    const row = exception(id);
    assert.equal(row.attention, "AUTO_HANDLED");
    assert.equal(row.status, "resolved");
    const [action] = actionsOf(id);
    assert.equal(action.type, "create_task");
    assert.equal(action.policy_outcome, "AUTO");
    assert.equal(action.status, "executed");
    const executed = eventsFor(db).list({ type: EVENT_TYPES.ACTION_EXECUTED, entity_type: "action", entity_id: action.id });
    assert.equal(executed.length, 1);
    assert.equal(executed[0].actor_id, "autopilot");
    assert.equal(VerificationService.for(db).getPendingVerifications(id).length, 0);
  });

  it("APPROVAL: external send is prepared, never executed, and waits as NEEDS_APPROVAL", () => {
    const id = signalExceptionId("evt_rt_sig_req_0");
    assert.equal(state(id), "NEEDS_APPROVAL");
    const [draft] = actionsOf(id);
    assert.equal(draft.type, "draft_message");
    assert.equal(draft.policy_outcome, "APPROVAL_REQUIRED");
    assert.equal(draft.status, "proposed");
    assert.throws(() => executeAction(getDb(), draft.id, getMeta(getDb(), "demo_now"), "autopilot"), /needs approval/);
  });

  it("warnings are MONITORING with no actions", () => {
    for (const eventId of ["evt_rt_sig_pay_0", "evt_rt_sig_eta_0"]) {
      const id = signalExceptionId(eventId);
      assert.equal(state(id), "MONITORING");
      assert.equal(actionsOf(id).length, 0);
    }
  });

  it("headline numbers are computed from rows, not hardcoded", () => {
    const db = getDb();
    const summary = autopilotSummary(db);
    const inbound = db
      .prepare(
        `SELECT COUNT(*) AS c FROM events WHERE source NOT IN
          ('pulse-engine','action-engine','verification-engine','outcome-ledger','policy-engine','impact-engine','recovery-engine','feedback-engine','autopilot')`,
      )
      .get() as { c: number };
    assert.equal(summary.totals.eventsUnderstood, inbound.c);
    const normal = db
      .prepare(
        `SELECT COUNT(*) AS c FROM autopilot_decisions d
         JOIN (SELECT subject_id, MAX(rowid) r FROM autopilot_decisions WHERE subject_type='event' GROUP BY subject_id) m ON d.rowid = m.r
         WHERE d.state = 'NORMAL'`,
      )
      .get() as { c: number };
    assert.equal(summary.totals.requiredNothing, normal.c);
    const attention = (a: string) =>
      (db.prepare("SELECT COUNT(*) AS c FROM exceptions WHERE attention = ?").get(a) as { c: number }).c;
    assert.equal(summary.totals.safelyHandled, attention("AUTO_HANDLED") + attention("HANDLED"));
    assert.equal(summary.totals.monitored, attention("MONITORING"));
    assert.equal(summary.totals.needYou, attention("NEEDS_YOU") + attention("NEEDS_APPROVAL") + attention("BLOCKED"));
    assert.match(
      summary.headline,
      new RegExp(
        `Your business is running · ${summary.totals.eventsUnderstood} events understood · ${summary.totals.requiredNothing} required nothing · ${summary.totals.safelyHandled} safely handled · ${summary.totals.monitored} monitored · ${summary.totals.needYou} need you`,
      ),
    );

    eventsFor(db).append({
      type: "payment.received",
      source: "bank",
      source_id: "test_extra_payment",
      entity_type: "customer",
      entity_id: "ent_rt_cust_1",
      payload: { amount: 1000 },
      occurred_at: getMeta(db, "demo_now"),
      idempotent: true,
    });
    const next = autopilotSummary(db);
    assert.equal(next.totals.eventsUnderstood, summary.totals.eventsUnderstood + 1);
    assert.equal(next.totals.requiredNothing, summary.totals.requiredNothing + 1);
  });

  it("IDEMPOTENCY: evaluating 3× creates no duplicate actions, events, verifications, outcomes or decisions", () => {
    const db = getDb();
    runAutopilot(db);
    const first = counts();
    const second = runAutopilot(db);
    runAutopilot(db);
    autopilotSummary(db);
    assert.deepEqual(counts(), first);
    assert.deepEqual(second.exceptionsCreated, []);
    assert.deepEqual(second.plansCreated, []);
    assert.deepEqual(second.actionsExecuted, []);
    assert.equal(second.decisionsWritten, 0);
  });

  it("FAILURE: a failed action escalates to NEEDS_YOU and is not retried", () => {
    const db = getDb();
    const id = signalExceptionId("evt_rt_sig_task_0");
    const [action] = actionsOf(id);
    db.prepare("UPDATE actions SET status = 'failed' WHERE id = ?").run(action.id);
    assert.equal(classify(gatherFacts(db, exception(id))).state, "NEEDS_YOU");
    runAutopilot(db);
    assert.equal(state(id), "NEEDS_YOU");
    assert.equal(exception(id).attention, "NEEDS_YOU");
    db.prepare("UPDATE actions SET status = 'executed' WHERE id = ?").run(action.id);
    runAutopilot(db);
    assert.equal(state(id), "AUTO_HANDLED");
  });
});

describe("HIGH-IMPACT ESCALATION", { concurrency: 1 }, () => {
  before(() => wipeAndSeed(getDb()));

  it("a request above the escalation threshold goes to NEEDS_YOU, not NEEDS_APPROVAL", () => {
    const db = getDb();
    const event = eventsFor(db).append({
      id: "evt_test_big_request",
      type: "customer.request",
      source: "inbox",
      source_id: "test_big_request",
      entity_type: "customer",
      entity_id: "ent_rt_cust_5",
      payload: { customer: "Annaba Pharma", request: "re-price the Q4 contract", orderValue: 450_000, text: "Can we re-price Q4?" },
      occurred_at: getMeta(db, "demo_now"),
      idempotent: true,
    });
    runAutopilot(db);
    assert.equal(state(signalExceptionId(event.id)), "NEEDS_YOU");
  });

  it("an AUTO-able fix above the threshold is still not executed automatically", () => {
    const db = getDb();
    const event = eventsFor(db).append({
      id: "evt_test_big_stock",
      type: "inventory.low",
      source: "wms",
      source_id: "test_big_stock",
      entity_type: "product",
      entity_id: "ent_test_big_sku",
      payload: { sku: "RK-7 racking kits", onHand: 1, reorderPoint: 12, reorderValue: 600_000 },
      occurred_at: getMeta(db, "demo_now"),
      idempotent: true,
    });
    runAutopilot(db);
    const id = signalExceptionId(event.id);
    assert.equal(state(id), "NEEDS_YOU");
    assert.equal(actionsOf(id)[0].status, "proposed");
  });

  it("supplier delay: graph impact → NEEDS YOU with early warnings and a prepared response", () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const summary = autopilotSummary(db);
    const card = summary.cards.find((c) => c.id === IDS.excDelay);
    assert.ok(card);
    assert.equal(card.state, "NEEDS_YOU");
    assert.equal(card.rule, "R10_HIGH_IMPACT");
    assert.equal(card.impactValue, 850_000);
    assert.ok(card.earlyWarnings.some((w) => w.id === `ew_${IDS.commitDeliverA}`));
    assert.ok(card.actions.some((a) => a.gate === "NEEDS_APPROVAL"));
    assert.ok(card.actions.every((a) => a.gate !== "EXECUTED"));
  });
});

describe("goal engine coexistence (#6)", { concurrency: 1 }, () => {
  before(() => wipeAndSeed(getDb()));

  it("goal-plan actions stay with the goal engine and do not change exception cards", () => {
    const db = getDb();
    const now = getMeta(db, "demo_now");
    triggerSupplierDelay(db);
    const before = autopilotSummary(db).cards.find((c) => c.id === IDS.excDelay)!;
    const goal = createGoal(db, { utterance: "Protect everything at risk this week." }, now);
    const planId = goal.plan?.id;
    assert.ok(planId);
    executeSafeActions(db, planId, now);
    const afterCard = autopilotSummary(db).cards.find((c) => c.id === IDS.excDelay)!;
    assert.equal(afterCard.state, "NEEDS_YOU");
    assert.deepEqual(afterCard.actions.map((a) => a.id), before.actions.map((a) => a.id));
    const settled = counts();
    runAutopilot(db);
    assert.deepEqual(counts(), settled);
  });
});

describe("adapter seams", { concurrency: 1 }, () => {
  before(() => wipeAndSeed(getDb()));
  after(() => resetAutopilotAdapters());

  it("uses a registered planner and early-warning source instead of the defaults", () => {
    const db = getDb();
    setAutopilotAdapters({
      planner: {
        name: "test-planner",
        planFor: (d, e, now) =>
          e.kind === "delivery_delay"
            ? { title: "Test plan", summary: "from seam", actions: [{ type: "create_task", title: "Seam task", description: "", payload: {} }] }
            : templatePlanner.planFor(d, e, now),
      },
      earlyWarnings: { name: "test-ew", warningsFor: (_d, e) => (e.id === IDS.excDelay ? [{ id: "ew_test", title: "from seam", detail: "", source: "test" }] : []) },
    });
    triggerSupplierDelay(db);
    const card = autopilotSummary(db).cards.find((c) => c.id === IDS.excDelay);
    assert.deepEqual(card?.actions.map((a) => a.title), ["Seam task"]);
    assert.deepEqual(card?.earlyWarnings.map((w) => w.id), ["ew_test"]);
  });
});

describe("SIGNATURE DEMO (§48) — offline, end to end", { concurrency: 1 }, () => {
  before(() => {
    resetAutopilotAdapters();
    wipeAndSeed(getDb());
  });

  it("reset → supplier delay → 320K recovery → approve → verify → HANDLED → 10% BLOCKED", async () => {
    const db = getDb();

    // Reset: the business is running; routine activity is silent.
    let summary = autopilotSummary(db);
    assert.match(summary.headline, /^Your business is running · \d+ events understood/);
    assert.ok(summary.totals.eventsUnderstood >= 150);
    assert.ok(summary.totals.requiredNothing > summary.totals.eventsUnderstood * 0.8);
    assert.ok(!summary.cards.some((c) => c.id === IDS.excDelay));

    // Supplier delay arrives → only NEEDS YOU.
    triggerSupplierDelay(db);
    summary = autopilotSummary(db);
    assert.equal(summary.cards.find((c) => c.id === IDS.excDelay)?.state, "NEEDS_YOU");

    // 320K commitment miss: recovery prepared, external send needs approval, card NEEDS YOU.
    let card = summary.cards.find((c) => c.id === IDS.excMissed)!;
    assert.equal(card.state, "NEEDS_YOU");
    assert.equal(card.actions.find((a) => a.type === "draft_message")?.gate, "NEEDS_APPROVAL");
    assert.ok(card.memory, "strategy memory evidence shown on the card");
    assert.equal(actionsOf(IDS.excMissed).filter((a) => a.status === "executed").length, 0, "autopilot never executes a NEEDS_YOU plan");

    // Reply before approval is refused — verification cannot precede the action.
    assert.equal(receiveCustomerReply(db).ok, false);
    assert.equal(eventsFor(db).getById(CUSTOMER_REPLY_EVENT_ID), undefined);

    // User approves → actions execute → verification pending → MONITORING.
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    summary = autopilotSummary(db);
    card = summary.cards.find((c) => c.id === IDS.excMissed)!;
    assert.equal(card.state, "MONITORING");
    assert.equal(card.verification?.status, "PENDING");
    assert.ok(card.actions.every((a) => a.gate === "EXECUTED"));
    const early = db.prepare("SELECT COUNT(*) AS c FROM outcomes WHERE exception_id = ?").get(IDS.excMissed) as { c: number };
    assert.equal(early.c, 0, "no outcome before verification resolves");

    // Customer reply arrives → verification succeeds → outcome stored → HANDLED.
    const reply = receiveCustomerReply(db);
    assert.equal(reply.ok, true);
    assert.equal(receiveCustomerReply(db).ok, true, "second click is a no-op, not an error");
    assert.equal(eventsFor(db).listByType(EVENT_TYPES.CUSTOMER_REPLIED).length, 1);
    const verification = db.prepare("SELECT * FROM verifications WHERE exception_id = ?").all(IDS.excMissed) as { id: string; status: string }[];
    assert.equal(verification.length, 1);
    assert.equal(verification[0].status, "SUCCESS");
    const outcomes = db.prepare("SELECT * FROM outcomes WHERE verification_id = ?").all(verification[0].id) as { success: number }[];
    assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].success, 1);
    summary = autopilotSummary(db);
    card = summary.cards.find((c) => c.id === IDS.excMissed)!;
    assert.equal(card.state, "HANDLED");
    assert.equal(card.rule, "R04_VERIFIED");
    assert.deepEqual(
      card.history.map((h) => h.state),
      ["NEEDS_YOU", "MONITORING", "HANDLED"],
      "card moves NEEDS YOU → MONITORING → HANDLED",
    );
    assert.equal(exception(IDS.excMissed).attention, "HANDLED");

    // 10% discount → BLOCKED, maximum 5%, alternative prepared.
    await ingestSeedDiscount(db);
    summary = autopilotSummary(db);
    const blocked = summary.cards.find((c) => c.id === IDS.excDiscount)!;
    assert.equal(blocked.state, "BLOCKED");
    assert.match(blocked.reason, /Maximum allowed: 5%/);
    assert.match(blocked.reason, /Alternative prepared: Alternative — offer 5%/);
    assert.ok(blocked.actions.some((a) => a.gate === "BLOCKED"));
    assert.ok(blocked.actions.some((a) => a.gate !== "BLOCKED" && a.type === "apply_discount"));
    assert.throws(() => executeAction(db, IDS.actDiscount, getMeta(db, "demo_now")), /discount_max=5%/);
    // The 320K card stays HANDLED; the reply was not double-counted.
    assert.equal(summary.cards.find((c) => c.id === IDS.excMissed)?.state, "HANDLED");

    // Every exception decision is auditable.
    const audited = db
      .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE actor = 'autopilot' AND action = 'autopilot.classify' AND object_id = ?")
      .get(IDS.excMissed) as { c: number };
    assert.equal(audited.c, 3);
    const decision = DecisionLog.for(db).latest("exception", IDS.excDiscount)!;
    assert.equal(decision.rule, "R02_POLICY_BLOCKED");
    assert.equal(JSON.parse(decision.input_json).policy, "BLOCKED");
    assert.ok(decision.decided_at);

    // Idempotent after the whole demo, too.
    const settled = counts();
    runAutopilot(db);
    runAutopilot(db);
    runAutopilot(db);
    assert.deepEqual(counts(), settled);

    // Legacy pulse still works alongside the autopilot.
    assert.ok(pulseSummary(db, getMeta(db, "demo_now")).exceptions.length > 0);

    // OFFLINE: nothing above touched the network.
    assert.equal(networkCalls, 0);
  });
});

describe("card history without a Pulse render in between", { concurrency: 1 }, () => {
  before(() => wipeAndSeed(getDb()));

  it("records MONITORING before the reply resolves the verification", () => {
    const db = getDb();
    runAutopilot(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    assert.equal(receiveCustomerReply(db).ok, true);
    assert.deepEqual(
      DecisionLog.for(db).history("exception", IDS.excMissed).map((d) => d.state),
      ["NEEDS_YOU", "MONITORING", "HANDLED"],
    );
  });
});
