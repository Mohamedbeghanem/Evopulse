import type { DatabaseSync } from "node:sqlite";
import { projectAttention } from "../attention";
import { ExceptionAutopilotService } from "../autopilot";
import { formatMoney } from "../clock";
import { all, getMeta, one } from "../db";
import { buildCausalExplorer } from "../engine/causal";
import { calculateGraphImpact, calculateImpact } from "../engine/impact";
import { executeAction } from "../engine/execute";
import { businessTwin } from "../engine/twin";
import { evaluatePolicy, loadPolicies, recheckActionPolicy } from "../engine/policy";
import { eventsFor } from "../events";
import { createGoal, getGoalBundle } from "../goals/service";
import { buildPlan, hydratePlan } from "../goals/planner";
import { executeSafeActions } from "../goals/execute-safe";
import { id, IDS } from "../ids";
import { StrategyMemory, VerificationService, contextFromException } from "../learning";
import { runSimulation } from "../simulation";
import { EarlyWarningEngine, formatHours, WarningExplanationService } from "../warnings";
import type { ActionRow, ExceptionRow, GoalRow, PlanRow } from "../types";
import type { RunContext } from "./store";
import type { ToolEvidence, ToolPermission, ToolResult, ToolSchema } from "./types";

export type ToolHandlerContext = {
  db: DatabaseSync;
  now: string;
  runId: string;
  command: string;
  context: RunContext;
};

