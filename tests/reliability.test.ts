import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DeterministicRuntime, getAgentRuntime, safeAgentRuntime } from "../lib/agent";
import { CommandRouter } from "../lib/command";
import { DEMO_NOW_ISO } from "../lib/clock";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { calculateGraphImpact } from "../lib/engine/impact";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { evaluatePolicy, loadPolicies } from "../lib/engine/policy";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { ExceptionAutopilotService } from "../lib/autopilot";
import { createGoal } from "../lib/goals";
import { IDS } from "../lib/ids";
import { expireAndRecord, OutcomeLedger, SEED_FOLLOWUP_SIGNATURE, StrategyMemory, VerificationService } from "../lib/learning";
import { wipeAndSeed } from "../lib/seed";
import { runSimulation, stateFingerprint } from "../lib/simulation";
import { DELIVER_A_WARNING_ID, EarlyWarningEngine } from "../lib/warnings";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-rel-")), "reliability.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.EVOPULSE_AGENT_RUNTIME;
resetDbFile();

const AFTER_DEADLINE = "2026-09-29T10:01:00+01:00";
const PLUS_3 = { type: "supplier_delay", targetId: IDS.shipment, days: 3 } as const;

function jsonReq(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fingerprint(db: ReturnType<typeof getDb>) {
  const count = (table: string) => {
    try {
      return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    } catch {
      return 0;
    }
  };
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
    entities: count("entities"),
    commitments: count("commitments"),
    expectations: count("expectations"),
    graphNodes: count("graph_nodes"),
    graphEdges: count("graph_edges"),
    policies: count("policies"),
    agentRuns: count("agent_runs"),
    now: getMeta(db, "demo_now"),
    phase: getMeta(db, "demo_phase", "seeded"),
    supplier: getMeta(db, "supplier_phase", "stable"),
  };
}

