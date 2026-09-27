import type { DatabaseSync } from "node:sqlite";
import { formatMoney } from "../clock";
import { all, getMeta as readMeta, one } from "../db";
import { buildCausalExplorer } from "../engine/causal";
import { calculateGraphImpact } from "../engine/impact";
import { evaluatePolicy, loadPolicies } from "../engine/policy";
import { businessTwin } from "../engine/twin";
import { eventsFor } from "../events";
import { executeSafeActions } from "../goals/execute-safe";
import { createGoal } from "../goals/service";
import { IDS, id } from "../ids";
import { StrategyMemory, VerificationService, contextFromException } from "../learning";
import { runSimulation } from "../simulation";
import { EarlyWarningEngine, formatHours } from "../warnings";
import type { CommandSession } from "./session";
import type {
  CommandEvidence,
  CommandIntent,
  CommandResult,
  ResultStatus,
  ScenarioParameters,
  SourceSystem,
  TimeScope,
} from "./types";
import type { ActionRow, ExceptionRow, PlanRow } from "../types";

export type IntentContext = {
  message: string;
  intent: CommandIntent;
  entities: string[];
  timeScope: TimeScope;
  scenario: ScenarioParameters | null;
  session: CommandSession;
  now: string;
};

const MEANINGFUL = new Set([
  "shipment.delayed",
  "shipment.revised",
  "message.received",
  "order.affected",
  "exception.created",
  "customer.replied",
  "policy.blocked",
  "commitment.missed",
]);

export function runIntent(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const q = ctx.message.toLowerCase().replace(/\s+/g, " ").trim();
  if (ctx.intent === "BUSINESS_CHANGES") return changes(db, ctx);
  if (ctx.intent === "ATTENTION") return attention(db, ctx);
  if (ctx.intent === "FUTURE_RISK") return futureRisk(db, ctx);
  if (ctx.intent === "CAUSAL_EXPLANATION" || ctx.intent === "IMPACT") return causal(db, ctx);
  if (ctx.intent === "SIMULATION") return simulation(db, ctx);
  if (ctx.intent === "GOAL") return goal(db, ctx);
  if (ctx.intent === "PLAN") return plan(db, ctx);
  if (ctx.intent === "HISTORY") return history(db, ctx);
  if (ctx.intent === "POLICY") return q.includes("why") ? audit(db, ctx, "POLICY") : policy(db, ctx);
  if (ctx.intent === "EXECUTION") return execution(db, ctx);
  if (ctx.intent === "STATUS" && /why did you/.test(q)) return audit(db, ctx, "STATUS");
  if (ctx.intent === "STATUS" && /monitor/.test(q)) return monitoring(db, ctx);
  if (ctx.intent === "STATUS") return twinState(db, ctx);
  if (/^approve\b/.test(q)) return approveExplicit(db, ctx);
  return unknown(ctx);
}

function changes(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const day = ctx.now.slice(0, 10);
  const events = eventsFor(db).list({ from: `${day}T00:00:00+01:00`, to: `${day}T23:59:59+01:00`, limit: 200 });
  const meaningful = events.filter((event) => MEANINGFUL.has(event.type));
  const orders = meaningful.filter((event) => event.type === "order.affected");
  const rest = meaningful.filter((event) => event.type !== "order.affected");
  const lines = rest.map((event) => describeEvent(event.type, event.payload));
  if (orders.length) {
    lines.push(
      orders.length === 1
        ? describeEvent("order.affected", orders[0].payload)
        : `${orders.length} orders were marked affected by the shipment change.`,
    );
  }
  const evidence: CommandEvidence[] = meaningful.map((event) => ({
    statement: describeEvent(event.type, event.payload),
    sourceSystem: "EVENTS",
    sourceType: event.type,
    sourceId: event.id,
    timestamp: event.occurred_at,
  }));
  return base(ctx, {
    intent: "BUSINESS_CHANGES",
    answerType: "TIMELINE",
    status: "OK",
    summary: lines.length ? `${lines.length} meaningful changes today` : "No meaningful business changes are recorded today.",
    data: { changes: lines, count: lines.length },
    evidence,
    links: [{ href: "/timeline", label: "View timeline" }],
    sourceSystems: ["EVENTS"],
  });
}

