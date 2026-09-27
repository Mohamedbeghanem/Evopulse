import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { evaluatePolicy, loadPolicies } from "../engine/policy";
import { id } from "../ids";
import { IDS } from "../ids";
import type { ActionRow, GoalRow, PlanRow } from "../types";
import { assertCatalogAction } from "./catalog";
import { buildGoalContext } from "./context";
import type {
  ActionEvidence,
  CandidateAction,
  ClassifiedAction,
  GoalContext,
  PlanSummary,
  RankedRisk,
  RiskDomain,
  StructuredPlan,
} from "./types";

export function generateCandidateActions(context: GoalContext): CandidateAction[] {
  const actions: CandidateAction[] = [];
  for (const risk of context.risks) {
    if (risk.domain === "sales" || risk.kind === "commitment_missed") {
      actions.push(...salesActions(risk, context));
    }
    if (risk.domain === "operations" || risk.kind === "shipment_delay" || risk.kind === "delivery_delay") {
      actions.push(...operationsActions(risk));
    }
    if (risk.domain === "cash" || risk.kind === "cash_timing_shift") {
      actions.push(...cashActions(risk));
    }
  }
  if (context.earlyWarnings.length) {
    const warning = context.earlyWarnings[0];
    actions.push(
      candidate({
        type: "monitor",
        domain: "operations",
        targetType: "shipment",
        targetId: IDS.shipment,
        title: "Monitor revised shipment",
        description:
          "Watch the upstream arrival against the customer delivery buffer. The deadline has not failed yet.",
        parameters: {
          warningId: warning.id,
          expectationId: warning.expectationId,
          availableBufferMinutes: warning.availableBufferMinutes,
          requiredBufferMinutes: warning.requiredBufferMinutes,
        },
        reason:
          "An early warning is active. Monitoring the revised shipment is preventive — Detect still owns any later miss.",
        evidence: {
          kind: "CALCULATED_IMPACT",
          reason: `${warning.title} is ${warning.bufferState} under current timing assumptions.`,
          sourceEntityIds: [IDS.shipment, IDS.orderA, IDS.commitDeliverA],
          path: ["Atlas Supply", "Shipment SH-204", "Order A — Oran Fresh", "Customer delivery"],
        },
        priority: 22,
        risk: "low",
        relatedExceptionId: "",
        relatedRiskId: warning.id,
      }),
    );
  }
  return actions;
}

