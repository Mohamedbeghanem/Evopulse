import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";
import {
  AutonomyError,
  annotatePlanActions,
  approvePromotion,
  autonomyGate,
  autonomyHistorySignature,
  demotionTrigger,
  emergencyPause,
  emergencyResume,
  getProfile,
  listChanges,
  listProfiles,
  reinstateAction,
  reportPolicyViolationAttempt,
  reportSevereFailure,
  reseedAutonomy,
  reviewProfile,
  SEEDED_AUTONOMY,
  suspendAction,
  evidenceFor,
  ensureAutonomyHooks,
  adaptiveAutonomyGate,
  gateAction,
  policyOnlyGate,
} from "../lib/autonomy";
import { all, getDb, one, resetDbFile, run } from "../lib/db";
import { eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import { LEARNING_EVENT_TYPES, OutcomeLedger } from "../lib/learning";
import type { ActionRow } from "../lib/types";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-autonomy-")), "autonomy.db");
resetDbFile();

const NOW = "2026-09-27T09:00:00.000Z";
let seq = 0;

/** Newer-than-seed outcome rows for one action type. Prefix syn_aut_ so reseedAutonomy wipes them. */
function addOutcomes(type: string, results: boolean[], result?: string) {
  const ledger = OutcomeLedger.for(getDb());
  for (const success of results) {
    seq += 1;
    ledger.record({
      id: `syn_aut_test_${String(seq).padStart(4, "0")}`,
      problem_type: "autonomy_history",
      context_signature: autonomyHistorySignature(type),
      action_id: null,
      strategy: type,
      result: result ?? (success ? "verified_success" : "verified_failure"),
      success,
      created_at: new Date(Date.parse(NOW) + seq * 60_000).toISOString(),
    });
  }
}

function expectAutonomyError(fn: () => unknown, status: number, pattern: RegExp) {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof AutonomyError, "AutonomyError");
    assert.equal(err.status, status);
    assert.match(err.message, pattern);
    return true;
  });
}