function attention(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions WHERE attention = 'NEEDS_YOU' AND status != 'resolved'");
  const actions = all<ActionRow>(db, "SELECT * FROM actions");
  const approvals = actions.filter((action) => action.policy_outcome === "APPROVAL_REQUIRED" && action.status !== "executed");
  const blocked = actions.filter((action) => action.policy_outcome === "BLOCKED" && action.status !== "executed");
  const items = [
    ...exceptions.map((row) => ({
      kind: "NEEDS_YOU" as const,
      id: row.id,
      title: row.title,
      detail: moneyFrom(row.impact_json),
    })),
    ...approvals.map((row) => ({ kind: "NEEDS_APPROVAL" as const, id: row.id, title: row.title, detail: row.policy_reason })),
    ...blocked.map((row) => ({ kind: "BLOCKED" as const, id: row.id, title: row.title, detail: row.policy_reason })),
  ];
  return base(ctx, {
    intent: "ATTENTION",
    answerType: "ATTENTION",
    status: approvals.length || blocked.length ? "APPROVAL_REQUIRED" : items.length ? "OK" : "OK",
    summary: items.length ? `${items.length} things need you` : "Nothing needs you.",
    data: { items, autopilot: "not_merged" },
    evidence: items.map((item) => ({
      statement: `${item.kind}: ${item.title}`,
      sourceSystem: item.kind === "NEEDS_YOU" ? "DETECT" : "POLICY",
      sourceId: item.id,
    })),
    links: [{ href: "/", label: "Open pulse" }],
    sourceSystems: ["DETECT", "POLICY"],
    approvalRequired: approvals.length > 0,
    warnings: ["Exception Autopilot is not merged. Attention comes from Pulse and Policy, not an autopilot queue."],
    exceptionId: exceptions[0]?.id,
  });
}

function monitoring(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const engine = EarlyWarningEngine.for(db);
  engine.evaluateAll(ctx.now);
  const warnings = engine.getActiveWarnings().filter((row) => row.status === "ACTIVE" || row.status === "MONITORING");
  const pending = VerificationService.for(db).getPendingVerifications();
  const risk = warnings.map((row) => {
    const summary = engine.summarize(row);
    return { channel: "risk", id: row.id, title: summary.title, state: summary.buffer_state, status: summary.status };
  });
  const checks = pending.map((row) => ({
    channel: "verification",
    id: row.id,
    title: row.expected_event_type,
    state: row.status,
    exceptionId: row.exception_id,
  }));
  return base(ctx, {
    intent: "STATUS",
    answerType: "WARNING",
    status: "MONITORING",
    summary: `Monitoring ${risk.length + checks.length} situations`,
    data: { riskMonitoring: risk, verificationMonitoring: checks },
    evidence: [
      ...risk.map((item) => ({ statement: `${item.title} · ${item.state}`, sourceSystem: "EARLY_WARNING" as const, sourceId: item.id })),
      ...checks.map((item) => ({ statement: `Awaiting ${item.title}`, sourceSystem: "VERIFICATION" as const, sourceId: item.id })),
    ],
    links: [
      { href: "/warnings", label: "View warnings" },
      { href: "/timeline", label: "View timeline" },
    ],
    sourceSystems: ["EARLY_WARNING", "VERIFICATION"],
    warningId: warnings[0]?.id,
  });
}

function futureRisk(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const engine = EarlyWarningEngine.for(db);
  engine.evaluateAll(ctx.now);
  const rows = engine
    .getActiveWarnings()
    .map((row) => engine.summarize(row))
    .filter((row) => row.status !== "RESOLVED" && row.status !== "ESCALATED" && row.buffer_state !== "MISSED" && !row.failed);
  const cards = rows.map((row) => ({
    id: row.id,
    title: row.title,
    state: `${row.buffer_state} — NOT MISSED`,
    available: formatHours(row.available_buffer_minutes),
    required: formatHours(row.required_buffer_minutes),
    shortfall: formatHours(row.shortfall_minutes),
    availableMinutes: row.available_buffer_minutes,
    requiredMinutes: row.required_buffer_minutes,
    shortfallMinutes: row.shortfall_minutes,
  }));
  return base(ctx, {
    intent: "FUTURE_RISK",
    answerType: "WARNING",
    status: cards.length ? "MONITORING" : "OK",
    summary: cards.length ? "Coming next" : "No future risk is active. Already-missed items stay with Detect.",
    data: { comingNext: cards },
    evidence: cards.map((card) => ({
      statement: `${card.title}: available ${card.available}, required ${card.required}, shortfall ${card.shortfall}`,
      sourceSystem: "EARLY_WARNING",
      sourceId: card.id,
    })),
    links: cards[0] ? [{ href: `/warnings/${cards[0].id}`, label: "Why?" }] : [{ href: "/warnings", label: "View warnings" }],
    sourceSystems: ["EARLY_WARNING", "EXPECTATIONS"],
    assumptions: ["Buffer uses stored downstream durations and the current shipment arrival. It is not a forecast of lost revenue."],
    warningId: cards[0]?.id,
  });
}