function salesActions(risk: RankedRisk, context: GoalContext): CandidateAction[] {
  const historical = context.strategyEvidence;
  const followUpEvidence: ActionEvidence = {
    kind: historical ? "HISTORICAL_EVIDENCE" : "OBSERVED_FACT",
    reason: "Proposal commitment was missed. Customer decision is blocked until a revised proposal and a follow-up exist.",
    sourceExceptionId: risk.exceptionId,
    sourceEntityIds: [IDS.opportunity, IDS.contact],
    quote: risk.evidence.quote,
    path: risk.evidence.path.length ? risk.evidence.path : ["Atlas Q4 opportunity", "Amine Khelifi"],
    associatedValue: risk.associatedValue,
    historicalEvidence: historical,
  };
  return [
    candidate({
      type: "prepare_proposal",
      domain: "sales",
      targetType: "opportunity",
      targetId: IDS.opportunity,
      title: "Prepare revised proposal",
      description: "Assemble the revised proposal for the stalled opportunity so the customer can decide.",
      parameters: { document: "proposal_v2", amount: risk.associatedValue, currency: risk.currency, strategy: "personalized_followup" },
      reason: "The company missed its send commitment. Recovery starts by preparing the document that unblocks the decision.",
      evidence: { ...followUpEvidence, kind: "OBSERVED_FACT" },
      priority: 10,
      risk: "medium",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "draft_message",
      domain: "sales",
      targetType: "contact",
      targetId: IDS.contact,
      title: "Prepare personalized customer follow-up",
      description:
        historical?.historically_stronger_strategy?.wording ||
        "Draft a precise follow-up that names the missed send and the revised amount.",
      parameters: {
        to: "Amine Khelifi",
        subject: "Revised proposal is ready",
        strategy: "personalized_followup",
        body: "The revised proposal is ready. We missed the Thursday send. Your decision is still yours this week.",
      },
      reason: historical?.historically_stronger_strategy
        ? `${historical.historically_stronger_strategy.wording} Historical evidence does not override policy.`
        : "A missed commitment needs a human-approved customer follow-up.",
      evidence: followUpEvidence,
      priority: 20,
      risk: "medium",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "apply_discount",
      domain: "sales",
      targetType: "opportunity",
      targetId: IDS.opportunity,
      title: "Consider 10% commercial concession",
      description: "A 10% discount is a candidate commercial close. Policy must decide.",
      parameters: { percent: 10, amount: risk.associatedValue },
      reason: "Commercial pressure on a stalled opportunity. The planner proposes it as a candidate; policy governs.",
      evidence: { ...followUpEvidence, kind: "OBSERVED_FACT" },
      priority: 80,
      risk: "high",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "apply_discount",
      domain: "sales",
      targetType: "opportunity",
      targetId: IDS.opportunity,
      title: "Alternative — offer 5% (policy max)",
      description: "Policy-safe commercial alternative if a concession is required.",
      parameters: { percent: 5, amount: Math.round(risk.associatedValue * 0.95) },
      reason: "If a discount is needed, the planner may propose the policy ceiling. It cannot silently raise the ceiling.",
      evidence: { ...followUpEvidence, kind: "OBSERVED_FACT" },
      priority: 85,
      risk: "medium",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "offer_alternative",
      domain: "sales",
      targetType: "opportunity",
      targetId: IDS.opportunity,
      title: "Non-financial recovery — Net-14",
      description: "Keep list price and offer faster payment terms instead of an unauthorized discount.",
      parameters: { terms: "net-14", expediteDays: 7 },
      reason: "A blocked discount should surface a non-financial alternative, not a silent policy change.",
      evidence: { ...followUpEvidence, kind: "OBSERVED_FACT" },
      priority: 86,
      risk: "low",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
  ];
}

function operationsActions(risk: RankedRisk): CandidateAction[] {
  const path = risk.evidence.path.length
    ? risk.evidence.path
    : ["Atlas Supply", "Shipment SH-204", "RK-7 kit", "Order A", "Oran Fresh"];
  const base: ActionEvidence = {
    kind: "OBSERVED_FACT",
    reason: "Upstream shipment delayed +2 days. Downstream orders and customers are already on the graph.",
    sourceExceptionId: risk.exceptionId,
    sourceEntityIds: [IDS.shipment, IDS.orderA, IDS.orderB, IDS.orderC],
    quote: risk.evidence.quote,
    path,
    associatedValue: risk.associatedValue,
  };
  return [
    candidate({
      type: "create_task",
      domain: "operations",
      targetType: "shipment",
      targetId: IDS.shipment,
      title: "Review affected orders",
      description: `Inspect the ${risk.affectedOrders} orders sitting downstream of SH-204.`,
      parameters: { shipmentId: IDS.shipment, orderIds: [IDS.orderA, IDS.orderB, IDS.orderC] },
      reason: "A delayed inbound shipment requires an explicit review of every dependent order.",
      evidence: { ...base, kind: "CALCULATED_IMPACT" },
      priority: 15,
      risk: "medium",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "prioritize_order",
      domain: "operations",
      targetType: "order",
      targetId: IDS.orderA,
      title: "Prioritize highest-risk customer order",
      description: "Order A has the nearest customer commitment among the affected orders.",
      parameters: { orderId: IDS.orderA, reason: "earliest_customer_deadline" },
      reason: "Shipment SH-204 is delayed. Order A depends on that shipment and has the earliest customer deadline.",
      evidence: {
        ...base,
        reason: "Shipment SH-204 is delayed +2 days. Order A depends on that shipment. Its customer deadline is earliest among affected orders.",
      },
      priority: 16,
      risk: "high",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "prepare_customer_notice",
      domain: "operations",
      targetType: "customer",
      targetId: IDS.customerA,
      title: "Prepare customer delay communication",
      description: "Draft delay notices for the three affected customers. Sending still requires approval.",
      parameters: { customerIds: [IDS.customerA, IDS.customerB, IDS.customerC], delayDays: 2 },
      reason: "Customers waiting on delayed orders need a prepared notice before any external send.",
      evidence: base,
      priority: 25,
      risk: "medium",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "draft_message",
      domain: "operations",
      targetType: "customer",
      targetId: IDS.customerA,
      title: "Draft delay notice for Order A",
      description: "External customer message about the SH-204 delay. Policy gates the send.",
      parameters: {
        to: "Oran Fresh",
        subject: "Delivery update — Order A",
        body: "SH-204 is two days late. Order A is the first delivery we will protect.",
        audience: "customer",
      },
      reason: "Prepared notices still need a policy-classified external draft before anyone hits send.",
      evidence: base,
      priority: 30,
      risk: "medium",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
  ];
}

function cashActions(risk: RankedRisk): CandidateAction[] {
  const evidence: ActionEvidence = {
    kind: "CALCULATED_IMPACT",
    reason: "Invoice amounts tied to delayed orders move expected cash later in the week.",
    sourceExceptionId: risk.exceptionId,
    sourceEntityIds: [IDS.cashWeek, IDS.invoiceA, IDS.invoiceB, IDS.invoiceC],
    quote: risk.evidence.quote,
    path: risk.evidence.path,
    associatedValue: risk.associatedValue,
  };
  return [
    candidate({
      type: "update_expectation",
      domain: "cash",
      targetType: "expectation",
      targetId: IDS.expectCash,
      title: "Update expected payment timing where justified",
      description: "Shift the cash-week expectation to match the delayed deliveries.",
      parameters: { expectationId: IDS.expectCash, status: "AT_RISK" },
      reason: "Cash timing is a calculated consequence of the delay, not a separate guess.",
      evidence,
      priority: 40,
      risk: "medium",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
    candidate({
      type: "monitor",
      domain: "cash",
      targetType: "cash_window",
      targetId: IDS.cashWeek,
      title: "Create finance monitoring checkpoint",
      description: "Watch expected cash through the delayed invoice window.",
      parameters: { cashWindowId: IDS.cashWeek },
      reason: "A timing shift needs a checkpoint, not a silent rewrite of the ledger.",
      evidence,
      priority: 45,
      risk: "low",
      relatedExceptionId: risk.exceptionId || "",
      relatedRiskId: risk.id,
    }),
  ];
}

function candidate(partial: Omit<CandidateAction, "confidence" | "dependencies"> & { confidence?: number; dependencies?: string[] }): CandidateAction {
  assertCatalogAction(partial.type);
  return {
    ...partial,
    confidence: partial.confidence ?? 0.86,
    dependencies: partial.dependencies ?? [],
  };
}

export function classifyActions(actions: CandidateAction[], policies: Record<string, string>): ClassifiedAction[] {
  return actions.map((action) => {
    assertCatalogAction(action.type);
    const decision = evaluatePolicy({ type: action.type, payload: action.parameters }, policies);
    return {
      ...action,
      policyDecision: decision.outcome,
      policyReason: decision.reason,
      requiresApproval: decision.outcome === "APPROVAL_REQUIRED",
    };
  });
}

export function summarizePlan(actions: ClassifiedAction[], risks: RankedRisk[]): PlanSummary {
  const domains = [...new Set(actions.map((a) => a.domain))];
  const salesOps = risks.filter((r) => r.domain === "sales" || r.domain === "operations");
  const cash = risks.filter((r) => r.domain === "cash");
  const associatedValueAddressed = salesOps.reduce((sum, risk) => sum + risk.associatedValue, 0);
  const cashTimingUnderAttention = cash.reduce((sum, risk) => sum + risk.associatedValue, 0);
  return {
    totalActions: actions.length,
    autoActions: actions.filter((a) => a.policyDecision === "AUTO").length,
    approvalRequiredActions: actions.filter((a) => a.policyDecision === "APPROVAL_REQUIRED").length,
    blockedActions: actions.filter((a) => a.policyDecision === "BLOCKED").length,
    affectedDomains: domains,
    associatedValueAddressed,
    valueUnderAttention: associatedValueAddressed,
    cashTimingUnderAttention,
    currency: risks[0]?.currency || "DZD",
  };
}

export function validatePlan(actions: ClassifiedAction[]) {
  for (const action of actions) {
    assertCatalogAction(action.type);
    if (!action.evidence || !action.evidence.reason) {
      throw new Error(`Action ${action.type} is missing evidence.`);
    }
  }
}

export function persistPlan(db: DatabaseSync, goalId: string, context: GoalContext, now: string): StructuredPlan {
  const existing = one<PlanRow>(db, "SELECT * FROM plans WHERE goal_id = ? ORDER BY created_at DESC", [goalId]);
  if (existing) return hydratePlan(db, existing.id);

  const candidates = generateCandidateActions(context);
  const classified = classifyActions(candidates, loadPolicies(db));
  validatePlan(classified);
  const expected = summarizePlan(classified, context.risks);
  const planId = id("pln");
  const summary = `${context.goal.objective} ${expected.totalActions} structured actions across ${expected.affectedDomains.join(", ")}.`;

  run(
    db,
    `INSERT INTO plans (id, exception_id, goal_id, title, summary, expected_impact, status, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planId,
      "",
      goalId,
      titleForGoal(context),
      summary,
      JSON.stringify(expected),
      "proposed",
      "planner-v1",
      now,
    ],
  );

  classified.forEach((action, index) => {
    const actionId = id("act");
    run(
      db,
      `INSERT INTO actions
        (id, exception_id, plan_id, type, title, description, payload, policy_outcome, policy_reason, status,
         evidence_json, created_at, domain, target_type, target_id, priority, risk, confidence, dependencies_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actionId,
        action.relatedExceptionId || "",
        planId,
        action.type,
        action.title,
        action.description,
        JSON.stringify({
          ...action.parameters,
          goalId,
          planId,
          reason: action.reason,
        }),
        action.policyDecision,
        action.policyReason,
        action.policyDecision === "BLOCKED" ? "blocked" : "proposed",
        JSON.stringify({
          ...action.evidence,
          goalId,
          planId,
          actionId,
        }),
        now,
        action.domain,
        action.targetType,
        action.targetId,
        action.priority || index,
        action.risk,
        action.confidence,
        JSON.stringify(action.dependencies),
      ],
    );
  });

  return hydratePlan(db, planId);
}

export function hydratePlan(db: DatabaseSync, planId: string): StructuredPlan {
  const plan = one<PlanRow>(db, "SELECT * FROM plans WHERE id = ?", [planId]);
  if (!plan) throw new Error("Plan not found");
  const rows = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ? ORDER BY priority, created_at", [planId]);
  const actions: ClassifiedAction[] = rows.map((row) => {
    const payload = safeJson(row.payload);
    const evidence = safeJson(row.evidence_json) as unknown as ClassifiedAction["evidence"];
    return {
      id: row.id,
      type: row.type,
      domain: (row.domain || "sales") as RiskDomain,
      targetType: row.target_type || "",
      targetId: row.target_id || "",
      title: row.title,
      description: row.description,
      parameters: payload,
      reason: String(payload.reason || row.description),
      evidence,
      priority: row.priority || 0,
      risk: row.risk || "medium",
      confidence: row.confidence || 0.8,
      dependencies: row.dependencies_json ? (JSON.parse(row.dependencies_json) as string[]) : [],
      relatedExceptionId: row.exception_id,
      relatedRiskId: "",
      policyDecision: row.policy_outcome,
      policyReason: row.policy_reason,
      requiresApproval: row.policy_outcome === "APPROVAL_REQUIRED",
    };
  });
  const expected = plan.expected_impact ? (JSON.parse(plan.expected_impact) as PlanSummary) : summarizePlan(actions, []);
  return {
    id: plan.id,
    goalId: plan.goal_id || "",
    status: plan.status,
    summary: plan.summary,
    expectedImpact: expected,
    actions,
    simulation: {
      evaluable: true,
      snapshotHint: {
        goalId: plan.goal_id || "",
        planId: plan.id,
        actionIds: actions.map((a) => a.id || ""),
        domains: expected.affectedDomains,
        associatedValue: expected.associatedValueAddressed,
      },
    },
  };
}

export function buildPlan(db: DatabaseSync, goalId: string, now: string): StructuredPlan {
  const goal = one<GoalRow>(db, "SELECT * FROM goals WHERE id = ?", [goalId]);
  if (!goal) throw new Error("Goal not found");
  const interpreted = {
    goalType: goal.goal_type as GoalContext["goal"]["goalType"],
    scope: goal.scope,
    objective: goal.objective || goal.name,
    metric: goal.metric,
    target: goal.target,
    deadline: goal.deadline,
    constraints: safeJson(goal.constraints),
    source: "structured" as const,
  };
  const context = buildGoalContext(db, interpreted, goalId);
  return persistPlan(db, goalId, context, now);
}

function titleForGoal(context: GoalContext): string {
  if (context.goal.goalType === "protect_cash") return "Protect this period's cash";
  if (context.goal.goalType === "recover_opportunities") return "Recover stalled opportunities";
  if (context.goal.goalType === "protect_revenue") return "Protect revenue at risk";
  return "Protect this week's business";
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
