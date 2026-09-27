import type { DatabaseSync } from "node:sqlite";
import { audit, getMeta, one, run, runWithDb } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { evaluatePolicy, loadPolicies, parseActionPayload, recheckActionPolicy } from "../engine/policy";
import { id } from "../ids";
import type { ActionRow } from "../types";
import { logToolCall } from "./activity";
import { boundedText } from "./data";
import { callMcpWriteToolApproved } from "./mcp";
import { getOutboundAdapter } from "./outbound";
import { ConnectorError, ConnectorRegistry } from "./registry";
import { redactSecrets } from "./secrets";

/**
 * Connector writes use the canonical governance path:
 *   actions row → Policy (evaluatePolicy) → human approval (approvals row) → Policy RECHECK right
 *   before execution → execute → action.executed event.
 * Executed is not handled: nothing here writes HANDLED; Verification still owns that.
 */
export const CONNECTOR_ACTION_TYPES = ["connector_write", "connector_outbound"] as const;
export type ConnectorActionType = (typeof CONNECTOR_ACTION_TYPES)[number];
export const CONNECTOR_EXCEPTION_SCOPE = "connector";

const AI_ACTOR = /^(agent|ai|autopilot|model|assistant|system|deepseek|openrouter|llm|harness|runtime)([\s:_-]|$)/i;

export function isAiActor(actor: string): boolean {
  return !actor.trim() || AI_ACTOR.test(actor.trim());
}

export function isConnectorAction(action: Pick<ActionRow, "type">): boolean {
  return (CONNECTOR_ACTION_TYPES as readonly string[]).includes(action.type);
}

export type ConnectorActionPayload = {
  installId: string;
  connectorId: string;
  operation: "tool_call" | "outbound_message";
  tool?: string;
  args?: Record<string, unknown>;
  adapter?: string;
  to?: string;
  body?: string;
  requestedBy: string;
  runId?: string;
};

export function proposeConnectorAction(
  db: DatabaseSync,
  input: { type: ConnectorActionType; title: string; description: string; payload: ConnectorActionPayload },
  now: string,
): ActionRow {
  const decision = evaluatePolicy({ type: input.type, payload: input.payload as unknown as Record<string, unknown> }, loadPolicies(db));
  const actionId = id("act");
  run(
    db,
    `INSERT INTO actions (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status, evidence_json, created_at)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, '{}', ?)`,
    [
      actionId,
      CONNECTOR_EXCEPTION_SCOPE,
      input.type,
      boundedText(input.title, 200),
      boundedText(input.description, 500),
      JSON.stringify(input.payload),
      decision.outcome,
      decision.reason,
      decision.outcome === "BLOCKED" ? "blocked" : "proposed",
      now,
    ],
  );
  audit(db, input.payload.requestedBy, "connector.propose", "action", actionId, {
    type: input.type,
    outcome: decision.outcome,
    installId: input.payload.installId,
    tool: input.payload.tool,
  });
  return one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId])!;
}

function logAction(db: DatabaseSync, action: ActionRow, outcome: Parameters<typeof logToolCall>[1]["outcome"], status: string, actor: string, summary: string) {
  const payload = parseActionPayload(action.payload) as unknown as Partial<ConnectorActionPayload>;
  if (!payload.installId) return;
  logToolCall(db, {
    installId: payload.installId,
    tool: payload.tool || payload.operation || action.type,
    permission: "WRITE",
    outcome,
    status,
    actionId: action.id,
    actor,
    summary,
  });
}

function load(db: DatabaseSync, actionId: string): ActionRow {
  const action = one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId]);
  if (!action) throw new ConnectorError("Action not found.", 404);
  if (!isConnectorAction(action)) throw new ConnectorError("Not a connector action.", 400);
  return action;
}

/** Human approval only. The agent / autopilot can never approve its own connector write. */
export function approveConnectorAction(db: DatabaseSync, actionId: string, actor: string, now: string): ActionRow {
  const found = load(db, actionId);
  if (isAiActor(actor)) {
    logAction(db, found, "DENIED", "denied", actor, "AI attempted to approve; refused.");
    throw new ConnectorError("AI cannot approve actions. A human must approve.", 403);
  }
  if (found.status === "executed") throw new ConnectorError("Action already executed.", 409);
  if (found.status === "rejected") throw new ConnectorError("Action was rejected.", 409);
  const action = recheckActionPolicy(db, found);
  if (action.policy_outcome === "BLOCKED") {
    run(db, "UPDATE actions SET status = 'blocked' WHERE id = ?", [actionId]);
    throw new ConnectorError(action.policy_reason || "Blocked by policy.", 409);
  }
  run(db, "UPDATE actions SET status = 'approved' WHERE id = ?", [actionId]);
  run(db, "INSERT INTO approvals (id, plan_id, action_id, status, decided_at, decided_by) VALUES (?, NULL, ?, 'approved', ?, ?)", [
    id("apr"),
    actionId,
    now,
    actor,
  ]);
  audit(db, actor, "connector.approve", "action", actionId, {});
  logAction(db, found, "APPROVED", "approved", actor, "Approved by a human.");
  return one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId])!;
}