export type ToolDefinition = {
  schema: ToolSchema;
  execute: (args: Record<string, unknown>, ctx: ToolHandlerContext) => ToolResult | Promise<ToolResult>;
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

function ok(
  ctx: ToolHandlerContext,
  tool: string,
  data: Record<string, unknown>,
  extra: Partial<ToolResult> = {},
): ToolResult {
  return {
    toolCallId: id("atc"),
    tool,
    status: extra.status || "ok",
    data,
    evidence: extra.evidence || [],
    policy: extra.policy || null,
    requiresApproval: Boolean(extra.requiresApproval),
    links: extra.links || [],
    generatedAt: ctx.now,
    error: extra.error,
  };
}

function fail(ctx: ToolHandlerContext, tool: string, error: string, data: Record<string, unknown> = {}): ToolResult {
  return ok(ctx, tool, data, { status: "failed", error });
}

export function resolveEntityId(raw?: string): string {
  const q = String(raw || "").toLowerCase();
  if (!q) return IDS.shipment;
  if (/atlas supply|supplier/.test(q) || raw === IDS.supplier) return IDS.supplier;
  if (/sh-?204|shipment/.test(q) || raw === IDS.shipment) return IDS.shipment;
  if (/320|opportunity/.test(q) || raw === IDS.opportunity) return IDS.opportunity;
  if (/order a|oran/.test(q)) return IDS.orderA;
  if (/order b|constantine/.test(q)) return IDS.orderB;
  if (/order c|s[eé]tif/.test(q)) return IDS.orderC;
  return raw || IDS.shipment;
}

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  get_business_state: {
    schema: {
      name: "get_business_state",
      description: "Read current attention, warnings, exceptions, goals, pending approvals, and handled situations.",
      permission: "READ",
      parameters: {},
    },
    execute(_args, ctx) {
      const attention = projectAttention(ctx.db, ctx.now);
      const warnings = EarlyWarningEngine.for(ctx.db)
        .getActiveWarnings()
        .map((row) => EarlyWarningEngine.for(ctx.db).summarize(row));
      const exceptions = all<ExceptionRow>(ctx.db, "SELECT * FROM exceptions WHERE status != 'resolved'");
      const goals = all<GoalRow>(ctx.db, "SELECT * FROM goals ORDER BY created_at DESC LIMIT 8");
      const pending = all<ActionRow>(
        ctx.db,
        "SELECT * FROM actions WHERE policy_outcome = 'APPROVAL_REQUIRED' AND status != 'executed'",
      );
      return ok(
        ctx,
        "get_business_state",
        {
          attention: attention.summary,
          needsMe: attention.needsMe.map(briefAttention),
          monitoring: attention.watching.map(briefAttention),
          handled: attention.handled.map(briefAttention),
          warnings: warnings.map((row) => ({ id: row.id, title: row.title, state: row.buffer_state })),
          exceptions: exceptions.map((row) => ({ id: row.id, title: row.title, attention: row.attention })),
          goals: goals.map((row) => ({ id: row.id, name: row.name, status: row.status })),
          pendingApprovals: pending.map(briefAction),
        },
        {
          evidence: attention.needsMe.map((item) => ({
            statement: item.title,
            sourceSystem: "AUTOPILOT" as const,
            sourceId: item.id,
          })),
          links: [{ href: "/", label: "Open pulse" }],
        },
      );
    },
  },

  get_recent_changes: {
    schema: {
      name: "get_recent_changes",
      description: "Read recent Event Layer changes. Optional time range and entity filter.",
      permission: "READ",
      parameters: {
        timeRange: { type: "string", description: "today | this_week | unspecified" },
        entityId: { type: "string", description: "Optional entity filter" },
      },
    },
    execute(args, ctx) {
      const day = ctx.now.slice(0, 10);
      const range = String(args.timeRange || "today");
      const entityId = args.entityId ? resolveEntityId(String(args.entityId)) : undefined;
      const from = range === "this_week" ? `${day.slice(0, 8)}21T00:00:00+01:00` : `${day}T00:00:00+01:00`;
      const events = eventsFor(ctx.db)
        .list({ from, to: `${day}T23:59:59+01:00`, limit: 200, entity_id: entityId })
        .filter((event) => MEANINGFUL.has(event.type) || Boolean(entityId));
      const lines = events.map((event) => describeEvent(event.type, event.payload));
      return ok(
        ctx,
        "get_recent_changes",
        { changes: lines, count: lines.length, events: events.map((event) => ({ id: event.id, type: event.type, payload: event.payload })) },
        {
          evidence: events.map((event) => ({
            statement: describeEvent(event.type, event.payload),
            sourceSystem: "EVENTS",
            sourceType: event.type,
            sourceId: event.id,
            timestamp: event.occurred_at,
          })),
          links: [{ href: "/timeline", label: "View timeline" }],
        },
      );
    },
  },

  get_attention: {
    schema: {
      name: "get_attention",
      description: "Return the canonical attention projection. Read only.",
      permission: "READ",
      parameters: {},
    },
    execute(_args, ctx) {
      const projection = projectAttention(ctx.db, ctx.now);
      return ok(
        ctx,
        "get_attention",
        {
          items: projection.needsMe.map(briefAttention),
          watching: projection.watching.map(briefAttention),
          summary: projection.summary,
        },
        {
          evidence: projection.needsMe.map((item) => ({
            statement: `${item.classification}: ${item.title}`,
            sourceSystem: "AUTOPILOT",
            sourceId: item.id,
          })),
          links: [{ href: "/", label: "Open pulse" }],
        },
      );
    },
  },

  get_upcoming_risks: {
    schema: {
      name: "get_upcoming_risks",
      description: "Use Early Warning. Deadlines are decided by Detect, not the model.",
      permission: "READ",
      parameters: {},
    },
    execute(_args, ctx) {
      const engine = EarlyWarningEngine.for(ctx.db);
      engine.evaluateAll(ctx.now);
      const cards = engine
        .getActiveWarnings()
        .map((row) => engine.summarize(row))
        .filter((row) => row.status !== "RESOLVED" && row.status !== "ESCALATED" && row.buffer_state !== "MISSED" && !row.failed)
        .map((row) => ({
          id: row.id,
          title: row.title,
          state: `${row.buffer_state} — NOT MISSED`,
          available: formatHours(row.available_buffer_minutes),
          required: formatHours(row.required_buffer_minutes),
          shortfall: formatHours(row.shortfall_minutes),
        }));
      return ok(
        ctx,
        "get_upcoming_risks",
        { comingNext: cards },
        {
          evidence: cards.map((card) => ({
            statement: `${card.title}: available ${card.available}, required ${card.required}`,
            sourceSystem: "EARLY_WARNING",
            sourceId: card.id,
          })),
          links: cards[0] ? [{ href: `/warnings/${cards[0].id}`, label: "Why?" }] : [{ href: "/warnings", label: "View warnings" }],
        },
      );
    },
  },

  explain_risk: {
    schema: {
      name: "explain_risk",
      description: "Use Graph, Impact, and Causal. Never calculate authoritative money in the model.",
      permission: "READ",
      parameters: {
        warningId: { type: "string", description: "Warning id" },
        exceptionId: { type: "string", description: "Exception id" },
        entityId: { type: "string", description: "Entity id or name" },
      },
    },
    execute(args, ctx) {
      const entityId = resolveEntityId(String(args.entityId || ctx.context.entityIds?.[0] || IDS.shipment));
      const origin = entityId === IDS.supplier ? IDS.supplier : entityId === IDS.opportunity ? IDS.opportunity : IDS.shipment;
      const model = buildCausalExplorer(ctx.db, origin === IDS.opportunity ? IDS.supplier : IDS.supplier);
      const impact =
        origin === IDS.opportunity ? impactFromDeal(ctx.db) : calculateGraphImpact(ctx.db, origin === IDS.supplier ? IDS.shipment : origin);
      const path = model.columns.flatMap((column) => column.nodes.map((node) => node.label));
      const warningId = args.warningId ? String(args.warningId) : undefined;
      const explanation = warningId ? WarningExplanationService.for(ctx.db).explain(warningId, ctx.now) : null;
      return ok(
        ctx,
        "explain_risk",
        {
          path,
          dependencyPath: "Atlas Supply → SH-204 → RK-7 → Orders A/B/C",
          orders: "affected_orders" in impact ? impact.affected_orders.length : 1,
          customers: "affected_customers" in impact ? impact.affected_customers.length : 1,
          associatedRevenue: "associated_revenue" in impact ? impact.associated_revenue : impact.revenueAssociated,
          expectedCash: "affected_expected_cash" in impact ? impact.affected_expected_cash : impact.revenueAssociated,
          currency: impact.currency,
          notALoss: true,
          headline: model.headline,
          warning: explanation?.warning || null,
        },
        {
          evidence: [
            {
              statement: "notes" in impact ? impact.notes : "Graph impact for this object.",
              sourceSystem: "IMPACT",
              sourceId: origin,
            },
            { statement: model.subhead, sourceSystem: "GRAPH", sourceId: IDS.supplier },
          ],
          links: [
            { href: "/explore", label: "View impact" },
            { href: `/impact/${IDS.excDelay}`, label: "Open cascade" },
          ],
        },
      );
    },
  },

  get_evidence: {
    schema: {
      name: "get_evidence",
      description: "Return structured provenance for a business object. Read only.",
      permission: "READ",
      parameters: {
        objectId: { type: "string", required: true, description: "Business object id" },
      },
    },
    execute(args, ctx) {
      const objectId = String(args.objectId || "");
      if (!objectId) return fail(ctx, "get_evidence", "objectId is required");
      const events = eventsFor(ctx.db).list({ entity_id: objectId, limit: 40 });
      const exception = one<ExceptionRow>(ctx.db, "SELECT * FROM exceptions WHERE id = ?", [objectId]);
      const action = one<ActionRow>(ctx.db, "SELECT * FROM actions WHERE id = ?", [objectId]);
      return ok(
        ctx,
        "get_evidence",
        {
          objectId,
          events: events.map((event) => ({
            id: event.id,
            type: event.type,
            occurredAt: event.occurred_at,
            payload: event.payload,
          })),
          exception: exception ? { id: exception.id, title: exception.title, evidence: exception.evidence_json } : null,
          action: action ? { id: action.id, title: action.title, policy: action.policy_reason } : null,
        },
        {
          evidence: events.slice(0, 6).map((event) => ({
            statement: describeEvent(event.type, event.payload),
            sourceSystem: "EVENTS",
            sourceId: event.id,
            timestamp: event.occurred_at,
          })),
        },
      );
    },
  },

  simulate_change: {
    schema: {
      name: "simulate_change",
      description: "Run the Simulation engine. MUST NOT mutate live business state.",
      permission: "READ",
      parameters: {
        entity: { type: "string", description: "Supplier, shipment, or entity id" },
        change: { type: "string", description: "supplier_delay" },
        days: { type: "number", description: "Additional delay days" },
      },
    },
    execute(args, ctx) {
      const days = Number(args.days || 3);
      const targetId = resolveEntityId(String(args.entity || IDS.shipment));
      const before = getMeta(ctx.db, "supplier_phase", "stable");
      const result = runSimulation(ctx.db, { type: "supplier_delay", targetId: targetId === IDS.supplier ? IDS.shipment : targetId, days });
      const after = getMeta(ctx.db, "supplier_phase", "stable");
      return ok(
        ctx,
        "simulate_change",
        {
          label: "SIMULATION — NOT REAL BUSINESS STATE",
          baseline: result.baseline,
          simulated: result.simulated,
          delta: result.delta,
          assumptions: ["The scenario clones graph state. It does not write the live company."],
          isolation: result.isolation,
          realityUnchanged: result.isolation.unchanged && before === after,
          days,
          targetId,
        },
        {
          evidence: [
            {
              statement: `Simulation only. Fingerprint unchanged: ${String(result.isolation.unchanged)}.`,
              sourceSystem: "SIMULATION",
              sourceId: targetId,
            },
          ],
          links: [{ href: "/simulate", label: "Open simulation" }],
        },
      );
    },
  },

  create_goal: {
    schema: {
      name: "create_goal",
      description: "Create a Goal. Does not execute actions.",
      permission: "PREPARE",
      parameters: {
        utterance: { type: "string", description: "Goal wording" },
        idempotencyKey: { type: "string", description: "Retry key" },
      },
    },
    execute(args, ctx) {
      const utterance = String(args.utterance || ctx.command || "Protect everything at risk this week.");
      const created = createGoal(ctx.db, { utterance }, ctx.now, { plan: false });
      return ok(
        ctx,
        "create_goal",
        {
          goalId: created.goal.id,
          goalType: created.goal.goal_type,
          scope: created.goal.scope,
          executed: false,
        },
        {
          evidence: [{ statement: created.goal.objective || created.goal.name, sourceSystem: "GOALS", sourceId: created.goal.id }],
          links: [{ href: `/goals/${created.goal.id}`, label: "Open the goal" }],
        },
      );
    },
  },

  generate_plan: {
    schema: {
      name: "generate_plan",
      description: "Use the canonical Planner. Does not execute.",
      permission: "PREPARE",
      parameters: {
        goalId: { type: "string", description: "Goal to plan" },
        idempotencyKey: { type: "string", description: "Retry key" },
      },
    },
    execute(args, ctx) {
      const goalId = String(args.goalId || ctx.context.goalId || "");
      if (!goalId) return fail(ctx, "generate_plan", "goalId is required");
      const plan = buildPlan(ctx.db, goalId, ctx.now);
      const counts = plan.expectedImpact;
      return ok(
        ctx,
        "generate_plan",
        {
          goalId,
          planId: plan.id,
          total: counts.totalActions,
          safe: counts.autoActions,
          approval: counts.approvalRequiredActions,
          blocked: counts.blockedActions,
          executed: false,
          actions: plan.actions.map((action) => ({
            id: action.id,
            title: action.title,
            policy: action.policyDecision,
          })),
        },
        {
          evidence: plan.actions.slice(0, 8).map((action) => ({
            statement: `${action.title} · ${action.policyDecision}`,
            sourceSystem: "PLANNER",
            sourceId: action.id,
          })),
          requiresApproval: counts.approvalRequiredActions > 0,
          links: [{ href: `/goals/${goalId}`, label: "Open the plan" }],
        },
      );
    },
  },

  evaluate_plan: {
    schema: {
      name: "evaluate_plan",
      description: "Run Policy + Autopilot classification. Does not bypass policy.",
      permission: "READ",
      parameters: {
        planId: { type: "string", description: "Plan id" },
      },
    },
    execute(args, ctx) {
      const planId = String(args.planId || ctx.context.planId || latestPlanId(ctx.db) || "");
      if (!planId) return fail(ctx, "evaluate_plan", "planId is required");
      const actions = all<ActionRow>(ctx.db, "SELECT * FROM actions WHERE plan_id = ? ORDER BY priority, created_at", [planId]).map(
        (action) => recheckActionPolicy(ctx.db, action),
      );
      const grouped = groupActions(actions);
      const outcome = grouped.blocked.length
        ? "BLOCKED"
        : grouped.approval.length
          ? "APPROVAL_REQUIRED"
          : grouped.auto.length
            ? "AUTO"
            : "NEEDS_YOU";
      const policies = loadPolicies(ctx.db);
      return ok(
        ctx,
        "evaluate_plan",
        {
          planId,
          classification: outcome,
          AUTO: grouped.auto.map(briefAction),
          APPROVAL_REQUIRED: grouped.approval.map(briefAction),
          BLOCKED: grouped.blocked.map(briefAction),
          NEEDS_YOU: [],
          safe: grouped.auto.length,
          approval: grouped.approval.length,
          blocked: grouped.blocked.length,
          discountMax: policies.discount_max,
        },
        {
          policy: { outcome, rechecked: true, discountMax: policies.discount_max },
          requiresApproval: grouped.approval.length > 0,
          evidence: [
            {
              statement: `${grouped.auto.length} AUTO · ${grouped.approval.length} approval · ${grouped.blocked.length} blocked`,
              sourceSystem: "POLICY",
              sourceId: planId,
            },
          ],
        },
      );
    },
  },

  get_safe_actions: {
    schema: {
      name: "get_safe_actions",
      description: "Return current AUTO-eligible actions after a live policy recheck.",
      permission: "READ",
      parameters: {},
    },
    execute(_args, ctx) {
      const actions = all<ActionRow>(ctx.db, "SELECT * FROM actions WHERE status != 'executed'").map((action) =>
        recheckActionPolicy(ctx.db, action),
      );
      const grouped = groupActions(actions);
      const policies = loadPolicies(ctx.db);
      return ok(
        ctx,
        "get_safe_actions",
        {
          safe: grouped.auto.map(briefAction),
          approval: grouped.approval.map(briefAction),
          blocked: grouped.blocked.map(briefAction),
          discountMax: policies.discount_max,
        },
        {
          policy: { outcome: grouped.blocked.length ? "BLOCKED" : grouped.auto.length ? "AUTO" : "APPROVAL_REQUIRED", discountMax: policies.discount_max },
          evidence: grouped.blocked.map((action) => ({
            statement: action.policy_reason,
            sourceSystem: "POLICY",
            sourceId: action.id,
          })),
        },
      );
    },
  },

  execute_safe_actions: {
    schema: {
      name: "execute_safe_actions",
      description: "Recheck policy, then execute AUTO actions only. Never approval-required or blocked.",
      permission: "EXECUTE_SAFE",
      parameters: {
        planId: { type: "string", description: "Optional plan scope" },
        idempotencyKey: { type: "string", description: "Retry key" },
      },
    },
    execute(args, ctx) {
      const planId = args.planId ? String(args.planId) : ctx.context.planId;
      if (planId) {
        const result = executeSafeActions(ctx.db, planId, ctx.now, "agent");
        return ok(
          ctx,
          "execute_safe_actions",
          {
            executed: result.executed,
            waiting: result.pendingApproval,
            blocked: result.blocked,
            counts: result.counts,
            planId,
          },
          {
            status: result.pendingApproval.length ? "approval_required" : "ok",
            requiresApproval: result.pendingApproval.length > 0,
            policy: { outcome: result.pendingApproval.length ? "APPROVAL_REQUIRED" : "AUTO", rechecked: true },
            evidence: [
              { statement: `${result.executed.length} AUTO actions executed after a live policy recheck.`, sourceSystem: "AUTOPILOT" },
              { statement: `${result.pendingApproval.length} still require approval.`, sourceSystem: "POLICY" },
            ],
            links: [{ href: "/goals", label: "Open goals" }],
          },
        );
      }
      const after = ExceptionAutopilotService.for(ctx.db).handleSafe(ctx.now);
      return ok(
        ctx,
        "execute_safe_actions",
        {
          executed: after.handleSafe.executed,
          waiting: after.handleSafe.pendingApproval,
          blocked: after.handleSafe.blocked,
          counts: after.handleSafe.counts,
        },
        {
          status: after.handleSafe.pendingApproval.length ? "approval_required" : "ok",
          requiresApproval: after.handleSafe.pendingApproval.length > 0,
          policy: { outcome: after.handleSafe.pendingApproval.length ? "APPROVAL_REQUIRED" : "AUTO", rechecked: true },
          evidence: [
            { statement: `${after.handleSafe.executed.length} AUTO actions executed after a live policy recheck.`, sourceSystem: "AUTOPILOT" },
          ],
        },
      );
    },
  },

  request_action_approval: {
    schema: {
      name: "request_action_approval",
      description: "Create or return a canonical approval requirement. Does not self-approve.",
      permission: "HUMAN_REQUIRED",
      parameters: {
        actionIds: { type: "string", description: "Optional action ids" },
        planId: { type: "string", description: "Optional plan scope" },
        idempotencyKey: { type: "string", description: "Retry key" },
      },
    },
    execute(args, ctx) {
      const planId = args.planId ? String(args.planId) : ctx.context.planId;
      const requested = Array.isArray(args.actionIds) ? args.actionIds.map(String) : [];
      const pending = all<ActionRow>(
        ctx.db,
        planId
          ? "SELECT * FROM actions WHERE plan_id = ? AND policy_outcome = 'APPROVAL_REQUIRED' AND status != 'executed'"
          : "SELECT * FROM actions WHERE policy_outcome = 'APPROVAL_REQUIRED' AND status != 'executed'",
        planId ? [planId] : [],
      )
        .map((action) => recheckActionPolicy(ctx.db, action))
        .filter((action) => action.policy_outcome === "APPROVAL_REQUIRED")
        .filter((action) => requested.length === 0 || requested.includes(action.id));
      return ok(
        ctx,
        "request_action_approval",
        {
          approvals: pending.map((action) => ({
            actionId: action.id,
            planId: action.plan_id,
            title: action.title,
            why: action.description || action.policy_reason,
            policy: action.policy_reason,
            impact: action.title,
          })),
          selfApproved: false,
        },
        {
          status: "approval_required",
          requiresApproval: pending.length > 0,
          policy: { outcome: "APPROVAL_REQUIRED", rechecked: true },
          evidence: pending.map((action) => ({
            statement: action.policy_reason,
            sourceSystem: "POLICY",
            sourceId: action.id,
          })),
        },
      );
    },
  },

  approve_action: {
    schema: {
      name: "approve_action",
      description: "Forbidden to the model. Human authorization only.",
      permission: "FORBIDDEN_TO_AGENT",
      parameters: {
        actionId: { type: "string", required: true, description: "Action to approve" },
      },
    },
    execute(_args, ctx) {
      return ok(
        ctx,
        "approve_action",
        { forbidden: true },
        {
          status: "forbidden",
          error: "approve_action is not a model tool. A human must authorize the action.",
        },
      );
    },
  },

  get_verification: {
    schema: {
      name: "get_verification",
      description: "Return PENDING, SUCCESS, or FAILED. The model cannot declare HANDLED.",
      permission: "READ",
      parameters: {
        actionId: { type: "string", description: "Action id" },
        exceptionId: { type: "string", description: "Exception id" },
        verificationId: { type: "string", description: "Verification id" },
      },
    },
    execute(args, ctx) {
      const service = VerificationService.for(ctx.db);
      const verificationId = args.verificationId ? String(args.verificationId) : "";
      const actionId = args.actionId ? String(args.actionId) : "";
      const exceptionId = String(args.exceptionId || ctx.context.exceptionId || "");
      let rows = all<{ id: string; status: string; action_id: string; exception_id: string; expected_event_type: string }>(
        ctx.db,
        "SELECT id, status, action_id, exception_id, expected_event_type FROM verifications ORDER BY created_at DESC LIMIT 20",
      );
      if (verificationId) rows = rows.filter((row) => row.id === verificationId);
      if (actionId) rows = rows.filter((row) => row.action_id === actionId);
      if (exceptionId) rows = rows.filter((row) => row.exception_id === exceptionId);
      void service;
      return ok(
        ctx,
        "get_verification",
        {
          items: rows.map((row) => ({
            id: row.id,
            status: row.status,
            actionId: row.action_id,
            exceptionId: row.exception_id,
            expected: row.expected_event_type,
          })),
          pending: rows.filter((row) => row.status === "PENDING").length,
          success: rows.filter((row) => row.status === "SUCCESS").length,
          failed: rows.filter((row) => row.status === "FAILED").length,
          handledDeclaredByModel: false,
        },
        {
          evidence: rows.slice(0, 4).map((row) => ({
            statement: `${row.id}: ${row.status}`,
            sourceSystem: "VERIFICATION",
            sourceId: row.id,
          })),
        },
      );
    },
  },

  get_historical_cases: {
    schema: {
      name: "get_historical_cases",
      description: "Outcome / Learning / Strategy Memory with sample size and evidence. Never fabricate rates.",
      permission: "READ",
      parameters: {
        context: { type: "string", description: "Optional learning context" },
      },
    },
    execute(_args, ctx) {
      const exception = one<ExceptionRow>(ctx.db, "SELECT * FROM exceptions WHERE id = ?", [IDS.excMissed]);
      const context = exception ? contextFromException(exception) : "followup";
      const bundle = StrategyMemory.for(ctx.db).getStrategyEvidence(context);
      const observations = bundle.strategies.reduce((sum, item) => sum + item.observations, 0);
      return ok(
        ctx,
        "get_historical_cases",
        {
          observations,
          successes: bundle.strategies.reduce((sum, item) => sum + item.successes, 0),
          failures: bundle.strategies.reduce((sum, item) => sum + item.failures, 0),
          strongest: bundle.historically_stronger_strategy?.wording || null,
          strategies: bundle.strategies.map((item) => ({
            strategy: item.strategy,
            observations: item.observations,
            successes: item.successes,
            evidence: item.evidence,
          })),
          note: bundle.note,
          fabricated: false,
        },
        {
          evidence: bundle.strategies.map((item) => ({
            statement: item.evidence,
            sourceSystem: "LEARNING",
            sourceId: item.strategy,
          })),
        },
      );
    },
  },

  get_policy: {
    schema: {
      name: "get_policy",
      description: "Inspect policy. The agent may not change policy.",
      permission: "READ",
      parameters: {},
    },
    execute(_args, ctx) {
      const policies = loadPolicies(ctx.db);
      return ok(
        ctx,
        "get_policy",
        { policies, discountMax: policies.discount_max, mutableByAgent: false },
        {
          policy: { discountMax: policies.discount_max },
          evidence: [{ statement: `discount_max=${policies.discount_max || "5"}%`, sourceSystem: "POLICY" }],
        },
      );
    },
  },

  get_autopilot_trace: {
    schema: {
      name: "get_autopilot_trace",
      description: "Observed → Detected → Impact → Plan → Policy → Action → Verification → Outcome. No hidden reasoning.",
      permission: "READ",
      parameters: {
        decisionId: { type: "string", description: "Autopilot decision id" },
      },
    },
    execute(args, ctx) {
      const service = ExceptionAutopilotService.for(ctx.db);
      const decisionId = String(args.decisionId || service.listDecisions()[0]?.id || "");
      const trace = decisionId ? service.explain(decisionId) : null;
      const twin = businessTwin(ctx.db);
      return ok(
        ctx,
        "get_autopilot_trace",
        {
          observed: trace?.observed || twin.domains[0]?.headline || "A business event was recorded.",
          detected: trace?.detected || "Detect classified the situation from stored state.",
          impact: trace?.impact || "Impact comes from the graph.",
          plan: trace?.plan || "Planner output, if any.",
          policy: trace?.policy || "Policy evaluated at execution time.",
          action: trace?.autopilot || "Autopilot classified; it did not invent HANDLED.",
          verification: "Verification owns SUCCESS / FAILED / PENDING.",
          outcome: trace?.current || "current",
        },
        {
          evidence: trace
            ? [
                { statement: trace.observed, sourceSystem: "AUTOPILOT", sourceId: decisionId },
                { statement: trace.policy, sourceSystem: "POLICY", sourceId: decisionId },
              ]
            : [],
        },
      );
    },
  },

  mutate_policy: forbiddenTool("mutate_policy", "Policy mutation is forbidden to the agent."),
  mutate_permissions: forbiddenTool("mutate_permissions", "Permission mutation is forbidden to the agent."),
  execute_sql: forbiddenTool("execute_sql", "Unrestricted database access is forbidden."),
  shell: forbiddenTool("shell", "Shell access is forbidden. This is a business operating agent."),
  write_file: forbiddenTool("write_file", "Filesystem mutation is forbidden."),
  delete_records: forbiddenTool("delete_records", "Deletion is forbidden to the agent."),
};