describe("adaptive autonomy", { concurrency: 1 }, () => {
  beforeEach(() => {
    const db = getDb();
    run(db, "DELETE FROM policies WHERE key = 'external_message_requires_approval'");
    run(db, "INSERT INTO policies (id, key, value, description) VALUES ('pol_msg', 'external_message_requires_approval', 'true', 'Customer-facing messages need a human')");
    reseedAutonomy(db);
  });

  it("seeded profiles reproduce the product test from outcome rows", () => {
    const db = getDb();
    const byType = Object.fromEntries(listProfiles(db).map((p) => [p.actionType, p]));

    const check = byType.create_checkpoint;
    assert.equal(check.label, "Create internal checkpoint");
    assert.equal(check.effectiveLevel, 4);
    assert.equal(check.effectiveLevelName, "Operate Within Policy");
    assert.equal(check.evidenceText, "31 verified outcomes · 30 successful");
    assert.equal(check.limitReason, "31 verified outcomes · 30 successful");

    const task = byType.create_task;
    assert.equal(task.effectiveLevel, 4);
    assert.equal(task.evidenceText, "40 verified outcomes · 39 successful");

    const draft = byType.draft_message;
    assert.equal(draft.label, "Prepare customer follow-up");
    assert.equal(draft.effectiveLevel, 3);
    assert.equal(draft.effectiveLevelName, "Execute Safe");
    assert.equal(draft.evidence.verified, 22);
    assert.match(draft.limitReason, /^22 verified outcomes/);

    const send = byType.send_message;
    assert.equal(send.effectiveLevel, 2);
    assert.equal(send.effectiveLevelName, "Prepare");
    assert.equal(send.limitReason, "Policy ceiling");

    const discount = byType.apply_discount;
    assert.equal(discount.effectiveLevel, 1);
    assert.equal(discount.effectiveLevelName, "Recommend");
    assert.equal(discount.limitReason, "Financial control");

    const del = byType.delete_customer_data;
    assert.equal(del.effectiveLevel, 0);
    assert.equal(del.effectiveLevelName, "Observe");
    assert.equal(del.limitReason, "Autonomy prohibited");

    // Numbers come from ledger rows, not labels.
    for (const [type, spec] of Object.entries(SEEDED_AUTONOMY)) {
      const rows = all<{ success: number }>(db, "SELECT success FROM outcomes WHERE context_signature = ?", [
        autonomyHistorySignature(type),
      ]);
      assert.equal(rows.length, spec.successes + spec.failures, `${type} rows`);
      assert.equal(rows.filter((r) => r.success === 1).length, spec.successes, `${type} successes`);
      assert.equal(byType[type].evidence.verified, rows.length);
    }
    // Deleting a row moves the number: nothing is hardcoded.
    run(db, "DELETE FROM outcomes WHERE id = 'syn_aut_ck_01'");
    assert.equal(getProfile(db, "create_checkpoint")!.evidenceText, "30 verified outcomes · 29 successful");
  });

  it("promotion: a named human applies one level, only for a candidate", () => {
    const db = getDb();
    const before = getProfile(db, "prepare_proposal")!;
    assert.equal(before.level, 2);
    assert.equal(before.candidateLevel, 3);

    expectAutonomyError(() => approvePromotion(db, "prepare_proposal", { actor: "maya", toLevel: 4 }), 400, /one level at a time/);
    const after = approvePromotion(db, "prepare_proposal", { actor: "maya", now: NOW });
    assert.equal(after.level, 3);
    assert.equal(after.effectiveLevelName, "Execute Safe");
    // L4 needs 30 verified outcomes; 16 is not enough.
    assert.equal(after.candidateLevel, null);
    expectAutonomyError(() => approvePromotion(db, "prepare_proposal", { actor: "maya" }), 409, /Not a promotion candidate: needs 30 verified/);

    // Payment terms are a financial commitment: capped at Recommend even for a human approver.
    expectAutonomyError(() => approvePromotion(db, "offer_alternative", { actor: "maya" }), 409, /Financial control/);
  });

  it("no silent promotion: evidence alone never changes the level", () => {
    const db = getDb();
    addOutcomes("prepare_proposal", Array(40).fill(true));
    for (let i = 0; i < 5; i += 1) reviewProfile(db, "prepare_proposal", NOW);
    autonomyGate(db, "prepare_proposal");
    listProfiles(db);

    const prep = getProfile(db, "prepare_proposal")!;
    assert.equal(prep.evidence.verified, 56);
    assert.equal(prep.level, 2, "level unchanged");
    assert.equal(prep.candidateLevel, 3, "only a candidate, one level up");
    const kinds = listChanges(db, { actionType: "prepare_proposal" }).map((c) => c.kind);
    assert.ok(kinds.includes("promotion_candidate"));
    assert.ok(!kinds.includes("promotion"));
    // Draft is capped at L3 by policy, so more evidence never even makes it an L4 candidate.
    addOutcomes("draft_message", Array(40).fill(true));
    assert.equal(getProfile(db, "draft_message")!.candidateLevel, null);

    // Engines cannot approve their own promotion.
    for (const actor of ["autopilot", "autonomy-engine", "ai", "system", ""]) {
      expectAutonomyError(() => approvePromotion(db, "prepare_proposal", { actor }), 403, /named human/);
    }
    assert.equal(getProfile(db, "prepare_proposal")!.level, 2);
  });

  it("policy ceiling: a promotion above the ceiling is refused, and the ceiling follows live policy", () => {
    const db = getDb();
    addOutcomes("send_message", Array(40).fill(true));
    const send = getProfile(db, "send_message")!;
    assert.equal(send.ceiling.level, 2);
    assert.equal(send.candidateLevel, null, "never a candidate above the ceiling");
    expectAutonomyError(() => approvePromotion(db, "send_message", { actor: "maya" }), 409, /Policy ceiling/);
    assert.equal(getProfile(db, "send_message")!.level, 2);

    addOutcomes("apply_discount", Array(40).fill(true));
    expectAutonomyError(() => approvePromotion(db, "apply_discount", { actor: "maya" }), 409, /Financial control/);
    expectAutonomyError(() => approvePromotion(db, "delete_customer_data", { actor: "maya" }), 409, /Autonomy prohibited/);

    const refused = listChanges(db).filter((c) => c.kind === "promotion_refused");
    assert.ok(refused.length >= 3, "refusals are audited");

    // Ceiling is derived from lib/engine/policy.ts on every read.
    run(db, "UPDATE policies SET value = 'false' WHERE key = 'external_message_requires_approval'");
    const relaxed = getProfile(db, "send_message")!;
    assert.equal(relaxed.ceiling.level, 4);
    assert.equal(relaxed.candidateLevel, 3);
    run(db, "UPDATE policies SET value = 'true' WHERE key = 'external_message_requires_approval'");
    const capped = getProfile(db, "send_message")!;
    assert.equal(capped.ceiling.level, 2);
    assert.equal(capped.candidateLevel, null);
  });

  it("demotion: automatic on a failure streak, once per new evidence", () => {
    const db = getDb();
    addOutcomes("create_checkpoint", [false, false, false]);
    const demoted = getProfile(db, "create_checkpoint", NOW)!;
    assert.equal(demoted.level, 3);
    const change = listChanges(db, { actionType: "create_checkpoint" }).find((c) => c.kind === "demotion")!;
    assert.equal(change.actor, "autonomy-engine");
    assert.match(change.reason, /3 consecutive failed outcomes/);
    assert.equal(JSON.parse(change.evidence).verified, 34);

    // Re-reading the same evidence does not demote again.
    reviewProfile(db, "create_checkpoint");
    listProfiles(db);
    assert.equal(getProfile(db, "create_checkpoint")!.level, 3);
    // Not a candidate while failing.
    assert.equal(getProfile(db, "create_checkpoint")!.candidateLevel, null);

    // One more failure is new evidence → another level down.
    addOutcomes("create_checkpoint", [false]);
    assert.equal(getProfile(db, "create_checkpoint")!.level, 2);
  });

  it("demotion: success rate below the level floor with a minimum sample", () => {
    const e = (recentVerified: number, recentSuccessRate: number) => ({
      verified: recentVerified,
      successes: 0,
      failures: 0,
      successRate: recentSuccessRate,
      recentVerified,
      recentSuccessRate,
      failureStreak: 0,
      feedbackTotal: 0,
      overrides: 0,
      overrideRate: 0,
      synthetic: 0,
      outcomeIds: [],
      severeOutcomeIds: [],
    });
    assert.match(demotionTrigger(4, e(20, 0.8)) || "", /below the 85% floor/);
    assert.equal(demotionTrigger(4, e(20, 0.9)), null);
    assert.equal(demotionTrigger(4, e(4, 0.25)), null, "no demotion under the minimum sample");

    const db = getDb();
    // Alternating results never form a 3-streak but drag the recent rate down.
    // 12 alternating + 8 seeded successes = 14/20 = 70% < 75% floor for L3.
    addOutcomes("draft_message", [true, false, true, false, true, false, true, false, true, false, true, false]);
    assert.equal(getProfile(db, "draft_message")!.level, 2);
  });

  it("demotion via the live event hook when the Outcome Ledger records a result", () => {
    const db = getDb();
    ensureAutonomyHooks(db);
    run(
      db,
      `INSERT INTO actions (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status, evidence_json, created_at)
       VALUES ('act_test_ck', 'exc_test', NULL, 'create_checkpoint', 't', 'd', '{}', 'AUTO', '', 'executed', '{}', ?)`,
      [NOW],
    );
    try {
      const ledger = OutcomeLedger.for(db);
      for (let i = 0; i < 3; i += 1) {
        const out = ledger.record({
          id: `syn_aut_live_${i}`,
          problem_type: "x",
          context_signature: "x",
          action_id: "act_test_ck",
          strategy: "create_checkpoint",
          result: "no_response",
          success: false,
          created_at: new Date(Date.parse(NOW) + 3_600_000 + i).toISOString(),
        });
        eventsFor(db).append({
          type: LEARNING_EVENT_TYPES.OUTCOME_RECORDED,
          source: "outcome-ledger",
          source_id: out.id,
          entity_type: "outcome",
          entity_id: out.id,
          occurred_at: out.created_at,
        });
      }
      const row = one<{ level: number }>(db, "SELECT level FROM autonomy_profiles WHERE action_type = 'create_checkpoint'");
      assert.equal(row?.level, 3, "demoted by the hook without any read");
    } finally {
      run(db, "DELETE FROM actions WHERE id = 'act_test_ck'");
    }
  });

  it("suspension: automatic on severe failure or policy violation attempt; a human reinstates", () => {
    const db = getDb();
    addOutcomes("create_checkpoint", [false], "severe_failure");
    const suspended = getProfile(db, "create_checkpoint")!;
    assert.equal(suspended.suspended, true);
    assert.equal(suspended.effectiveLevel, 0);
    assert.equal(suspended.level, 4, "stored level kept");
    assert.equal(autonomyGate(db, "create_checkpoint").mayAutoExecute, false);
    expectAutonomyError(() => approvePromotion(db, "create_checkpoint", { actor: "maya" }), 409, /suspended/i);

    expectAutonomyError(() => reinstateAction(db, "create_checkpoint", { actor: "autopilot" }), 403, /named human/);
    const back = reinstateAction(db, "create_checkpoint", { actor: "maya", reason: "Checked the incident." });
    assert.equal(back.suspended, false);
    assert.equal(back.effectiveLevel, 4);

    reportPolicyViolationAttempt(db, "prepare_proposal", { reason: "tried to run a blocked instance" });
    assert.equal(getProfile(db, "prepare_proposal")!.suspended, true);
    reportSevereFailure(db, "draft_message", { reason: "wrong customer", ref: "act_x" });
    const draft = getProfile(db, "draft_message")!;
    assert.equal(draft.suspended, true);
    assert.match(draft.suspendedReason, /wrong customer/);
    suspendAction(db, "send_message", { actor: "maya" });
    assert.equal(getProfile(db, "send_message")!.effectiveLevel, 0);
  });

  it("playbook step: one plan auto-runs step A while step B waits for approval", () => {
    const db = getDb();
    const actions = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ? ORDER BY created_at, rowid", [IDS.planRecovery]);
    assert.equal(actions.length, 3);
    const plan = annotatePlanActions(db, actions);
    const step = (type: string) => plan.steps.find((s) => s.type === type)!;

    assert.equal(step("create_checkpoint").autonomy.mayAutoExecute, true);
    assert.equal(step("create_checkpoint").autonomy.level, 4);
    assert.equal(step("draft_message").autonomy.mayAutoExecute, false);
    assert.equal(step("draft_message").autonomy.requiresApproval, true);
    assert.match(step("draft_message").autonomy.reason, /policy requires approval/);
    assert.equal(step("prepare_proposal").autonomy.level, 2);
    assert.equal(step("prepare_proposal").autonomy.requiresApproval, true);
    assert.deepEqual(plan.autoRun, [IDS.actCheck]);
    assert.deepEqual(new Set(plan.awaitingApproval), new Set([IDS.actPrepare, IDS.actDraft]));

    // Promoting prepare_proposal to L3 is a valid human decision, but the step is customer-facing:
    // the gate never auto-runs it, at any level. Only the internal checkpoint runs on its own.
    approvePromotion(db, "prepare_proposal", { actor: "maya" });
    const again = annotatePlanActions(db, actions);
    assert.deepEqual(again.autoRun, [IDS.actCheck]);
    assert.equal(again.steps.find((s) => s.type === "prepare_proposal")!.autonomy.level, 3);
    assert.match(again.steps.find((s) => s.type === "prepare_proposal")!.autonomy.reason, /customer-facing/);
    assert.deepEqual(new Set(again.awaitingApproval), new Set([IDS.actPrepare, IDS.actDraft]));
    // Even at L4 with policy AUTO, a customer-facing type never auto-runs.
    run(db, "UPDATE autonomy_profiles SET level = 4 WHERE action_type = 'prepare_proposal'");
    const l4 = autonomyGate(db, "prepare_proposal");
    assert.equal(l4.policyOutcome, "AUTO");
    assert.equal(l4.mayAutoExecute, false);
    assert.equal(l4.actionGate, "NEEDS_APPROVAL");

    // Discount plan steps: blocked 10% never runs; 5% is financial → a human performs it.
    const discount = annotatePlanActions(db, [
      { id: "step_10", type: "apply_discount", policy_outcome: "BLOCKED" as const, policy_reason: "discount_max=5%" },
      { id: "step_5", type: "apply_discount", policy_outcome: "APPROVAL_REQUIRED" as const },
      { id: "step_ck", type: "create_checkpoint", policy_outcome: "AUTO" as const },
    ]);
    assert.deepEqual(discount.blocked, ["step_10"]);
    assert.deepEqual(discount.awaitingApproval, ["step_5"]);
    assert.deepEqual(discount.autoRun, ["step_ck"]);
  });

  it("emergency pause drops everything to Observe; only a human resumes", () => {
    const db = getDb();
    assert.equal(autonomyGate(db, "create_checkpoint").mayAutoExecute, true);
    emergencyPause(db, { actor: "autopilot", reason: "anomaly spike" });
    for (const p of listProfiles(db)) {
      assert.equal(p.effectiveLevel, 0, p.actionType);
      assert.equal(p.limitReason, "Emergency pause");
    }
    const gate = autonomyGate(db, "create_checkpoint");
    assert.equal(gate.mayAutoExecute, false);
    assert.equal(gate.mode, "observe");
    expectAutonomyError(() => approvePromotion(db, "prepare_proposal", { actor: "maya" }), 409, /Emergency pause/);
    expectAutonomyError(() => emergencyResume(db, { actor: "autopilot" }), 403, /named human/);
    assert.equal(getProfile(db, "create_checkpoint")!.effectiveLevel, 0);

    emergencyResume(db, { actor: "maya" });
    assert.equal(getProfile(db, "create_checkpoint")!.effectiveLevel, 4);
    assert.equal(autonomyGate(db, "create_checkpoint").mayAutoExecute, true);
  });

  it("autopilot integration: autonomyGate answers mayAutoExecute / requiresApproval / blocked", () => {
    const db = getDb();
    const ck = autonomyGate(db, "create_checkpoint");
    assert.deepEqual(
      { level: ck.level, mode: ck.mode, may: ck.mayAutoExecute, approval: ck.requiresApproval, blocked: ck.blocked },
      { level: 4, mode: "auto", may: true, approval: false, blocked: false },
    );
    const draft = autonomyGate(db, "draft_message", { payload: { audience: "customer" } });
    assert.equal(draft.level, 3);
    assert.equal(draft.mayAutoExecute, false);
    assert.equal(draft.requiresApproval, true);

    const send = autonomyGate(db, "send_message");
    assert.equal(send.mode, "prepare");
    assert.equal(send.requiresApproval, true);

    const discount5 = autonomyGate(db, "apply_discount", { payload: { percent: 5 } });
    assert.equal(discount5.mode, "recommend");
    const discount10 = autonomyGate(db, "apply_discount", { payload: { percent: 10 } });
    assert.equal(discount10.blocked, true);
    assert.equal(discount10.mayAutoExecute, false);
    assert.match(discount10.reason, /discount_max=5/);

    const del = autonomyGate(db, "delete_customer_data");
    assert.equal(del.blocked, true);

    const unknown = autonomyGate(db, "rotate_api_keys");
    assert.equal(unknown.mode, "observe");
    assert.equal(unknown.mayAutoExecute, false);
    assert.match(unknown.reason, /No autonomy profile/);

    const task = autonomyGate(db, "create_task");
    assert.equal(task.mayAutoExecute, true);
    assert.equal(task.actionGate, "AUTO");
    assert.equal(send.actionGate, "NEEDS_APPROVAL");
    assert.equal(discount10.actionGate, "BLOCKED");

    // Fresh evidence is reviewed before the gate answers.
    addOutcomes("create_checkpoint", [false, false, false]);
    const after = autonomyGate(db, "create_checkpoint");
    assert.equal(after.level, 3);
    assert.equal(after.mayAutoExecute, true, "L3 still runs reversible internal steps inside policy");
    addOutcomes("create_checkpoint", [false]);
    assert.equal(autonomyGate(db, "create_checkpoint").mayAutoExecute, false, "L2 → prepare only");
  });

  it("autopilot adapter: plugs into the autopilot's adapter seam and rechecks live policy", () => {
    const db = getDb();
    const row = (type: string, policy_outcome: "AUTO" | "APPROVAL_REQUIRED" | "BLOCKED", payload: Record<string, unknown> = {}) => ({
      type,
      payload: JSON.stringify(payload),
      policy_outcome,
    });
    assert.equal(adaptiveAutonomyGate.name, "adaptive-autonomy");
    assert.equal(adaptiveAutonomyGate.gate(db, row("create_task", "AUTO", { internal: true }), NOW).mayAutoExecute, true);
    // The autopilot's supplier-delay plan: internal task runs, customer heads-up waits.
    const heads = adaptiveAutonomyGate.gate(db, row("draft_message", "APPROVAL_REQUIRED", { audience: "customer" }), NOW);
    assert.equal(heads.actionGate, "NEEDS_APPROVAL");
    // A stored AUTO never loosens a live BLOCK: 10% is re-evaluated against discount_max.
    const stale = adaptiveAutonomyGate.gate(db, row("apply_discount", "AUTO", { percent: 10 }), NOW);
    assert.equal(stale.blocked, true);
    // A stored APPROVAL_REQUIRED stays stricter than the live AUTO.
    assert.equal(gateAction(db, row("create_checkpoint", "APPROVAL_REQUIRED"), NOW).mayAutoExecute, false);

    // Policy-only (today's autopilot default) would auto-run during a pause; earned autonomy does not.
    emergencyPause(db, { actor: "maya" });
    assert.equal(policyOnlyGate.gate(db, row("create_task", "AUTO"), NOW).mayAutoExecute, true);
    assert.equal(adaptiveAutonomyGate.gate(db, row("create_task", "AUTO"), NOW).mayAutoExecute, false);
    emergencyResume(db, { actor: "maya" });
  });

  it("audit: every change is recorded with actor, reason, evidence counts and timestamp", () => {
    const db = getDb();
    run(db, "DELETE FROM audit_logs WHERE action LIKE 'autonomy.%'");
    approvePromotion(db, "prepare_proposal", { actor: "maya", now: NOW });
    addOutcomes("create_checkpoint", [false, false, false]);
    getProfile(db, "create_checkpoint");
    suspendAction(db, "send_message", { actor: "maya", reason: "vendor incident" });
    reinstateAction(db, "send_message", { actor: "maya" });
    emergencyPause(db, { actor: "maya" });
    emergencyResume(db, { actor: "maya" });
    try {
      approvePromotion(db, "send_message", { actor: "maya" });
    } catch {
      /* refused, still audited */
    }
    addOutcomes("apply_discount", Array(10).fill(true));
    getProfile(db, "apply_discount");

    const audits = all<{ actor: string; action: string; object_id: string; payload: string; created_at: string }>(
      db,
      "SELECT * FROM audit_logs WHERE action LIKE 'autonomy.%'",
    );
    const actions = new Set(audits.map((a) => a.action));
    for (const kind of [
      "promotion",
      "demotion",
      "suspension",
      "reinstatement",
      "emergency_pause",
      "emergency_resume",
      "promotion_refused",
    ]) {
      assert.ok(actions.has(`autonomy.${kind}`), `audit ${kind}`);
    }
    const promo = audits.find((a) => a.action === "autonomy.promotion")!;
    assert.equal(promo.actor, "maya");
    assert.equal(promo.object_id, "prepare_proposal");
    const payload = JSON.parse(promo.payload);
    assert.equal(payload.from_level, 2);
    assert.equal(payload.to_level, 3);
    assert.equal(payload.evidence.verified, 16);
    assert.equal(payload.evidence.successes, 15);
    assert.equal(payload.at, NOW);
    assert.ok(promo.created_at);

    const demotion = audits.find((a) => a.action === "autonomy.demotion")!;
    assert.equal(demotion.actor, "autonomy-engine");

    const changes = listChanges(db, { limit: 200 });
    assert.ok(changes.some((c) => c.kind === "promotion_candidate"));
    assert.ok(changes.every((c) => c.actor && c.reason && c.created_at));
    const events = eventsFor(db).list({ type: "autonomy.promotion" });
    assert.ok(events.length >= 1, "promotion also lands on the event stream");
    assert.ok(evidenceFor(db, "prepare_proposal").verified === 16);
  });

  it("offline: the full autonomy cycle needs no network and no API key", async () => {
    const saved = { ...process.env };
    const realFetch = globalThis.fetch;
    let calls = 0;
    for (const key of ["OPENAI_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) delete process.env[key];
    globalThis.fetch = (async () => {
      calls += 1;
      throw new Error("network disabled in test");
    }) as typeof fetch;
    try {
      const db = getDb();
      listProfiles(db);
      approvePromotion(db, "prepare_proposal", { actor: "maya" });
      emergencyPause(db, { actor: "maya" });
      emergencyResume(db, { actor: "maya" });
      addOutcomes("create_checkpoint", [false, false, false]);
      autonomyGate(db, "create_checkpoint");
      suspendAction(db, "send_message", { actor: "maya" });
      reinstateAction(db, "send_message", { actor: "maya" });
      annotatePlanActions(db, all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ?", [IDS.planRecovery]));
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = realFetch;
      Object.assign(process.env, saved);
    }
  });

  it("API: GET overview and POST promote / suspend / reinstate / pause / resume", async () => {
    const { GET } = await import("../app/api/autonomy/route");
    const promote = await import("../app/api/autonomy/[actionType]/promote/route");
    const suspend = await import("../app/api/autonomy/[actionType]/suspend/route");
    const reinstate = await import("../app/api/autonomy/[actionType]/reinstate/route");
    const pause = await import("../app/api/autonomy/pause/route");
    const resume = await import("../app/api/autonomy/resume/route");
    const req = (body: unknown) =>
      new Request("http://local/api", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
    const params = (actionType: string) => ({ params: Promise.resolve({ actionType }) });

    const overview = await (await GET()).json();
    assert.equal(overview.profiles.length, 8);
    assert.equal(overview.pause.paused, false);

    assert.equal((await promote.POST(req({}), params("prepare_proposal"))).status, 403);
    assert.equal((await promote.POST(req({ actor: "maya" }), params("send_message"))).status, 409);
    const ok = await promote.POST(req({ actor: "maya", toLevel: 3 }), params("prepare_proposal"));
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).profile.level, 3);
    assert.equal((await promote.POST(req({ actor: "maya" }), params("nope"))).status, 404);

    assert.equal((await suspend.POST(req({ actor: "maya" }), params("create_checkpoint"))).status, 200);
    assert.equal((await reinstate.POST(req({ actor: "autopilot" }), params("create_checkpoint"))).status, 403);
    assert.equal((await reinstate.POST(req({ actor: "maya" }), params("create_checkpoint"))).status, 200);

    assert.equal((await pause.POST(req({ actor: "maya" }))).status, 200);
    assert.equal((await resume.POST(req({}))).status, 403);
    const resumed = await resume.POST(req({ actor: "maya" }));
    assert.equal((await resumed.json()).pause.paused, false);
  });
});
