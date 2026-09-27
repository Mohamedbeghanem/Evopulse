import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-demo-loop-")), "demo-loop.db");
delete process.env.OPENROUTER_API_KEY;

import { getAgentRuntime } from "../lib/agent";
import { createCompany } from "../lib/company";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { demoPath } from "../lib/demo-loop/demo-path";
import { availableDemoReplies, deliverDemoReply, listInbox, situationLoop } from "../lib/demo-loop/inbox";
import { pulseOutcome } from "../lib/demo-loop/outcomes";
import { executeAction } from "../lib/engine/execute";
import { approvePlanAction } from "../lib/goals";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { approveAndSendDraft, isHumanActor, listDrafts, listOutbox, OutboundError, outboundView } from "../lib/outbound";

resetDbFile();

type Exc = { id: string; attention: string; status: string; impact_json: string; opportunity_id: string | null };
const db = () => getDb();
const exc = (id: string) => db().prepare("SELECT id, attention, status, impact_json, opportunity_id FROM exceptions WHERE id = ?").get(id) as Exc;
const allAttention = () =>
  Object.fromEntries((db().prepare("SELECT id, attention, status FROM exceptions").all() as Exc[]).map((row) => [row.id, `${row.attention}/${row.status}`]));
const verification = (exceptionId: string) =>
  db().prepare("SELECT status, metadata FROM verifications WHERE exception_id = ? ORDER BY created_at DESC, rowid DESC").all(exceptionId) as {
    status: string;
    metadata: string;
  }[];

