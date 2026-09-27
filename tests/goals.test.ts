import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile, run } from "../lib/db";
import { executeAction } from "../lib/engine/execute";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { evaluatePolicy, loadPolicies } from "../lib/engine/policy";
import { IDS } from "../lib/ids";
import {
  ACTION_CATALOG,
  createGoal,
  executeSafeActions,
  interpretGoal,
  isCatalogAction,
  orderAmountsFromDb,
  prioritizeRisks,
} from "../lib/goals";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-goals-")), "goals.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
resetDbFile();

describe("goal engine + planner", { concurrency: 1 }, () => {
  it("maps 'Protect everything at risk this week' to protect_business / this_week", () => {
    const interpreted = interpretGoal({ utterance: "Protect everything at risk this week." });
    assert.equal(interpreted.goalType, "protect_business");
    assert.equal(interpreted.scope, "this_week");
  });

  it("creates a persisted goal and structured plan from live state", () => {
    const db = getDb();
    const now = getMeta(db, "demo_now");
    assert.equal(getMeta(db, "supplier_phase", "stable"), "stable");
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, now);
    assert.equal(getMeta(db, "supplier_phase", "stable"), "stable");
    assert.equal(result.goal.goal_type, "protect_business");
    assert.equal(result.goal.status, "ACTIVE");
    assert.ok(result.plan);
    assert.ok(result.plan!.actions.length >= 1);
    assert.ok(result.plan!.id);
    assert.equal(result.plan!.goalId, result.goal.id);
  });

  it("includes sales / operations / cash risks from stored amounts — not planner constants", () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const totals = orderAmountsFromDb(db);
    assert.equal(totals.revenue, 850000);
    assert.equal(totals.cash, 540000);
    assert.equal(totals.orders, 3);
    assert.equal(totals.customers, 3);

    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    const sales = result.context.risks.find((r) => r.domain === "sales");
    const ops = result.context.risks.find((r) => r.domain === "operations");
    const cash = result.context.risks.find((r) => r.domain === "cash");
    assert.ok(sales);
    assert.ok(ops);
    assert.ok(cash);
    assert.equal(sales.associatedValue, 320000);
    assert.equal(ops.associatedValue, totals.revenue);
    assert.equal(cash.associatedValue, totals.cash);
    assert.ok(result.context.exceptions.some((e) => e.id === IDS.excMissed));
    assert.ok(result.context.exceptions.some((e) => e.id === IDS.excDelay));
    assert.ok(result.plan!.actions.length >= 6);
  });

  it("excludes resolved and unrelated risks from goal context", () => {
    const db = getDb();
    run(db, "UPDATE exceptions SET status = ?, attention = ? WHERE id = ?", [
      "resolved",
      "HANDLED",
      IDS.excMissed,
    ]);
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    assert.ok(!result.context.risks.some((r) => r.exceptionId === IDS.excMissed && !r.resolved));
    assert.ok(!result.context.exceptions.some((e) => e.id === IDS.excMissed));
    assert.ok(!result.context.risks.some((r) => r.kind === "policy_blocked"));
    run(db, "UPDATE exceptions SET status = ?, attention = ? WHERE id = ?", ["open", "NEEDS_YOU", IDS.excMissed]);
  });

  it("only emits catalog action types and evidence on consequential actions", () => {
    const db = getDb();
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    for (const action of result.plan!.actions) {
      assert.ok(isCatalogAction(action.type), action.type);
      assert.ok(ACTION_CATALOG.includes(action.type as (typeof ACTION_CATALOG)[number]));
      assert.ok(action.evidence?.reason, action.title);
      assert.ok(action.evidence.kind);
    }
    const prioritize = result.plan!.actions.find((a) => a.type === "prioritize_order");
    assert.ok(prioritize);
    assert.ok(prioritize.evidence.path.length >= 3);
    assert.ok((prioritize.evidence.associatedValue || 0) > 0);
  });

  it("ranks higher urgency/impact ahead of lower-impact cash timing", () => {
    const db = getDb();
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    const ranked = prioritizeRisks(result.context.risks);
    assert.ok(ranked[0].priority.score >= ranked[ranked.length - 1].priority.score);
    const ops = ranked.find((r) => r.domain === "operations");
    const cash = ranked.find((r) => r.domain === "cash");
    assert.ok(ops && cash);
    assert.ok(ops.priority.score > cash.priority.score);
    assert.match(ops.priority.whyFirst, /impact/);
  });

  it("classifies AUTO / APPROVAL_REQUIRED / BLOCKED through the existing policy engine", () => {
    const db = getDb();
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    const policies = loadPolicies(db);
    const auto = result.plan!.actions.find((a) => a.type === "prepare_proposal" || a.type === "create_task");
    const draft = result.plan!.actions.find((a) => a.type === "draft_message");
    const ten = result.plan!.actions.find((a) => a.type === "apply_discount" && a.parameters.percent === 10);
    const five = result.plan!.actions.find((a) => a.type === "apply_discount" && a.parameters.percent === 5);
    assert.ok(auto && draft && ten && five);
    assert.equal(auto.policyDecision, evaluatePolicy({ type: auto.type, payload: auto.parameters }, policies).outcome);
    assert.equal(auto.policyDecision, "AUTO");
    assert.equal(draft.policyDecision, "APPROVAL_REQUIRED");
    assert.equal(ten.policyDecision, "BLOCKED");
    assert.match(ten.policyReason, /discount_max=5/);
    assert.equal(five.policyDecision, "APPROVAL_REQUIRED");
    assert.ok(result.plan!.expectedImpact.autoActions >= 1);
    assert.ok(result.plan!.expectedImpact.approvalRequiredActions >= 1);
    assert.ok(result.plan!.expectedImpact.blockedActions >= 1);
  });

  it("execute safe actions runs only AUTO — never approval-required or blocked", () => {
    const db = getDb();
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    const planId = result.plan!.id!;
    const outcome = executeSafeActions(db, planId, getMeta(db, "demo_now"));
    assert.equal(outcome.counts.executed, result.plan!.expectedImpact.autoActions);
    assert.equal(outcome.counts.waitingForApproval, result.plan!.expectedImpact.approvalRequiredActions);
    assert.equal(outcome.counts.blocked, result.plan!.expectedImpact.blockedActions);

    for (const action of outcome.plan.actions) {
      if (action.policyDecision === "AUTO") {
        const row = result.plan!.actions.find((a) => a.id === action.id);
        assert.ok(action.id);
      }
      if (action.policyDecision === "APPROVAL_REQUIRED") {
        assert.notEqual(action.policyDecision, "AUTO");
      }
      if (action.policyDecision === "BLOCKED") {
        assert.equal(action.policyDecision, "BLOCKED");
      }
    }

    const liveAuto = outcome.plan.actions.filter((a) => a.policyDecision === "AUTO");
    for (const action of liveAuto) {
      assert.ok(action.id);
    }

    const approvalIds = outcome.pendingApproval;
    for (const actionId of approvalIds) {
      assert.throws(() => executeAction(db, actionId, getMeta(db, "demo_now")));
    }
    const blockedIds = outcome.blocked;
    for (const actionId of blockedIds) {
      assert.throws(() => executeAction(db, actionId, getMeta(db, "demo_now")));
    }

    const refreshed = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    assert.notEqual(refreshed.goal.status, "COMPLETED");
  });

  it("persists goal → plan → action links and stays active after planning", () => {
    resetDbFile();
    const db = getDb();
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    assert.equal(result.goal.status, "ACTIVE");
    assert.ok(result.plan!.actions.every((a) => a.parameters.goalId === result.goal.id));
    assert.ok(result.plan!.actions.every((a) => a.parameters.planId === result.plan!.id));
    assert.equal(result.plan!.simulation.evaluable, true);
  });

  it("works offline without an LLM API key", () => {
    assert.equal(process.env.OPENAI_API_KEY, undefined);
    const interpreted = interpretGoal({ utterance: "Protect everything at risk this week" });
    assert.equal(interpreted.goalType, "protect_business");
    const db = getDb();
    const result = createGoal(db, { utterance: "Protect everything at risk this week" }, getMeta(db, "demo_now"));
    assert.ok(result.plan!.actions.length > 0);
    assert.equal(result.plan!.actions[0].evidence.kind === "AI_RECOMMENDATION", false);
  });
});