describe("demo reliability", { concurrency: 1 }, () => {
  describe("DEMO RESET", () => {
    it("wipeAndSeed twice yields the same starting state", () => {
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
      assert.equal(reset.now, DEMO_NOW_ISO);
      assert.equal(reset.phase, "seeded");
      assert.equal(reset.supplier, "stable");
      assert.equal(reset.sessions, 0);
      assert.equal(reset.agentRuns, 0);
      assert.equal(reset.exceptions, again.exceptions);
      assert.equal(reset.events, again.events);
    });

    it("POST /api/demo/reset twice restores identical starting state", async () => {
      const { POST } = await import("../app/api/demo/reset/route");
      const db = getDb();
      triggerSupplierDelay(db);
      const first = await POST();
      assert.equal(first.status, 200);
      const once = await first.json();
      const afterFirst = fingerprint(getDb());
      const second = await POST();
      assert.equal(second.status, 200);
      const twice = await second.json();
      assert.deepEqual(twice, once);
      assert.equal(once.ok, true);
      assert.equal(once.phase, "seeded");
      assert.equal(once.supplier_phase, "stable");
      assert.deepEqual(fingerprint(getDb()), afterFirst);
    });
  });

  describe("canonical smoke", () => {
    it("Atlas cascade is 850K associated revenue and 540K expected cash", () => {
      const db = getDb();
      wipeAndSeed(db);
      triggerSupplierDelay(db);
      const impact = calculateGraphImpact(db, IDS.shipment);
      assert.equal(impact.affected_orders.length, 3);
      assert.equal(impact.affected_customers.length, 3);
      assert.equal(impact.associated_revenue, 850000);
      assert.equal(impact.affected_expected_cash, 540000);
      const pulse = pulseSummary(db, getMeta(db, "demo_now"));
      const cascade = pulse.attention.items.find((item) => item.sourceExceptionId === IDS.excDelay);
      assert.equal(cascade?.impact.associatedRevenue, 850000);
      assert.equal(cascade?.impact.expectedCash, 540000);
    });

    it("320K approval and discount_max=5% blocks 10%", async () => {
      const db = getDb();
      wipeAndSeed(db);
      const pulse = pulseSummary(db, getMeta(db, "demo_now"));
      const missed = pulse.exceptions.find((item) => item.id === IDS.excMissed);
      assert.equal(missed?.impact.revenueAssociated, 320000);
      const policies = loadPolicies(db);
      assert.equal(Number(policies.discount_max), 5);
      const blocked = evaluatePolicy({ type: "apply_discount", payload: { percent: 10 } }, policies);
      assert.equal(blocked.outcome, "BLOCKED");
      assert.match(blocked.reason, /discount_max=5/);
      executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
      await ingestSeedDiscount(db);
      const ten = db.prepare("SELECT policy_outcome, status FROM actions WHERE id = ?").get(IDS.actDiscount) as {
        policy_outcome: string;
        status: string;
      };
      assert.equal(ten.policy_outcome, "BLOCKED");
      assert.notEqual(ten.status, "executed");
    });

    it("Early Warning is live before the deadline", () => {
      const db = getDb();
      wipeAndSeed(db);
      triggerSupplierDelay(db);
      const warning = EarlyWarningEngine.for(db).get(DELIVER_A_WARNING_ID);
      assert.ok(warning);
      assert.notEqual(warning.status, "ESCALATED");
      const pulse = pulseSummary(db, getMeta(db, "demo_now"));
      assert.ok(pulse.comingNext.some((row) => row.id === DELIVER_A_WARNING_ID && !row.failed));
    });

    it("warning → exception is one card after the deadline, never two", () => {
      const db = getDb();
      wipeAndSeed(db);
      triggerSupplierDelay(db);
      const before = pulseSummary(db, getMeta(db, "demo_now"));
      const beforeCards = before.attention.items.filter(
        (item) => item.sourceExceptionId === IDS.excDelay || item.sourceWarningId === DELIVER_A_WARNING_ID,
      );
      assert.equal(beforeCards.length, 1);
      pulseSummary(db, AFTER_DEADLINE);
      const after = pulseSummary(db, AFTER_DEADLINE);
      const afterCards = after.attention.items.filter(
        (item) => item.sourceExceptionId === IDS.excDelay || item.sourceWarningId === DELIVER_A_WARNING_ID,
      );
      const standalone = after.attention.items.filter((item) => item.id === `warning:${DELIVER_A_WARNING_ID}`);
      const escalated = EarlyWarningEngine.for(db).get(DELIVER_A_WARNING_ID);
      assert.ok(escalated?.status === "ESCALATED" || escalated?.status === "RESOLVED");
      assert.equal(standalone.length, 0);
      assert.equal(afterCards.length, 1);
      assert.equal(afterCards[0].id, `exception:${IDS.excDelay}`);
    });

    it("simulation isolation: +3d moves 160000 Invoice C timing and leaves reality unchanged", () => {
      const db = getDb();
      wipeAndSeed(db);
      triggerSupplierDelay(db);
      const before = stateFingerprint(db);
      const result = runSimulation(db, PLUS_3);
      assert.equal(result.mode, "SIMULATION");
      assert.equal(result.delta.cash.movedToNextPeriod, 160000);
      const orderC = result.changes.find((change) => change.id === IDS.orderC);
      assert.equal(orderC?.shiftDays, 3);
      assert.equal(result.isolation.unchanged, true);
      assert.equal(stateFingerprint(db).hash, before.hash);
      assert.equal(getMeta(db, "supplier_phase"), "delayed");
    });

    it("goal plans protection without firing the supplier delay", () => {
      const db = getDb();
      wipeAndSeed(db);
      const created = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
      assert.equal(created.goal.goal_type, "protect_business");
      assert.ok(created.plan);
      assert.equal(getMeta(db, "supplier_phase", "stable"), "stable");
      assert.equal(created.context.exceptions.some((item) => item.id === IDS.excDelay), false);
    });

    it("Autopilot: 320K needs approval, cascade needs you, safe checkpoint is not HANDLED", () => {
      const db = getDb();
      wipeAndSeed(db);
      const now = getMeta(db, "demo_now");
      const service = ExceptionAutopilotService.for(db);
      const seeded = service.evaluateSituation(now);
      assert.equal(seeded.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "NEEDS_APPROVAL");
      triggerSupplierDelay(db);
      const cascade = service.evaluateSituation(now);
      assert.equal(cascade.cards.find((card) => card.exceptionId === IDS.excDelay)?.classification, "NEEDS_YOU");
      const handled = service.handleSafe(now);
      assert.ok(handled.handleSafe.executed.includes(IDS.actCheck));
      const checkpoint = service.listDecisions().find((row) => row.action_id === IDS.actCheck);
      assert.equal(checkpoint?.classification, "AUTO_HANDLED");
      assert.notEqual(checkpoint?.classification, "HANDLED");
    });

    it("EXECUTED != HANDLED: verification success then failure", async () => {
      const db = getDb();
      wipeAndSeed(db);
      executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
      const pending = VerificationService.for(db).getPendingVerifications(IDS.excMissed);
      assert.ok(pending.length >= 1);
      const afterExecute = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
      assert.equal(afterExecute.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "MONITORING");
      assert.notEqual(afterExecute.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "HANDLED");

      await ingestSeedDiscount(db);
      const success = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
      assert.equal(success.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "HANDLED");
      const outcomes = OutcomeLedger.for(db).listByContext(SEED_FOLLOWUP_SIGNATURE);
      assert.ok(outcomes.length >= 1);
      const evidence = StrategyMemory.for(db).getStrategyEvidence(SEED_FOLLOWUP_SIGNATURE);
      assert.ok(evidence.strategies.length >= 1);

      wipeAndSeed(db);
      executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
      expireAndRecord(db, "2026-09-29T12:00:00+01:00");
      const failed = ExceptionAutopilotService.for(db).evaluateSituation("2026-09-29T12:00:00+01:00");
      assert.equal(failed.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "NEEDS_YOU");
      assert.notEqual(failed.cards.find((card) => card.exceptionId === IDS.excMissed)?.classification, "HANDLED");
    });

    it("command: context follow-up stays a simulation; unknown does not invent an answer", () => {
      const db = getDb();
      wipeAndSeed(db);
      const command = new CommandRouter(db);
      const first = command.route("Why is 850K at risk?");
      assert.equal(first.data.associatedRevenue, 850000);
      assert.equal(first.data.expectedCash, 540000);
      const follow = command.route("What if it is 3 days later?", first.session.id);
      assert.equal(follow.intent, "SIMULATION");
      assert.equal(follow.data.targetId, IDS.shipment);
      assert.equal(follow.data.realityUnchanged, true);
      const unknown = command.route("What is the weather in Tokyo?");
      assert.equal(unknown.intent, "UNKNOWN");
      assert.match(unknown.summary, /don't have enough structured business data/);
    });
  });

  describe("route smoke", () => {
    it("POST /api/demo/reset, GET /api/health, POST /api/ask unknown, GET /api/pulse", async () => {
      const reset = await import("../app/api/demo/reset/route");
      const health = await import("../app/api/health/route");
      const ask = await import("../app/api/ask/route");
      const pulse = await import("../app/api/pulse/route");

      const resetRes = await reset.POST();
      assert.equal(resetRes.status, 200);
      const resetBody = await resetRes.json();
      assert.equal(resetBody.ok, true);
      assert.equal(resetBody.phase, "seeded");
      assert.equal(resetBody.supplier_phase, "stable");

      const healthRes = await health.GET();
      assert.equal(healthRes.status, 200);
      const healthBody = await healthRes.json();
      assert.equal(healthBody.ok, true);
      assert.equal(healthBody.now, DEMO_NOW_ISO);
      assert.equal(healthBody.phase, "seeded");
      assert.equal(healthBody.supplier_phase, "stable");
      assert.equal(healthBody.brev, "not used");

      const askRes = await ask.POST(jsonReq("http://local/api/ask", { message: "What is the weather in Tokyo?" }));
      assert.equal(askRes.status, 200);
      const askBody = await askRes.json();
      assert.equal(askBody.grounded, false);
      assert.ok(typeof (askBody.answer || askBody.summary) === "string");
      assert.ok(String(askBody.answer || askBody.summary).length > 0);

      const pulseRes = await pulse.GET();
      assert.equal(pulseRes.status, 200);
      const pulseBody = await pulseRes.json();
      assert.equal(pulseBody.now, DEMO_NOW_ISO);
      assert.ok(pulseBody.attention);
      assert.ok(pulseBody.exceptions.some((item: { id: string }) => item.id === IDS.excMissed));
    });
  });

  describe("FALLBACK", () => {
    it("AgentRuntime is deterministic when no provider is configured", async () => {
      const db = getDb();
      wipeAndSeed(db);
      const runtime = getAgentRuntime(db);
      assert.equal(runtime instanceof DeterministicRuntime, true);
      assert.equal(safeAgentRuntime(db) instanceof DeterministicRuntime, true);
      const result = await runtime.run({ command: "Why is 850K at risk?" });
      assert.equal(result.runtime, "deterministic");
      assert.equal(result.report.associatedRevenue, 850000);
      assert.equal(result.report.expectedCash, 540000);
      assert.equal(result.fallbackUsed, false);
    });

    it("POST /api/ask stays useful without a model provider", async () => {
      const { POST } = await import("../app/api/ask/route");
      wipeAndSeed(getDb());
      const known = await POST(jsonReq("http://local/api/ask", { question: "Why is 850K at risk?" }));
      assert.equal(known.status, 200);
      const knownBody = await known.json();
      assert.equal(knownBody.grounded, true);
      assert.equal(knownBody.agent?.runtime, "deterministic");
      assert.equal(knownBody.data?.associatedRevenue ?? knownBody.agent?.report?.associatedRevenue, 850000);

      const unknown = await POST(jsonReq("http://local/api/ask", { message: "What is the weather in Tokyo?" }));
      assert.equal(unknown.status, 200);
      const unknownBody = await unknown.json();
      assert.equal(unknownBody.grounded, false);
      assert.ok(String(unknownBody.answer || unknownBody.summary).length > 0);
    });
  });
});
