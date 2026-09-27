import type { DatabaseSync } from "node:sqlite";
import { CHECKPOINT_ISO } from "../clock";
import { all, audit, one, run, setMeta } from "../db";
import { id, IDS } from "../ids";
import type { ActionRow, PlanRow } from "../types";

export function approvePlan(db: DatabaseSync, planId: string, now: string, actor = "operator") {
  const plan = one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [planId]);
  if (!plan) throw new Error("Plan not found");
  if (plan.status === "blocked") {
    throw new Error("Blocked plans cannot be approved wholesale. Approve an allowed alternative action.");
  }

  run(db, "UPDATE plans SET status = ? WHERE id = ?", ["approved", planId]);
  run(
    db,
    "INSERT INTO approvals (id, plan_id, action_id, status, decided_at, decided_by) VALUES (?, ?, ?, ?, ?, ?)",
    [id("apr"), planId, null, "approved", now, actor],
  );
  run(
    db,
    "UPDATE actions SET status = ? WHERE plan_id = ? AND policy_outcome != 'BLOCKED' AND status = 'proposed'",
    ["approved", planId],
  );
  run(db, "UPDATE exceptions SET status = ? WHERE id = ?", ["approved", plan.exception_id]);
  audit(db, actor, "approve_plan", "plan", planId, { planId });
  return one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [planId]);
}

export function executeAction(db: DatabaseSync, actionId: string, now: string, actor = "operator") {
  const action = one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId]);
  if (!action) throw new Error("Action not found");
  if (action.policy_outcome === "BLOCKED") {
    throw new Error(action.policy_reason || "Action is blocked by policy.");
  }
  if (action.policy_outcome === "APPROVAL_REQUIRED" && action.status !== "approved") {
    throw new Error("This action still needs approval.");
  }

  applySideEffects(db, action, now);
  run(db, "UPDATE actions SET status = ? WHERE id = ?", ["executed", actionId]);
  audit(db, actor, "execute_action", "action", actionId, { type: action.type });

  const siblings = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ?", [action.plan_id]);
  const remaining = siblings.filter(
    (a) => a.policy_outcome !== "BLOCKED" && a.status !== "executed" && a.id !== actionId,
  );
  if (remaining.length === 0 && action.plan_id) {
    run(db, "UPDATE plans SET status = ? WHERE id = ?", ["executed", action.plan_id]);
    run(db, "UPDATE exceptions SET status = ?, attention = ? WHERE id = ?", [
      "resolved",
      "HANDLED",
      action.exception_id,
    ]);
    if (action.exception_id === IDS.excMissed) setMeta(db, "demo_phase", "recovered");
  }

  return one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId]);
}

export function executePlan(db: DatabaseSync, planId: string, now: string, actor = "operator") {
  approvePlan(db, planId, now, actor);
  const actions = all<ActionRow>(
    db,
    "SELECT * FROM actions WHERE plan_id = ? AND policy_outcome != 'BLOCKED'",
    [planId],
  );
  for (const action of actions) {
    if (action.status !== "executed") executeAction(db, action.id, now, actor);
  }
  return { plan: one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [planId]), actions };
}

function applySideEffects(db: DatabaseSync, action: ActionRow, now: string) {
  if (action.type === "prepare_proposal") {
    run(
      db,
      `INSERT INTO entities (id, type, name, payload, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
      [
        IDS.document,
        "document",
        "Revised Atlas proposal v2 — 320,000 DZD",
        JSON.stringify({ amount: 320000, currency: "DZD", status: "prepared" }),
        now,
      ],
    );
    run(
      db,
      `INSERT INTO events (id, type, entity_id, occurred_at, payload, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id("evt"),
        "proposal_prepared",
        IDS.opportunity,
        now,
        JSON.stringify({ documentId: IDS.document }),
        "action-engine",
        now,
      ],
    );
    run(db, "UPDATE commitments SET status = ? WHERE id = ?", ["fulfilled", IDS.commitOurs]);
    run(db, "UPDATE expectations SET status = ?, actual = ?, updated_at = ? WHERE id = ?", [
      "FULFILLED",
      "Revised proposal prepared and ready to send",
      now,
      IDS.expectOurs,
    ]);
    run(db, "UPDATE expectations SET status = ?, actual = ?, updated_at = ? WHERE id = ?", [
      "AT_RISK",
      "Unblocked — waiting on customer once follow-up lands",
      now,
      IDS.expectTheirs,
    ]);
  }

  if (action.type === "draft_message" || action.type === "send_message") {
    run(
      db,
      `INSERT INTO events (id, type, entity_id, occurred_at, payload, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id("evt"),
        "message_drafted",
        IDS.contact,
        now,
        action.payload,
        "action-engine",
        now,
      ],
    );
  }

  if (action.type === "create_checkpoint") {
    run(
      db,
      `INSERT INTO events (id, type, entity_id, occurred_at, payload, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id("evt"),
        "checkpoint_created",
        IDS.opportunity,
        now,
        JSON.stringify({ dueAt: CHECKPOINT_ISO }),
        "action-engine",
        now,
      ],
    );
  }

  if (action.type === "apply_discount" && action.policy_outcome !== "BLOCKED") {
    const payload = JSON.parse(action.payload) as { percent?: number; amount?: number };
    run(db, "UPDATE entities SET payload = ? WHERE id = ?", [
      JSON.stringify({
        amount: payload.amount ?? 304000,
        currency: "DZD",
        stage: "discount_offered",
        discountPct: payload.percent,
      }),
      IDS.opportunity,
    ]);
  }
}
