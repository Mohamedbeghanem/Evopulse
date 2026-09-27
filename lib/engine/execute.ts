import type { DatabaseSync } from "node:sqlite";
import { CHECKPOINT_ISO } from "../clock";
import { all, audit, one, run, setMeta } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { id, IDS } from "../ids";
import type { ActionRow, PlanRow } from "../types";
import { markExceptionAwaitingVerification, VerificationService } from "../learning";

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
  eventsFor(db).append({
    type: EVENT_TYPES.ACTION_EXECUTED,
    source: "action-engine",
    source_id: actionId,
    actor_id: actor,
    entity_type: "action",
    entity_id: actionId,
    payload: { type: action.type, title: action.title, planId: action.plan_id },
    occurred_at: now,
    received_at: now,
    confidence: 1,
    idempotent: true,
  });
  audit(db, actor, "execute_action", "action", actionId, { type: action.type });

  const siblings = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ?", [action.plan_id]);
  const remaining = siblings.filter(
    (a) => a.policy_outcome !== "BLOCKED" && a.status !== "executed" && a.id !== actionId,
  );
  const planRow = action.plan_id ? one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [action.plan_id]) : undefined;
  if (!planRow?.goal_id && remaining.length === 0 && action.plan_id) {
    run(db, "UPDATE plans SET status = ? WHERE id = ?", ["executed", action.plan_id]);
    markExceptionAwaitingVerification(db, action.exception_id);
    if (action.exception_id === IDS.excMissed) setMeta(db, "demo_phase", "recovered");
  }

  const executed = one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId]);
  if (executed) VerificationService.for(db).afterActionExecuted(executed, now);
  return executed;
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
  return {
    plan: one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [planId]),
    actions: all<ActionRow>(
      db,
      "SELECT * FROM actions WHERE plan_id = ? AND policy_outcome != 'BLOCKED'",
      [planId],
    ),
  };
}

function applySideEffects(db: DatabaseSync, action: ActionRow, now: string) {
  if (action.type === "prepare_proposal") {
    const plan = one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [action.plan_id]);
    // The proposal effects below are the 320K Atlas scenario. They only fire for that exception
    // (goal plans keep their document-only behaviour); any other prepare_proposal has no global effect.
    const atlas = action.exception_id === IDS.excMissed;
    if (!atlas && !plan?.goal_id) return;
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
    if (plan?.goal_id) return;

    eventsFor(db).append({
      type: EVENT_TYPES.QUOTE_SENT,
      source: "action-engine",
      source_id: action.id,
      actor_id: IDS.company,
      entity_type: "opportunity",
      entity_id: IDS.opportunity,
      payload: { documentId: IDS.document, actionType: action.type },
      occurred_at: now,
      received_at: now,
      confidence: 1,
      idempotent: true,
    });
    run(db, "UPDATE commitments SET status = ? WHERE id = ?", ["fulfilled", IDS.commitOurs]);
    eventsFor(db).append({
      type: EVENT_TYPES.COMMITMENT_FULFILLED,
      source: "action-engine",
      source_id: IDS.commitOurs,
      actor_id: IDS.company,
      entity_type: "commitment",
      entity_id: IDS.commitOurs,
      payload: { via: action.id, documentId: IDS.document },
      occurred_at: now,
      received_at: now,
      confidence: 1,
      idempotent: true,
    });
    run(db, "UPDATE expectations SET status = ?, actual = ?, due_at = ?, expected_at = ?, updated_at = ? WHERE id = ?", [
      "AT_RISK",
      "Unblocked — waiting on customer at the Monday checkpoint",
      CHECKPOINT_ISO,
      CHECKPOINT_ISO,
      now,
      IDS.expectTheirs,
    ]);
    run(db, "UPDATE commitments SET status = ?, deadline = ? WHERE id = ?", [
      "open",
      CHECKPOINT_ISO,
      IDS.commitTheirs,
    ]);
  }

  if (action.type === "create_checkpoint") {
    // Scoped to the action's own exception subject — never a hard-coded opportunity.
    const subject = checkpointSubject(db, action);
    const payload = JSON.parse(action.payload || "{}") as { dueAt?: string };
    eventsFor(db).append({
      type: EVENT_TYPES.TASK_COMPLETED,
      source: "action-engine",
      source_id: action.id,
      actor_id: IDS.company,
      entity_type: subject.type,
      entity_id: subject.id,
      payload: { dueAt: payload.dueAt ?? CHECKPOINT_ISO, actionType: action.type },
      occurred_at: now,
      received_at: now,
      confidence: 1,
      idempotent: true,
    });
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

  applyCatalogSideEffects(db, action, now);
}