function forbiddenTool(name: string, message: string): ToolDefinition {
  return {
    schema: {
      name,
      description: message,
      permission: "FORBIDDEN_TO_AGENT",
      parameters: {},
    },
    execute(_args, ctx) {
      return ok(ctx, name, { forbidden: true }, { status: "forbidden", error: message });
    },
  };
}

export function listBusinessToolSchemas(): ToolSchema[] {
  return Object.values(TOOL_DEFINITIONS)
    .map((item) => item.schema)
    .filter((schema) => schema.permission !== "FORBIDDEN_TO_AGENT" && schema.name !== "approve_action");
}

export function getToolPermission(name: string): ToolPermission {
  return TOOL_DEFINITIONS[name]?.schema.permission || "FORBIDDEN_TO_AGENT";
}

export function toolResultContract(result: ToolResult): ToolResult {
  return {
    toolCallId: result.toolCallId,
    tool: result.tool,
    status: result.status,
    data: result.data || {},
    evidence: result.evidence || [],
    policy: result.policy || null,
    requiresApproval: Boolean(result.requiresApproval),
    links: result.links || [],
    generatedAt: result.generatedAt,
    error: result.error,
  };
}

function briefAttention(item: { id: string; classification: string; title: string; needsFromYou?: string; reasonCode?: string; sourceExceptionId?: string | null; sourceWarningId?: string | null }) {
  return {
    kind: item.classification,
    id: item.sourceExceptionId || item.sourceWarningId || item.id,
    title: item.title,
    detail: item.needsFromYou,
    reasonCode: item.reasonCode,
    situationId: item.id,
  };
}

function briefAction(action: ActionRow) {
  return { id: action.id, title: action.title, type: action.type, reason: action.policy_reason, planId: action.plan_id };
}

function groupActions(actions: ActionRow[]) {
  return {
    auto: actions.filter((action) => action.policy_outcome === "AUTO"),
    approval: actions.filter((action) => action.policy_outcome === "APPROVAL_REQUIRED"),
    blocked: actions.filter((action) => action.policy_outcome === "BLOCKED"),
  };
}

function latestPlanId(db: DatabaseSync): string | undefined {
  return one<PlanRow>(db, "SELECT * FROM plans ORDER BY created_at DESC LIMIT 1")?.id;
}

function impactFromDeal(db: DatabaseSync) {
  return calculateImpact(db, IDS.opportunity);
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

export { hydratePlan, executeAction, evaluatePolicy, loadPolicies, recheckActionPolicy, getGoalBundle };