export function rejectConnectorAction(db: DatabaseSync, actionId: string, actor: string, now: string): ActionRow {
  const found = load(db, actionId);
  if (found.status === "executed") throw new ConnectorError("Action already executed.", 409);
  run(db, "UPDATE actions SET status = 'rejected' WHERE id = ?", [actionId]);
  run(db, "INSERT INTO approvals (id, plan_id, action_id, status, decided_at, decided_by) VALUES (?, NULL, ?, 'rejected', ?, ?)", [
    id("apr"),
    actionId,
    now,
    actor || "operator",
  ]);
  audit(db, actor || "operator", "connector.reject", "action", actionId, {});
  logAction(db, found, "REJECTED", "rejected", actor || "operator", "Rejected by a human.");
  return one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId])!;
}

function humanApproval(db: DatabaseSync, actionId: string) {
  const row = one<{ decided_by: string }>(
    db,
    "SELECT decided_by FROM approvals WHERE action_id = ? AND status = 'approved' ORDER BY decided_at DESC LIMIT 1",
    [actionId],
  );
  return row && !isAiActor(row.decided_by || "") ? row : undefined;
}

export async function executeConnectorAction(
  db: DatabaseSync,
  workspaceId: string,
  actionId: string,
  now: string,
  actor = "operator",
): Promise<ActionRow> {
  const found = load(db, actionId);
  if (found.status === "executed") throw new ConnectorError("Action already executed.", 409);
  if (found.status === "rejected") throw new ConnectorError("Action was rejected.", 409);
  // Policy is rechecked immediately before execution — a policy change after approval still wins.
  const action = recheckActionPolicy(db, found);
  if (action.policy_outcome === "BLOCKED") {
    logAction(db, action, "BLOCKED", "blocked", actor, action.policy_reason || "Blocked by policy at execution recheck.");
    run(db, "UPDATE actions SET status = 'blocked' WHERE id = ?", [actionId]);
    throw new ConnectorError(action.policy_reason || "Blocked by policy.", 409);
  }
  if (action.policy_outcome === "APPROVAL_REQUIRED" && (action.status !== "approved" || !humanApproval(db, actionId))) {
    throw new ConnectorError("This action still needs human approval.", 409);
  }
  const payload = parseActionPayload(action.payload) as unknown as ConnectorActionPayload;
  const registry = ConnectorRegistry.for(db, workspaceId);
  if (!registry.isEnabled(payload.installId)) throw new ConnectorError("Connector is disabled.", 409);
  if (action.type === "connector_write" && registry.view(payload.installId).disabledTools.includes(String(payload.tool))) {
    throw new ConnectorError("An admin disabled this tool.", 409);
  }
  let summary = "";
  let ok = true;
  let providerRef: string | undefined;
  try {
    if (action.type === "connector_write") {
      const result = await callMcpWriteToolApproved(db, workspaceId, payload.installId, String(payload.tool), payload.args || {});
      ok = !result.isError;
      summary = result.output;
    } else {
      const adapter = getOutboundAdapter(payload.adapter || payload.connectorId);
      if (!adapter) throw new ConnectorError("No outbound adapter registered for this channel.", 409);
      const sent = await adapter.send(
        { db, workspaceId },
        { actionId, channel: adapter.channel, to: String(payload.to || ""), body: String(payload.body || "") },
      );
      ok = sent.ok;
      summary = sent.detail;
      providerRef = sent.providerRef;
    }
  } catch (error) {
    ok = false;
    summary = error instanceof Error ? error.message : "Connector call failed.";
  }
  const safe = redactSecrets(boundedText(summary, 1000), registry.knownSecretValues(payload.installId));
  run(db, "UPDATE actions SET status = ?, evidence_json = ? WHERE id = ?", [
    ok ? "executed" : "failed",
    JSON.stringify({ result: safe, providerRef: providerRef || null, executedAt: now, handled: false }),
    actionId,
  ]);
  registry.recordRun(payload.installId, "tool", ok ? "ok" : "error", ok ? `Executed ${action.title}` : safe);
  logAction(db, action, ok ? "EXECUTED" : "FAILED", ok ? "executed" : "failed", actor, ok ? "Executed (not handled until verified)." : safe);
  if (ok) {
    runWithDb(db, () =>
      eventsFor(db).append({
        type: EVENT_TYPES.ACTION_EXECUTED,
        source: "connector-engine",
        source_id: actionId,
        actor_id: actor,
        entity_type: "action",
        entity_id: actionId,
        payload: { type: action.type, title: action.title, installId: payload.installId, tool: payload.tool || null, handled: false },
        occurred_at: now,
        received_at: now,
        confidence: 1,
        idempotent: true,
      }),
    );
  }
  audit(db, actor, ok ? "connector.execute" : "connector.execute_failed", "action", actionId, { type: action.type });
  return one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [actionId])!;
}

export function connectorNow(db: DatabaseSync): string {
  return getMeta(db, "demo_now") || new Date().toISOString();
}

export function pendingConnectorActions(db: DatabaseSync): ActionRow[] {
  return (db
    .prepare(
      "SELECT * FROM actions WHERE type IN ('connector_write', 'connector_outbound') AND status IN ('proposed', 'approved') ORDER BY created_at DESC LIMIT 50",
    )
    .all() as ActionRow[]).map((row) => ({ ...row }));
}