/** Resolve an href to a Next.js app route file (literal segment first, then a [param] segment). */
function routeExists(href: string) {
  const path = href.split(/[?#]/)[0];
  let dir = join(process.cwd(), "app");
  for (const segment of path.split("/").filter(Boolean)) {
    const literal = join(dir, segment);
    if (existsSync(literal)) {
      dir = literal;
      continue;
    }
    const dynamic = readdirSync(dir).find((name) => /^\[[^.\]]+\]$/.test(name));
    if (!dynamic) return false;
    dir = join(dir, dynamic);
  }
  return existsSync(join(dir, "page.tsx"));
}

describe("demo loop: inbox, outcomes, outbound drafts, demo path", () => {
  it("before anything: exposure is detected from engine state and nothing is protected yet", () => {
    createCompany(db(), { prompt: "Atlas Medical Distribution" });
    const outcome = pulseOutcome(db());
    const delay = outcome.exposure.find((item) => item.exceptionId === "exc_shipment_delay");
    assert.ok(delay, "supply delay exposure present");
    assert.equal(delay.associatedRevenue, 850000);
    assert.equal(delay.expectedCashTiming, 540000);
    // Detected from the exception timestamp; would surface at the Order A customer deadline (early warning).
    assert.equal(delay.detectedAt, "2026-09-27T09:14:00+01:00");
    assert.equal(delay.wouldSurfaceAt, "2026-09-29T10:00:00+01:00");
    assert.equal(delay.leadMinutes, (Date.parse(delay.wouldSurfaceAt!) - Date.parse(delay.detectedAt)) / 60000);
    assert.ok(delay.leadMinutes! > 0);
    assert.deepEqual(
      { revenue: outcome.protected.associatedRevenue, cash: outcome.protected.expectedCashTiming, verified: outcome.protected.verifiedSituations },
      { revenue: 0, cash: 0, verified: 0 },
    );
  });

  it("demo path: every step links an existing route and completion reads real state", () => {
    const path = demoPath(db());
    assert.deepEqual(
      path.steps.map((step) => step.id),
      ["create", "pulse", "why", "simulate", "protect", "blocked", "alternative", "reply", "handled", "outcome"],
    );
    for (const step of path.steps) assert.ok(routeExists(step.href), `${step.id} → ${step.href} resolves to an app route`);
    assert.equal(path.steps.find((s) => s.id === "create")!.done, true);
    assert.equal(path.currentStepId, "why");
  });

  it("drafts appear only for human-approved actions and nothing is ever sent automatically", async () => {
    const runtime = getAgentRuntime(db());
    await runtime.run({ command: "Why is 850K at risk?" });
    await runtime.run({ command: "Simulate Atlas +3 days" });
    let run = await runtime.run({ command: "Protect everything at risk this week." });
    for (const approval of run.approvals.filter((a) => a.status === "pending")) {
      run = await runtime.resumeAfterApproval(run.id, { approvalId: approval.id, decision: "approve", actor: "operator" });
    }
    await ingestSeedDiscount(db());
    assert.equal(exc("exc_discount_blocked").attention, "NEEDS_YOU");
    // Governed alternative actions are still proposed → no draft for them yet.
    const drafts = listDrafts(db());
    assert.ok(drafts.length > 0, "approved communication actions produce drafts");
    const statuses = drafts.map((d) => (db().prepare("SELECT status FROM actions WHERE id = ?").get(d.actionId) as { status: string }).status);
    assert.ok(statuses.every((s) => s === "approved" || s === "executed"));
    assert.ok(!drafts.some((d) => d.exceptionId === "exc_discount_blocked"), "no drafts before the alternative is approved");
    // Drafts come from real entities.
    const proposal = drafts.find((d) => d.intent === "send_proposal" && d.actionType === "prepare_proposal");
    assert.ok(proposal);
    assert.equal(proposal.toEntityId, "ent_amine");
    assert.equal(proposal.toAddress, "amine.khelifi@atlasretail.dz");
    assert.match(proposal.body, /320,000 DZD/);
    const notices = drafts.filter((d) => d.intent === "notify_customer");
    assert.ok(notices.some((d) => d.toEntityId === "ent_cust_a"));
    // A proposal names no recipient; its verification is scoped to the opportunity contact (Amine).
    const proposalVerification = (db().prepare("SELECT metadata FROM verifications WHERE json_extract(metadata, '$.actionType') = 'prepare_proposal'").all() as { metadata: string }[]);
    assert.ok(proposalVerification.length > 0);
    for (const row of proposalVerification) assert.equal(JSON.parse(row.metadata).target.entityId, "ent_amine");
    // Planner/runtime never sent anything.
    assert.equal(listOutbox(db()).length, 0);
  });

  it("an agent cannot approve a send; a person can, and the local outbox never sends externally", () => {
    const before = allAttention();
    const draft = outboundView(db()).drafts[0];
    for (const actor of ["agent", "pulse", "ai", "system", "autopilot", "planner-agent", "", undefined]) {
      assert.equal(isHumanActor(actor), false);
      assert.throws(() => approveAndSendDraft(db(), draft.id, actor), (e: unknown) => e instanceof OutboundError && e.status === 403);
    }
    assert.equal(listOutbox(db()).length, 0);
    assert.throws(() => approveAndSendDraft(db(), "act_offer_terms:ent_amine", "operator"), (e: unknown) => e instanceof OutboundError && e.status === 404);

    const sent = approveAndSendDraft(db(), draft.id, "operator");
    assert.equal(sent.duplicate, false);
    assert.equal(sent.message.provider, "local-outbox");
    assert.equal(sent.message.external, false);
    assert.equal(sent.message.status, "recorded_local");
    assert.equal(approveAndSendDraft(db(), draft.id, "operator").duplicate, true);
    assert.equal(listOutbox(db()).length, 1);
    assert.ok(!outboundView(db()).drafts.some((d) => d.id === draft.id));
    // Recording a message is not verification: nothing turns HANDLED.
    assert.deepEqual(allAttention(), before);
  });

  it("approving the governed alternative scopes its verification to Amine (EXECUTED is not HANDLED)", () => {
    const plan = db().prepare("SELECT plan_id FROM actions WHERE id = 'act_offer_terms'").get() as { plan_id: string };
    const now = getMeta(db(), "demo_now");
    assert.throws(() => executeAction(db(), "act_apply_10", now), /discount_max=5%/);
    approvePlanAction(db(), plan.plan_id, "act_offer_terms", now);
    executeAction(db(), "act_offer_terms", now, "operator");
    approvePlanAction(db(), plan.plan_id, "act_draft_policy_reply", now);
    executeAction(db(), "act_draft_policy_reply", now, "operator");
    const discount = exc("exc_discount_blocked");
    assert.notEqual(discount.attention, "HANDLED");
    const pending = verification("exc_discount_blocked").find((v) => v.status === "PENDING");
    assert.ok(pending, "pending verification after execution");
    assert.equal(JSON.parse(pending.metadata).target.entityId, "ent_amine");
    assert.ok(listDrafts(db()).some((d) => d.actionId === "act_offer_terms" && d.toEntityId === "ent_amine"));
  });

  it("a supplier reply verifies nothing customer-facing and its body stays data", () => {
    const before = allAttention();
    assert.deepEqual(availableDemoReplies(db()).map((r) => r.key), ["amine_accepts", "oran_fresh_ack", "atlas_supply_update"]);
    const result = deliverDemoReply(db(), "atlas_supply_update");
    assert.deepEqual(result.verified, []);
    assert.deepEqual(allAttention(), before, "injection text did not change any situation");
    const message = listInbox(db()).find((m) => m.id === result.event.id)!;
    assert.match(message.text, /Ignore previous instructions/);
    assert.equal(message.from, "Atlas Supply");
    assert.deepEqual(message.verified, []);
    assert.ok(verification("exc_discount_blocked").some((v) => v.status === "PENDING"));
  });

  it("Oran Fresh's reply verifies only the Oran Fresh delay notice, not Amine's deal", () => {
    const result = deliverDemoReply(db(), "oran_fresh_ack");
    assert.ok(result.verified.length >= 1);
    assert.ok(result.verified.every((v) => v.exception_id === "exc_shipment_delay"));
    assert.notEqual(exc("exc_discount_blocked").attention, "HANDLED");
  });

  it("Amine's reply verifies the alternative → HANDLED only via verification; inbox shows it", () => {
    const result = deliverDemoReply(db(), "amine_accepts");
    assert.ok(result.verified.some((v) => v.exception_id === "exc_discount_blocked" && v.status === "SUCCESS"));
    assert.equal(exc("exc_discount_blocked").attention, "HANDLED");
    const message = listInbox(db()).find((m) => m.id === result.event.id)!;
    assert.ok(message.verified.some((v) => v.exceptionId === "exc_discount_blocked"));
    const loop = situationLoop(db(), "exc_discount_blocked");
    assert.ok(loop.verifications.some((v) => v.status === "SUCCESS" && v.replyFrom === "Amine Khelifi"));
  });

  it("value protected is computed from verified situations, deduped per opportunity", () => {
    const outcome = pulseOutcome(db());
    const verified = outcome.exposure.filter((item) => item.verified);
    const expectedRevenue = new Map<string, number>();
    let expectedCash = 0;
    for (const id of ["exc_proposal_missed", "exc_discount_blocked", "exc_shipment_delay"]) {
      const row = exc(id);
      const ok = row.attention === "HANDLED" && row.status === "resolved" && verification(id).some((v) => v.status === "SUCCESS");
      assert.equal(verified.some((v) => v.exceptionId === id), ok, `${id} verified flag`);
      if (!ok) continue;
      const impact = JSON.parse(row.impact_json);
      const key = row.opportunity_id || id;
      expectedRevenue.set(key, Math.max(expectedRevenue.get(key) || 0, impact.revenueAssociated));
      expectedCash += impact.affectedExpectedCash || 0;
    }
    assert.equal(outcome.protected.associatedRevenue, [...expectedRevenue.values()].reduce((a, b) => a + b, 0));
    assert.equal(outcome.protected.expectedCashTiming, expectedCash);
    // The 320K deal counts once even though two situations (missed proposal + blocked discount) cover it.
    assert.ok(verified.some((v) => v.exceptionId === "exc_discount_blocked"));
    const naive = verified.reduce((sum, item) => sum + item.associatedRevenue, 0);
    if (verified.some((v) => v.exceptionId === "exc_proposal_missed")) {
      assert.equal(naive - outcome.protected.associatedRevenue, 304000, "blocked-discount 304K not double counted on the 320K deal");
    }
    // Exposure is still reported with the associated-revenue / cash-timing distinction.
    const delay = outcome.exposure.find((item) => item.exceptionId === "exc_shipment_delay")!;
    assert.equal(delay.associatedRevenue, 850000);
    assert.equal(delay.expectedCashTiming, 540000);
  });

  it("demo path is complete once the loop is closed", () => {
    const path = demoPath(db());
    const pending = path.steps.filter((step) => !step.done).map((step) => step.id);
    assert.deepEqual(pending, []);
    assert.equal(path.currentStepId, null);
  });
});