function causal(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const model = buildCausalExplorer(db);
  const impact = calculateGraphImpact(db, IDS.shipment);
  const path = model.columns.flatMap((column) => column.nodes.map((node) => node.label));
  return base(ctx, {
    intent: "CAUSAL_EXPLANATION",
    answerType: "CAUSAL_PATH",
    status: "OK",
    summary: `Why ${formatMoney(impact.associated_revenue)} is connected to this risk`,
    data: {
      path,
      orders: impact.affected_orders.length,
      customers: impact.affected_customers.length,
      associatedRevenue: impact.associated_revenue,
      expectedCash: impact.affected_expected_cash,
      currency: impact.currency,
      notALoss: true,
      headline: model.headline,
    },
    evidence: [
      {
        statement: impact.notes,
        sourceSystem: "IMPACT",
        sourceId: IDS.shipment,
      },
      {
        statement: model.subhead,
        sourceSystem: "GRAPH",
        sourceId: IDS.supplier,
      },
    ],
    links: [
      { href: "/explore", label: "View impact" },
      { href: `/impact/${IDS.excDelay}`, label: "Open cascade" },
    ],
    sourceSystems: ["GRAPH", "IMPACT"],
    warnings: ["850K is associated revenue on the graph. It is not a claim that the money is lost."],
    exceptionId: IDS.excDelay,
  });
}

function simulation(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const days = ctx.scenario?.days || 3;
  const targetId = ctx.scenario?.targetId || IDS.shipment;
  const before = readMeta(db, "supplier_phase", "stable");
  const result = runSimulation(db, { type: "supplier_delay", targetId, days });
  const after = readMeta(db, "supplier_phase", "stable");
  return base(ctx, {
    intent: "SIMULATION",
    answerType: "SIMULATION",
    status: result.isolation.unchanged && before === after ? "OK" : "FAILED",
    summary: "SIMULATION — NOT REAL BUSINESS STATE",
    data: {
      label: "SIMULATION — NOT REAL BUSINESS STATE",
      days,
      targetId,
      baseline: result.baseline,
      simulated: result.simulated,
      delta: result.delta,
      isolation: result.isolation,
      realityUnchanged: result.isolation.unchanged && before === after,
    },
    evidence: [
      {
        statement: `Simulation only. Fingerprint unchanged: ${String(result.isolation.unchanged)}.`,
        sourceSystem: "SIMULATION",
        sourceId: targetId,
      },
    ],
    links: [{ href: "/simulate", label: "Open simulation" }],
    sourceSystems: ["SIMULATION"],
    assumptions: ["The scenario clones graph state. It does not write the live company."],
  });
}

function goal(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const phaseBefore = readMeta(db, "supplier_phase", "stable");
  const created = createGoal(db, { utterance: ctx.message }, ctx.now);
  const phaseAfter = readMeta(db, "supplier_phase", "stable");
  const plan = created.plan;
  const counts = plan?.expectedImpact;
  return base(ctx, {
    intent: "GOAL",
    answerType: "PLAN",
    status: "PREPARED",
    summary: "Protection plan",
    data: {
      goalId: created.goal.id,
      goalType: created.goal.goal_type,
      scope: created.goal.scope,
      total: counts?.totalActions ?? 0,
      safe: counts?.autoActions ?? 0,
      approval: counts?.approvalRequiredActions ?? 0,
      blocked: counts?.blockedActions ?? 0,
      supplierPhaseUnchanged: phaseBefore === phaseAfter,
      executed: false,
      actions: plan?.actions.map((action) => ({
        id: action.id,
        title: action.title,
        policy: action.policyDecision,
      })),
    },
    evidence: (plan?.actions || []).slice(0, 8).map((action) => ({
      statement: `${action.title} · ${action.policyDecision}`,
      sourceSystem: "PLANNER" as const,
      sourceId: action.id,
    })),
    links: [{ href: `/goals/${created.goal.id}`, label: "Open the plan" }],
    sourceSystems: ["GOALS", "PLANNER", "POLICY", "EARLY_WARNING"],
    approvalRequired: (counts?.approvalRequiredActions ?? 0) > 0,
    warnings: phaseBefore === phaseAfter ? [] : ["Supplier phase changed while planning. That should not happen."],
    goalId: created.goal.id,
  });
}

