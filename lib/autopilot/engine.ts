import type { DatabaseSync } from "node:sqlite";
import { all, audit, getMeta, one, run } from "../db";
import { executeAction } from "../engine/execute";
import { evaluatePolicy, loadPolicies, planOutcome } from "../engine/policy";
import { getPlanBundle } from "../engine/recovery";
import { eventsFor, toEvent, type BusinessEvent } from "../events";
import type { VerificationRow } from "../learning";
import type { ActionRow, EventRow, ExceptionRow, Impact } from "../types";
import { autopilotAdapters, type EarlyWarning, type PlannedResponse } from "./adapters";
import { DecisionLog, decisionKey } from "./decisions";
import { actionGate, classify, isReversible, riskFromSeverity } from "./matrix";
import { isInboundEvent, readSignal } from "./signals";
import {
  toAttention,
  type ActionGate,
  type AutopilotState,
  type ClassificationInput,
  type Decision,
  type Signal,
} from "./types";

export const AUTOPILOT_ACTOR = "autopilot";

const NORMAL_EVENT_INPUT: ClassificationInput = {
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

export type AutopilotRun = {
  now: string;
  exceptionsCreated: string[];
  plansCreated: string[];
  actionsExecuted: string[];
  actionsFailed: string[];
  decisionsWritten: number;
  exceptionStates: Record<string, AutopilotState>;
  eventStates: Record<string, AutopilotState>;
};

/**
 * One deterministic pass of the control loop:
 * detect → signals → plan → policy → classify → (auto-execute) → persist → audit.
 * Safe to call any number of times: every write is keyed on a stable id or guarded by a state check.
 */
export function runAutopilot(db: DatabaseSync, now = getMeta(db, "demo_now")): AutopilotRun {
  const adapters = autopilotAdapters();
  const log = DecisionLog.for(db);
  const result: AutopilotRun = {
    now,
    exceptionsCreated: [],
    plansCreated: [],
    actionsExecuted: [],
    actionsFailed: [],
    decisionsWritten: 0,
    exceptionStates: {},
    eventStates: {},
  };

  adapters.exceptions.detect(db, now);

  const inbound = loadInboundEvents(db);
  for (const event of inbound) {
    const signal = readSignal(event);
    if (signal && ensureSignalException(db, event, signal, now)) result.exceptionsCreated.push(signalExceptionId(event.id));
  }

  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions ORDER BY created_at, id");
  for (const exception of exceptions) {
    if (hasPlan(db, exception.id)) continue;
    const response = adapters.planner.planFor(db, exception, now);
    if (!response) continue;
    insertPlan(db, exception.id, `pln_ap_${exception.id}`, `act_ap_${exception.id}`, response, now, {
      source: `planner:${adapters.planner.name}`,
    });
    result.plansCreated.push(exception.id);
  }

  const latest = log.latestAll();
  for (const row of all<ExceptionRow>(db, "SELECT * FROM exceptions ORDER BY created_at, id")) {
    let facts = gatherFacts(db, row);
    let decision = classify(facts);
    if (decision.state === "AUTO_HANDLED" && facts.execution === "none") {
      const outcome = autoExecute(db, row.id, now);
      result.actionsExecuted.push(...outcome.executed);
      result.actionsFailed.push(...outcome.failed);
      facts = gatherFacts(db, row);
      decision = classify(facts);
    }
    decision = { ...decision, reason: explain(db, row.id, decision) };
    persistException(db, row.id, decision.state);
    if (log.record("exception", row.id, decision, facts, now, latest.get(decisionKey("exception", row.id)))) {
      result.decisionsWritten += 1;
    }
    result.exceptionStates[row.id] = decision.state;
  }

  const anchors = eventAnchors(db, inbound);
  for (const event of inbound) {
    const exceptionId = anchors.get(event.id);
    const decision: Decision = exceptionId
      ? {
          state: result.exceptionStates[exceptionId],
          rule: "E01_ANCHORED_TO_EXCEPTION",
          reason: `Evidence for exception ${exceptionId}; follows its state.`,
        }
      : classify(NORMAL_EVENT_INPUT);
    const input = exceptionId ? { exceptionId } : NORMAL_EVENT_INPUT;
    if (log.record("event", event.id, decision, input, now, latest.get(decisionKey("event", event.id)))) {
      result.decisionsWritten += 1;
    }
    result.eventStates[event.id] = decision.state;
  }

  return result;
}

function loadInboundEvents(db: DatabaseSync): BusinessEvent[] {
  return all<EventRow>(db, "SELECT * FROM events ORDER BY occurred_at, id").map(toEvent).filter(isInboundEvent);
}

export function signalExceptionId(eventId: string) {
  return `exc_ap_${eventId}`;
}

/** Exception-level plans only. Goal plans (lib/goals, plans.goal_id set) are owned by the goal engine. */
const OWN_PLAN = "(p.goal_id IS NULL OR p.goal_id = '')";

function hasPlan(db: DatabaseSync, exceptionId: string) {
  return Boolean(one(db, `SELECT p.id FROM plans p WHERE p.exception_id = ? AND ${OWN_PLAN}`, [exceptionId]));
}

/** Actions of the exception's own plan, in a stable order. */
export function exceptionActions(db: DatabaseSync, exceptionId: string): ActionRow[] {
  return all<ActionRow>(
    db,
    `SELECT a.* FROM actions a JOIN plans p ON p.id = a.plan_id
     WHERE p.exception_id = ? AND ${OWN_PLAN} ORDER BY a.created_at, a.id`,
    [exceptionId],
  );
}

/** Signal → exception (+ its plan). Returns true only when rows were created. */
function ensureSignalException(db: DatabaseSync, event: BusinessEvent, signal: Signal, now: string): boolean {
  const exceptionId = signalExceptionId(event.id);
  if (one(db, "SELECT id FROM exceptions WHERE id = ?", [exceptionId])) return false;

  const impact: Impact = {
    customersAffected: event.entity_type === "customer" ? 1 : 0,
    opportunitiesAffected: 0,
    revenueAssociated: signal.impactValue,
    currency: "DZD",
    cashTimingAffected: signal.kind === "payment_watch",
    urgency: signal.risk === "medium" ? "medium" : "low",
    notes: `Signal rule ${event.type}. Value is the associated amount on the event, not a loss.`,
  };
  const evidence = {
    source: event.source,
    quote: typeof event.payload.text === "string" ? event.payload.text : signal.title,
    expected: signal.expected,
    actual: signal.actual,
    deal: signal.impactValue ? `${signal.impactValue.toLocaleString("en-US")} DZD` : "",
    confidence: event.confidence,
    eventId: event.id,
    signalRule: event.type,
  };
  run(
    db,
    `INSERT INTO exceptions
      (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at)
     VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      exceptionId,
      signal.title,
      signal.kind,
      signal.actions.length ? "NEEDS_YOU" : "MONITORING",
      signal.risk,
      impact.urgency,
      JSON.stringify(impact),
      JSON.stringify(evidence),
      event.confidence,
      event.occurred_at,
    ],
  );
  if (signal.actions.length) {
    insertPlan(
      db,
      exceptionId,
      `pln_ap_${event.id}`,
      `act_ap_${event.id}`,
      { title: signal.title, summary: `Response to ${event.type}`, actions: signal.actions },
      now,
      { source: "autopilot-signal", eventId: event.id },
    );
  }
  eventsFor(db).append({
    type: "exception.created",
    source: AUTOPILOT_ACTOR,
    source_id: exceptionId,
    actor_id: AUTOPILOT_ACTOR,
    entity_type: event.entity_type || "event",
    entity_id: event.entity_id || event.id,
    payload: { kind: signal.kind, exceptionId, signalEventId: event.id },
    occurred_at: event.occurred_at,
    received_at: now,
    confidence: event.confidence,
    idempotent: true,
  });
  return true;
}

/** Every proposed action goes through the existing policy engine. Ids are stable. */
function insertPlan(
  db: DatabaseSync,
  exceptionId: string,
  planId: string,
  actionPrefix: string,
  response: PlannedResponse,
  now: string,
  evidence: Record<string, unknown>,
) {
  const policies = loadPolicies(db);
  const evaluated = response.actions.map((a) => ({ ...a, policy: evaluatePolicy(a, policies) }));
  const outcome = planOutcome(evaluated.map((a) => a.policy.outcome));
  run(
    db,
    `INSERT OR IGNORE INTO plans (id, exception_id, title, summary, status, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [planId, exceptionId, response.title, response.summary, outcome === "AUTO" ? "approved" : outcome.toLowerCase(), "autopilot-v1", now],
  );
  evaluated.forEach((action, n) => {
    run(
      db,
      `INSERT OR IGNORE INTO actions
        (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status, evidence_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${actionPrefix}_${n}`,
        exceptionId,
        planId,
        action.type,
        action.title,
        action.description,
        JSON.stringify(action.payload),
        action.policy.outcome,
        action.policy.reason,
        action.policy.outcome === "BLOCKED" ? "blocked" : "proposed",
        JSON.stringify({ ...evidence, exceptionId }),
        now,
      ],
    );
  });
}

function latestVerification(db: DatabaseSync, exceptionId: string): VerificationRow | undefined {
  return one<VerificationRow>(
    db,
    "SELECT * FROM verifications WHERE exception_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1",
    [exceptionId],
  );
}

function executedByAutopilot(db: DatabaseSync, actionId: string): boolean {
  const event = eventsFor(db).list({ type: "action.executed", source: "action-engine", entity_type: "action", entity_id: actionId, limit: 1 })[0];
  return event?.actor_id === AUTOPILOT_ACTOR;
}

/** Facts for the matrix, read from real rows only. */
export function gatherFacts(db: DatabaseSync, exception: ExceptionRow): ClassificationInput {
  const actions = exceptionActions(db, exception.id);
  const allowed = actions.filter((a) => a.policy_outcome !== "BLOCKED");
  const executed = allowed.filter((a) => a.status === "executed");
  const blocked = actions.some((a) => a.policy_outcome === "BLOCKED");
  const execution: ClassificationInput["execution"] = actions.some((a) => a.status === "failed")
    ? "failed"
    : allowed.length > 0 && executed.length === allowed.length
      ? "executed"
      : executed.length > 0
        ? "partial"
        : "none";
  const policy: ClassificationInput["policy"] =
    actions.length === 0
      ? "NONE"
      : blocked && executed.length === 0
        ? "BLOCKED"
        : planOutcome(allowed.map((a) => a.policy_outcome));
  const impact = safeJson(exception.impact_json) as Partial<Impact>;
  const verification = latestVerification(db, exception.id);
  return {
    risk: riskFromSeverity(exception.severity),
    policy,
    impactValue: Number(impact.revenueAssociated || 0),
    reversible: allowed.every((a) => isReversible(a.type)),
    hasActions: allowed.length > 0,
    execution,
    executedBy:
      execution === "executed"
        ? executed.every((a) => executedByAutopilot(db, a.id))
          ? "autopilot"
          : "human"
        : null,
    verification: verification ? verification.status : "none",
    resolved: exception.status === "resolved",
  };
}

/** Executes only AUTO actions, through the existing action engine, as the autopilot actor. */
function autoExecute(db: DatabaseSync, exceptionId: string, now: string) {
  const executed: string[] = [];
  const failed: string[] = [];
  const actions = exceptionActions(db, exceptionId).filter(
    (a) => a.policy_outcome === "AUTO" && a.status === "proposed",
  );
  for (const action of actions) {
    try {
      executeAction(db, action.id, now, AUTOPILOT_ACTOR);
      executed.push(action.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      run(db, "UPDATE actions SET status = 'failed', evidence_json = ? WHERE id = ?", [
        JSON.stringify({ ...safeJson(action.evidence_json), error: message, failedAt: now }),
        action.id,
      ]);
      audit(db, AUTOPILOT_ACTOR, "autopilot.execute_failed", "action", action.id, { error: message });
      failed.push(action.id);
      break;
    }
  }
  return { executed, failed };
}

function persistException(db: DatabaseSync, exceptionId: string, state: AutopilotState) {
  const attention = toAttention(state);
  const row = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [exceptionId])!;
  const status = state === "AUTO_HANDLED" || state === "HANDLED" ? "resolved" : row.status;
  if (row.attention === attention && row.status === status) return;
  run(db, "UPDATE exceptions SET attention = ?, status = ? WHERE id = ?", [attention, status, exceptionId]);
}

/** Adds the concrete facts a human needs to the matrix's generic reason. */
function explain(db: DatabaseSync, exceptionId: string, decision: Decision): string {
  const actions = exceptionActions(db, exceptionId);
  if (decision.state === "BLOCKED") {
    const blocked = actions.find((a) => a.policy_outcome === "BLOCKED");
    // Prefer an alternative of the same kind as the blocked action (e.g. the 5% discount for a blocked 10%).
    const alternatives = actions
      .filter((a) => a.policy_outcome !== "BLOCKED")
      .sort((a, b) => Number(b.type === blocked?.type) - Number(a.type === blocked?.type))
      .map((a) => a.title);
    const alt = alternatives.length ? ` Alternative prepared: ${alternatives[0]}.` : " No allowed alternative yet.";
    if (blocked?.type === "apply_discount") {
      const max = Number(loadPolicies(db).discount_max ?? 5);
      const requested = Number(safeJson(blocked.payload).percent ?? 0);
      return `Policy blocks a ${requested}% discount. Maximum allowed: ${max}%.${alt}`;
    }
    return `${blocked?.policy_reason || decision.reason}${alt}`;
  }
  const needApproval = actions.filter((a) => actionGate(a) === "NEEDS_APPROVAL");
  if ((decision.state === "NEEDS_YOU" || decision.state === "NEEDS_APPROVAL") && actions.length) {
    const prepared = `${actions.length} action(s) prepared`;
    const gate = needApproval.length ? `; ${needApproval.length} external/financial step(s) need approval` : "";
    return `${decision.reason} ${prepared}${gate}.`;
  }
  return decision.reason;
}

/**
 * Which inbound events are evidence for which exception:
 * - signal exceptions point at their event (evidence.eventId);
 * - a verification points at the event that resolved it (evidence.eventId);
 * - any inbound event whose text is the exception's quoted evidence.
 */
function eventAnchors(db: DatabaseSync, inbound: BusinessEvent[]): Map<string, string> {
  const anchors = new Map<string, string>();
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions ORDER BY created_at, id");
  const byQuote = new Map<string, string>();
  for (const exception of exceptions) {
    const evidence = safeJson(exception.evidence_json);
    if (typeof evidence.eventId === "string") anchors.set(evidence.eventId, exception.id);
    if (typeof evidence.quote === "string" && evidence.quote && !byQuote.has(evidence.quote)) {
      byQuote.set(evidence.quote, exception.id);
    }
  }
  for (const verification of all<VerificationRow>(db, "SELECT * FROM verifications WHERE status != 'PENDING'")) {
    const eventId = safeJson(verification.evidence).eventId;
    if (typeof eventId === "string" && !anchors.has(eventId)) anchors.set(eventId, verification.exception_id);
  }
  for (const event of inbound) {
    if (anchors.has(event.id)) continue;
    const text = event.payload.text;
    if (typeof text === "string" && byQuote.has(text)) anchors.set(event.id, byQuote.get(text)!);
  }
  const known = new Set(exceptions.map((e) => e.id));
  for (const [eventId, exceptionId] of anchors) if (!known.has(exceptionId)) anchors.delete(eventId);
  return anchors;
}

// ---------------------------------------------------------------------------------------------
// Read model for the Pulse
// ---------------------------------------------------------------------------------------------

export type AutopilotCard = {
  id: string;
  title: string;
  kind: string;
  state: AutopilotState;
  rule: string;
  reason: string;
  impactValue: number;
  currency: string;
  quote: string;
  actions: { id: string; type: string; title: string; gate: ActionGate; policyReason: string }[];
  verification: { status: string; expectedBy: string; resolvedAt: string | null } | null;
  earlyWarnings: EarlyWarning[];
  memory: string | null;
  history: { state: AutopilotState; rule: string; at: string }[];
};

export const ATTENTION_ORDER: AutopilotState[] = [
  "NEEDS_YOU",
  "BLOCKED",
  "NEEDS_APPROVAL",
  "MONITORING",
  "AUTO_HANDLED",
  "HANDLED",
];

export function autopilotSummary(db: DatabaseSync, now = getMeta(db, "demo_now")) {
  const pass = runAutopilot(db, now);
  const log = DecisionLog.for(db);
  const adapters = autopilotAdapters();

  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions ORDER BY created_at DESC, id");
  const cards: AutopilotCard[] = [];
  for (const exception of exceptions) {
    const decision = log.latest("exception", exception.id);
    if (!decision || decision.state === "NORMAL") continue;
    const impact = safeJson(exception.impact_json) as Partial<Impact>;
    const bundle = getPlanBundle(db, exception.id);
    const verification = latestVerification(db, exception.id);
    cards.push({
      id: exception.id,
      title: exception.title,
      kind: exception.kind,
      state: decision.state,
      rule: decision.rule,
      reason: decision.reason,
      impactValue: Number(impact.revenueAssociated || 0),
      currency: impact.currency || "DZD",
      quote: String(safeJson(exception.evidence_json).quote || ""),
      actions: exceptionActions(db, exception.id).map(
        (a) => ({ id: a.id, type: a.type, title: a.title, gate: actionGate(a), policyReason: a.policy_reason }),
      ),
      verification: verification
        ? { status: verification.status, expectedBy: verification.expected_by, resolvedAt: verification.resolved_at }
        : null,
      earlyWarnings: adapters.earlyWarnings.warningsFor(db, exception, now),
      memory: bundle.historicalEvidence?.historically_stronger_strategy?.wording ?? null,
      history: log.history("exception", exception.id).map((d) => ({ state: d.state, rule: d.rule, at: d.decided_at })),
    });
  }
  cards.sort((a, b) => ATTENTION_ORDER.indexOf(a.state) - ATTENTION_ORDER.indexOf(b.state) || b.impactValue - a.impactValue);

  const items = countBy(cards.map((c) => c.state));
  const eventStates = Object.values(pass.eventStates);
  const events = {
    understood: eventStates.length,
    byState: countBy(eventStates),
  };
  const requiredNothing = events.byState.NORMAL;
  const safelyHandled = items.AUTO_HANDLED + items.HANDLED;
  const monitored = items.MONITORING;
  const needYou = items.NEEDS_YOU + items.NEEDS_APPROVAL + items.BLOCKED;
  const headline = `Your business is running · ${events.understood} events understood · ${requiredNothing} required nothing · ${safelyHandled} safely handled · ${monitored} monitored · ${needYou} need you`;

  const activity = loadInboundEvents(db)
    .filter((e) => pass.eventStates[e.id] === "NORMAL")
    .slice(-40)
    .reverse()
    .map((e) => ({ id: e.id, type: e.type, source: e.source, occurred_at: e.occurred_at, payload: e.payload }));

  return {
    now,
    headline,
    totals: { eventsUnderstood: events.understood, requiredNothing, safelyHandled, monitored, needYou },
    items,
    events,
    cards,
    activity,
  };
}

function countBy(states: AutopilotState[]): Record<AutopilotState, number> {
  const counts: Record<AutopilotState, number> = {
    NORMAL: 0,
    AUTO_HANDLED: 0,
    MONITORING: 0,
    NEEDS_APPROVAL: 0,
    NEEDS_YOU: 0,
    BLOCKED: 0,
    HANDLED: 0,
  };
  for (const s of states) counts[s] += 1;
  return counts;
}

function safeJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