function checkpointSubject(db: DatabaseSync, action: ActionRow): { type: string; id: string } {
  const exception = one<{ id: string; opportunity_id: string | null }>(
    db,
    "SELECT id, opportunity_id FROM exceptions WHERE id = ?",
    [action.exception_id],
  );
  if (exception?.opportunity_id) {
    const entity = one<{ type: string }>(db, "SELECT type FROM entities WHERE id = ?", [exception.opportunity_id]);
    return { type: entity?.type || "entity", id: exception.opportunity_id };
  }
  if (exception) return { type: "exception", id: exception.id };
  return { type: "action", id: action.id };
}

function applyCatalogSideEffects(db: DatabaseSync, action: ActionRow, now: string) {
  const payload = (() => {
    try {
      return JSON.parse(action.payload) as Record<string, unknown>;
    } catch {
      return {};
    }
  })();

  if (action.type === "prioritize_order") {
    const orderId = String(payload.orderId || action.target_id || IDS.orderA);
    const existing = one<{ payload: string }>(db, "SELECT payload FROM entities WHERE id = ?", [orderId]);
    const current = existing ? (JSON.parse(existing.payload) as Record<string, unknown>) : {};
    run(db, "UPDATE entities SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...current, priority: "critical" }),
      orderId,
    ]);
  }

  if (action.type === "update_expectation") {
    const expectationId = String(payload.expectationId || "");
    if (!expectationId) return;
    const current = one<{ due_at: string; expected_at: string }>(
      db,
      "SELECT due_at, expected_at FROM expectations WHERE id = ?",
      [expectationId],
    );
    if (!current) return;
    let explicit = "";
    if (typeof payload.dueAt === "string") explicit = payload.dueAt;
    else if (typeof payload.expectedAt === "string") explicit = payload.expectedAt;
    const shipment = one<{ payload: string }>(db, "SELECT payload FROM entities WHERE id = ?", [IDS.shipment]);
    const shipPayload = shipment ? (JSON.parse(shipment.payload) as { deltaDays?: number }) : {};
    const delta = typeof payload.deltaDays === "number" ? payload.deltaDays : Number(shipPayload.deltaDays || 0);
    const nextDue = explicit || (delta > 0 ? shiftIso(current.expected_at || current.due_at, delta) : "");
    if (nextDue) {
      run(db, "UPDATE expectations SET due_at = ?, expected_at = ?, actual = ?, updated_at = ? WHERE id = ?", [
        nextDue,
        nextDue,
        "Cash timing moved with the shipment delay",
        now,
        expectationId,
      ]);
    }
  }

  if (action.type === "create_task" || action.type === "monitor" || action.type === "schedule_followup") {
    const taskId = `ent_${action.id}`;
    run(
      db,
      `INSERT OR REPLACE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
      [taskId, "task", action.title, JSON.stringify({ actionId: action.id, ...payload }), now],
    );
  }

  if (action.type === "prepare_customer_notice" || action.type === "update_record") {
    const docId = `ent_notice_${action.id}`;
    run(
      db,
      `INSERT OR REPLACE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
      [docId, "document", action.title, JSON.stringify({ actionId: action.id, status: "prepared", ...payload }), now],
    );
  }
}

function shiftIso(iso: string, days: number): string {
  const shifted = new Date(Date.parse(iso) + days * 86_400_000);
  if (iso.endsWith("Z")) return shifted.toISOString();
  const offset = iso.slice(-6);
  const local = new Date(shifted.getTime() + 3_600_000);
  return local.toISOString().replace(".000Z", offset);
}