function plan(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const latest = one<PlanRow>(db, "SELECT * FROM plans ORDER BY created_at DESC LIMIT 1");
  if (!latest) return unknown(ctx, "No plan is stored yet.");
  return base(ctx, {
    intent: "PLAN",
    answerType: "PLAN",
    status: "PREPARED",
    summary: latest.title,
    data: { planId: latest.id, status: latest.status, goalId: latest.goal_id },
    evidence: [{ statement: latest.summary, sourceSystem: "PLANNER", sourceId: latest.id }],
    links: latest.goal_id ? [{ href: `/goals/${latest.goal_id}`, label: "Open the plan" }] : [],
    sourceSystems: ["PLANNER"],
    goalId: latest.goal_id || undefined,
  });
}

function policy(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const actions = all<ActionRow>(db, "SELECT * FROM actions WHERE status != 'executed'");
  const policies = loadPolicies(db);
  const grouped = { AUTO: [] as ActionRow[], APPROVAL_REQUIRED: [] as ActionRow[], BLOCKED: [] as ActionRow[] };
  for (const action of actions) {
    const payload = parsePayload(action.payload);
    const decision = evaluatePolicy({ type: action.type, payload }, policies);
    if (decision.outcome === "AUTO") grouped.AUTO.push(action);
    else if (decision.outcome === "BLOCKED") grouped.BLOCKED.push(action);
    else grouped.APPROVAL_REQUIRED.push(action);
  }
  return base(ctx, {
    intent: "POLICY",
    answerType: "POLICY",
    status: grouped.BLOCKED.length ? "BLOCKED" : grouped.APPROVAL_REQUIRED.length ? "APPROVAL_REQUIRED" : "OK",
    summary: "Safe now",
    data: {
      autopilot: "not_merged",
      safe: grouped.AUTO.map(brief),
      approval: grouped.APPROVAL_REQUIRED.map(brief),
      blocked: grouped.BLOCKED.map(brief),
      discountMax: policies.discount_max,
    },
    evidence: grouped.BLOCKED.map((action) => ({
      statement: action.policy_reason,
      sourceSystem: "POLICY" as const,
      sourceId: action.id,
    })),
    links: [{ href: "/command", label: "Fix everything you're authorized to fix" }],
    sourceSystems: ["POLICY"],
    approvalRequired: grouped.APPROVAL_REQUIRED.length > 0,
    warnings: ["Exception Autopilot is not merged. Safe actions are the Policy AUTO set on stored plans."],
  });
}

function execution(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const plans = all<PlanRow>(db, "SELECT * FROM plans");
  const executed: string[] = [];
  const waiting: string[] = [];
  const blocked: string[] = [];
  for (const plan of plans) {
    const pending = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ? AND status != 'executed'", [plan.id]);
    if (!pending.some((action) => action.policy_outcome === "AUTO")) continue;
    const outcome = executeSafeActions(db, plan.id, ctx.now, "command");
    executed.push(...outcome.executed);
    waiting.push(...outcome.pendingApproval);
    blocked.push(...outcome.blocked);
  }
  const status: ResultStatus = executed.length ? "EXECUTED" : waiting.length ? "APPROVAL_REQUIRED" : blocked.length ? "BLOCKED" : "OK";
  return base(ctx, {
    intent: "EXECUTION",
    answerType: "EXECUTION_RESULT",
    status,
    summary: executed.length ? `${executed.length} safe actions executed.` : "No AUTO action was eligible to run.",
    data: {
      executed,
      waiting,
      blocked,
      autopilot: "not_merged",
    },
    evidence: [
      { statement: `${executed.length} AUTO actions executed after a live policy recheck.`, sourceSystem: "POLICY" },
      { statement: `${waiting.length} still require approval. ${blocked.length} stay blocked.`, sourceSystem: "POLICY" },
    ],
    links: [{ href: "/goals", label: "Open goals" }],
    sourceSystems: ["POLICY", "PLANNER", "VERIFICATION"],
    approvalRequired: waiting.length > 0,
  });
}

function history(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const exception = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [IDS.excMissed]);
  const context = exception ? contextFromException(exception) : "followup";
  const bundle = StrategyMemory.for(db).getStrategyEvidence(context);
  const top = bundle.historically_stronger_strategy;
  const observations = bundle.strategies.reduce((sum, item) => sum + item.observations, 0);
  const successes = bundle.strategies.reduce((sum, item) => sum + item.successes, 0);
  return base(ctx, {
    intent: "HISTORY",
    answerType: "HISTORICAL_EVIDENCE",
    // Both arms of this used to be "OK". Looking up history succeeds whether or not comparable
    // outcomes exist, and the summary below carries that distinction, so the status is simply OK.
    // Reporting "no evidence yet" as its own status would need a new ResultStatus member.
    status: "OK",
    summary: observations ? "Comparable recorded outcomes" : "No comparable recorded outcomes yet.",
    data: {
      observations,
      successes,
      failures: bundle.strategies.reduce((sum, item) => sum + item.failures, 0),
      strongest: top?.wording || null,
      strategies: bundle.strategies.map((item) => ({
        strategy: item.strategy,
        observations: item.observations,
        successes: item.successes,
        evidence: item.evidence,
      })),
      note: bundle.note,
    },
    evidence: bundle.strategies.map((item) => ({
      statement: item.evidence,
      sourceSystem: "LEARNING" as const,
      sourceId: item.strategy,
    })),
    links: [],
    sourceSystems: ["OUTCOME", "LEARNING"],
    assumptions: [bundle.note],
  });
}

function audit(db: DatabaseSync, ctx: IntentContext, intent: CommandIntent): CommandResult {
  const blocked = one<ActionRow>(
    db,
    "SELECT * FROM actions WHERE policy_outcome = 'BLOCKED' ORDER BY created_at DESC LIMIT 1",
  );
  const policies = loadPolicies(db);
  const latest = one<ActionRow>(db, "SELECT * FROM actions WHERE status = 'executed' ORDER BY created_at DESC LIMIT 1");
  const aboutBlock = /block|10%|discount/.test(ctx.message.toLowerCase());
  const trace = aboutBlock && blocked
    ? [
        { step: "POLICY", detail: blocked.policy_reason },
        { step: "REQUESTED", detail: blocked.title },
        { step: "MAXIMUM", detail: `discount_max=${policies.discount_max || "5"}%` },
      ]
    : [
        { step: "OBSERVED", detail: latest?.title || "No executed action is stored yet." },
        { step: "POLICY", detail: latest?.policy_reason || "No policy decision recorded." },
        { step: "CURRENT STATE", detail: latest?.status || "none" },
      ];
  return base(ctx, {
    intent,
    answerType: "AUDIT_TRACE",
    status: blocked && aboutBlock ? "BLOCKED" : "OK",
    summary: aboutBlock ? "The 10% discount stays blocked by policy." : "Recorded decision trace",
    data: { trace, autopilot: "not_merged" },
    evidence: trace.map((step) => ({ statement: `${step.step}: ${step.detail}`, sourceSystem: "POLICY" as const })),
    links: [{ href: `/exceptions/${IDS.excDiscount}`, label: "View trace" }],
    sourceSystems: ["POLICY", "DETECT"],
  });
}

function twinState(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const twin = businessTwin(db);
  return base(ctx, {
    intent: "STATUS",
    answerType: "SUMMARY",
    status: "OK",
    summary: "Business state",
    data: { domains: twin.domains },
    evidence: twin.domains.map((domain) => ({
      statement: `${domain.id}: ${domain.headline}`,
      sourceSystem: "GRAPH" as const,
    })),
    links: [{ href: "/", label: "Open pulse" }],
    sourceSystems: ["DETECT", "EARLY_WARNING", "IMPACT"],
  });
}

function approveExplicit(db: DatabaseSync, ctx: IntentContext): CommandResult {
  const action = one<ActionRow>(
    db,
    "SELECT * FROM actions WHERE policy_outcome = 'APPROVAL_REQUIRED' AND type IN ('draft_message', 'send_message') ORDER BY created_at DESC LIMIT 1",
  );
  if (!action) return unknown(ctx, "No customer follow-up is waiting for approval.");
  const decision = evaluatePolicy({ type: action.type, payload: parsePayload(action.payload) }, loadPolicies(db));
  if (decision.outcome === "BLOCKED") {
    return base(ctx, {
      intent: "POLICY",
      answerType: "POLICY",
      status: "BLOCKED",
      summary: decision.reason,
      data: {},
      evidence: [{ statement: decision.reason, sourceSystem: "POLICY", sourceId: action.id }],
      links: [],
      sourceSystems: ["POLICY"],
    });
  }
  return base(ctx, {
    intent: "POLICY",
    answerType: "POLICY",
    status: "APPROVAL_REQUIRED",
    summary: "Approval is recorded only from the plan screen. This command does not send the message.",
    data: { actionId: action.id, policy: decision.outcome },
    evidence: [{ statement: decision.reason, sourceSystem: "POLICY", sourceId: action.id }],
    links: action.plan_id ? [{ href: `/goals`, label: "Approve" }] : [],
    sourceSystems: ["POLICY"],
    approvalRequired: true,
  });
}

function unknown(ctx: IntentContext, summary?: string): CommandResult {
  return base(ctx, {
    intent: "UNKNOWN",
    answerType: "SUMMARY",
    status: "OK",
    summary: summary || "I don't have enough structured business data to answer that yet.",
    data: {
      suggestions: [
        "What changed today?",
        "What am I about to miss?",
        "Why is 850K at risk?",
        "What if Atlas is another 3 days late?",
        "Protect everything at risk this week.",
        "Fix everything you're authorized to fix.",
      ],
    },
    evidence: [],
    links: [{ href: "/command", label: "Ask EvoPulse" }],
    sourceSystems: [],
  });
}

function describeEvent(type: string, payload: Record<string, unknown>): string {
  if (type === "shipment.delayed") return "Atlas Supply revised Shipment SH-204.";
  if (type === "order.affected") return `An order moved because of SH-204${payload.amount ? ` (${String(payload.amount)} DZD)` : ""}.`;
  if (type === "message.received") {
    const text = String(payload.text || "");
    if (/10%/.test(text)) return "Customer requested 10% discount on the 320K opportunity.";
    if (/wednesday/i.test(text)) return "Atlas Supply revised Shipment SH-204. Monday → Wednesday.";
    return text || "A message was received.";
  }
  if (type === "customer.replied") return "Customer replied on the 320K opportunity.";
  if (type === "policy.blocked") return "A proposed action was blocked by policy.";
  if (type === "commitment.missed") return "A commitment passed its deadline with no fulfilment event.";
  if (type === "exception.created") return "A new exception was opened from a missed expectation.";
  return type;
}

function moneyFrom(raw: string): string {
  try {
    const impact = JSON.parse(raw) as { revenueAssociated?: number; currency?: string };
    if (!impact.revenueAssociated) return "";
    return formatMoney(impact.revenueAssociated, impact.currency || "DZD");
  } catch {
    return "";
  }
}

function brief(action: ActionRow) {
  return { id: action.id, title: action.title, type: action.type, reason: action.policy_reason };
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function base(
  ctx: IntentContext,
  input: {
    intent: CommandIntent;
    answerType: CommandResult["answerType"];
    status: ResultStatus;
    summary: string;
    data: Record<string, unknown>;
    evidence: CommandEvidence[];
    links: CommandResult["links"];
    sourceSystems: SourceSystem[];
    assumptions?: string[];
    warnings?: string[];
    approvalRequired?: boolean;
    warningId?: string;
    exceptionId?: string;
    goalId?: string;
  },
): CommandResult {
  return {
    commandId: id("cmd"),
    intent: input.intent,
    understoodAs: ctx.message,
    answerType: input.answerType,
    status: input.status,
    summary: input.summary,
    data: {
      ...input.data,
      ...(input.warningId ? { warningId: input.warningId } : {}),
      ...(input.exceptionId ? { exceptionId: input.exceptionId } : {}),
      ...(input.goalId ? { goalId: input.goalId } : {}),
    },
    evidence: input.evidence,
    actions: [],
    links: input.links,
    sourceSystems: input.sourceSystems,
    generatedAt: ctx.now,
    assumptions: input.assumptions || [],
    warnings: input.warnings || [],
    approvalRequired: Boolean(input.approvalRequired),
    session: { id: ctx.session.id, lastIntent: input.intent },
  };
}
