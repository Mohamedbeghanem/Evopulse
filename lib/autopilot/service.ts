import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { calculateGraphImpact } from "../engine/impact";
import { evaluatePolicy, loadPolicies } from "../engine/policy";
import { buildRecoveryPlan } from "../engine/recovery";
import { executeAction } from "../engine/execute";
import { IDS } from "../ids";
import type { ActionRow, ExceptionRow, PlanRow } from "../types";
import { EarlyWarningEngine, type WarningRow } from "../warnings";
import { classifySituation } from "./classify";
import type {
  AutopilotCard,
  AutopilotDecisionRow,
  AutopilotReasonCode,
  AutopilotState,
  AutopilotSummary,
  AutopilotTrace,
  ClassifyResult,
} from "./types";

const ATTENTION_STATES = new Set<AutopilotState>([
  "MONITORING",
  "PREPARED",
  "AUTO_HANDLED",
  "NEEDS_APPROVAL",
  "NEEDS_YOU",
  "BLOCKED",
  "HANDLED",
]);

export class ExceptionAutopilotService {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new ExceptionAutopilotService(db);
  }

  evaluateSituation(
    now: string,
    options: { handleSafe?: boolean } = {},
  ): { decisions: AutopilotDecisionRow[]; cards: AutopilotCard[]; summary: AutopilotSummary } {
    const { detectExceptions } = require("../engine/pulse") as typeof import("../engine/pulse");
    detectExceptions(this.db, now);
    const warningEngine = EarlyWarningEngine.for(this.db);
    for (const warning of warningEngine.getActiveWarnings()) {
      if (!warning.expectation_id) continue;
      const due = one<{ due_at: string }>(this.db, "SELECT due_at FROM expectations WHERE id = ?", [
        warning.expectation_id,
      ]);
      if (due && new Date(due.due_at).getTime() < new Date(now).getTime()) {
        warningEngine.escalateToException(warning.expectation_id, now);
      }
    }

    const exceptions = all<ExceptionRow>(this.db, "SELECT * FROM exceptions");
    for (const exception of exceptions) {
      if (exception.status === "resolved") continue;
      if (exception.id === IDS.excMissed || exception.id === IDS.excDiscount) {
        const existing = one<PlanRow>(this.db, "SELECT * FROM plans WHERE exception_id = ?", [exception.id]);
        if (!existing) buildRecoveryPlan(this.db, exception.id, now);
      }
    }

    const cards: AutopilotCard[] = [];
    for (const exception of exceptions) {
      const card = this.recordExceptionDecision(exception, now);
      if (card) cards.push(card);
    }

    const coveredExpectations = new Set(
      exceptions
        .map((row) => row.expectation_id)
        .filter((id): id is string => Boolean(id)),
    );
    for (const warning of warningEngine.getActiveWarnings()) {
      if (warning.expectation_id && coveredExpectations.has(warning.expectation_id)) continue;
      const card = this.recordWarningDecision(warning, now);
      if (card) cards.push(card);
    }

    if (options.handleSafe) {
      this.executeSafeActions(now);
      return this.evaluateSituation(now, { handleSafe: false });
    }

    return {
      decisions: this.listDecisions(),
      cards: cards.filter((card) => card.classification !== "NORMAL"),
      summary: this.summarize(now),
    };
  }

  evaluateAll(now: string) {
    return this.evaluateSituation(now);
  }

  reEvaluate(now: string) {
    return this.evaluateSituation(now);
  }

  handleSafe(now: string) {
    this.evaluateSituation(now);
    const result = this.executeSafeActions(now);
    const after = this.evaluateSituation(now);
    return { ...after, handleSafe: result };
  }

  executeSafeActions(now: string) {
    const policies = loadPolicies(this.db);
    const actions = all<ActionRow>(this.db, "SELECT * FROM actions ORDER BY created_at");
    const executed: string[] = [];
    const held: string[] = [];
    const blocked: string[] = [];
    const seen = new Set<string>();

    for (const action of actions) {
      if (seen.has(action.id)) continue;
      seen.add(action.id);
      const payload = safeJson(action.payload);
      const current = evaluatePolicy({ type: action.type, payload }, policies);
      if (current.outcome !== action.policy_outcome || current.reason !== action.policy_reason) {
        run(this.db, "UPDATE actions SET policy_outcome = ?, policy_reason = ? WHERE id = ?", [
          current.outcome,
          current.reason,
          action.id,
        ]);
      }
      const outcome = current.outcome;
      if (outcome === "BLOCKED") {
        blocked.push(action.id);
        continue;
      }
      if (outcome === "APPROVAL_REQUIRED") {
        held.push(action.id);
        continue;
      }
      if (action.status === "executed") continue;
      if (outcome !== "AUTO") continue;
      executeAction(this.db, action.id, now);
      executed.push(action.id);
      this.upsertDecision({
        situationType: "action",
        situationId: action.id,
        classification: "AUTO_HANDLED",
        reasonCode: "SAFE_INTERNAL_ACTION",
        exceptionId: action.exception_id,
        planId: action.plan_id,
        actionId: action.id,
        policyDecision: "AUTO",
        now,
        impact: {},
        evidence: { action: action.type, title: action.title },
      });
    }

    return {
      executed,
      pendingApproval: held,
      blocked,
      counts: { executed: executed.length, waitingForApproval: held.length, blocked: blocked.length },
    };
  }

  classify() {
    return this.listDecisions().map((row) => this.toCard(row));
  }

  get(id: string): AutopilotDecisionRow | undefined {
    return one<AutopilotDecisionRow>(this.db, "SELECT * FROM autopilot_decisions WHERE id = ?", [id]);
  }

  listDecisions(classification?: AutopilotState): AutopilotDecisionRow[] {
    if (classification) {
      return all<AutopilotDecisionRow>(
        this.db,
        "SELECT * FROM autopilot_decisions WHERE classification = ? ORDER BY updated_at DESC",
        [classification],
      );
    }
    return all<AutopilotDecisionRow>(this.db, "SELECT * FROM autopilot_decisions ORDER BY updated_at DESC");
  }

  activeCards(): AutopilotCard[] {
    return this.listDecisions()
      .filter((row) => ATTENTION_STATES.has(row.classification) && row.situation_type !== "action")
      .map((row) => this.toCard(row));
  }

  summarize(now?: string): AutopilotSummary {
    const eventsProcessed = all<{ c: number }>(this.db, "SELECT COUNT(*) as c FROM events")[0]?.c || 0;
    const rows = this.listDecisions().filter((row) => row.situation_type !== "action");
    const count = (state: AutopilotState) => rows.filter((row) => row.classification === state).length;
    const attention = count("NEEDS_YOU") + count("NEEDS_APPROVAL") + count("BLOCKED") + count("MONITORING");
    const normal = Math.max(0, eventsProcessed - attention);
    return {
      eventsProcessed,
      normal,
      monitoring: count("MONITORING"),
      prepared: count("PREPARED"),
      autoHandled: this.listDecisions().filter((row) => row.classification === "AUTO_HANDLED").length,
      needsApproval: count("NEEDS_APPROVAL"),
      needsYou: count("NEEDS_YOU"),
      blocked: count("BLOCKED"),
      handled: count("HANDLED"),
    };
  }

  approve(decisionId: string, now: string, actor = "operator") {
    const row = this.get(decisionId);
    if (!row) throw new Error("Decision not found");
    const actionId = row.action_id || this.approvalActionId(row);
    if (!actionId) throw new Error("No approval-required action on this decision");
    const action = one<ActionRow>(this.db, "SELECT * FROM actions WHERE id = ?", [actionId]);
    if (!action) throw new Error("Action not found");
    const current = evaluatePolicy({ type: action.type, payload: safeJson(action.payload) }, loadPolicies(this.db));
    if (current.outcome === "BLOCKED") throw new Error(current.reason);
    run(this.db, "UPDATE actions SET status = ?, policy_outcome = ?, policy_reason = ? WHERE id = ?", [
      "approved",
      current.outcome,
      current.reason,
      actionId,
    ]);
    run(
      this.db,
      "INSERT OR IGNORE INTO approvals (id, plan_id, action_id, status, decided_at, decided_by) VALUES (?, ?, ?, ?, ?, ?)",
      [`apr_${actionId}`, action.plan_id, actionId, "approved", now, actor],
    );
    // Approving used to mark the action approved and stop there, so re-evaluating classified the
    // card as NEEDS_APPROVAL again and it stuck there forever — the human's decision had no
    // effect. Run exactly the one action they approved. executeAction re-checks policy and
    // requires status 'approved', and this deliberately does not touch executePlan: no other
    // action on the plan is executed on the back of this approval.
    if (action.status !== "executed") executeAction(this.db, actionId, now, actor);
    this.patchMeta(row.id, { human: "APPROVE", actor }, now);
    return this.evaluateSituation(now);
  }

  reject(decisionId: string, now: string, actor = "operator") {
    const row = this.get(decisionId);
    if (!row) throw new Error("Decision not found");
    this.patchMeta(row.id, { human: "REJECT", actor }, now, "NEEDS_YOU", "HIGH_IMPACT_HUMAN_JUDGMENT");
    return this.get(row.id);
  }

  takeOver(decisionId: string, now: string, actor = "operator") {
    const row = this.get(decisionId);
    if (!row) throw new Error("Decision not found");
    this.patchMeta(row.id, { human: "TAKE_OVER", actor }, now, "NEEDS_YOU", "HIGH_IMPACT_HUMAN_JUDGMENT");
    return this.get(row.id);
  }

  explain(decisionId: string): AutopilotTrace | null {
    const row = this.get(decisionId);
    if (!row) return null;
    const evidence = safeJson(row.evidence);
    const impact = safeJson(row.impact_summary);
    return {
      decision: this.toCard(row),
      observed: String(evidence.observed || "A business event was recorded."),
      detected: String(evidence.detected || row.situation_type),
      impact: String(
        evidence.impact ||
          `${Number(impact.associated_revenue || 0).toLocaleString("en-US")} DZD associated — not a loss forecast.`,
      ),
      plan: String(evidence.plan || "Existing planner / recovery plan reused."),
      policy: String(evidence.policy || row.policy_decision || "Policy evaluated at execution time."),
      autopilot: String(evidence.explanation || row.reason_code),
      current: row.classification,
      historical: evidence.historical ? String(evidence.historical) : undefined,
    };
  }

  commandAnswer(question: string, now: string) {
    const snapshot = this.evaluateSituation(now);
    const q = question.toLowerCase();
    if (/what needs me|need me/.test(q)) {
      return {
        answer: `${snapshot.summary.needsYou} need you. ${snapshot.summary.needsApproval} need approval. ${snapshot.summary.blocked} blocked by policy.`,
        cards: snapshot.cards.filter((card: AutopilotCard) =>
          ["NEEDS_YOU", "NEEDS_APPROVAL", "BLOCKED"].includes(card.classification),
        ),
        summary: snapshot.summary,
      };
    }
    if (/monitoring/.test(q)) {
      return { answer: `${snapshot.summary.monitoring} situations are being monitored.`, cards: snapshot.cards.filter((c: AutopilotCard) => c.classification === "MONITORING"), summary: snapshot.summary };
    }
    if (/handle|handled automatically|safely handle/.test(q)) {
      return { answer: `${snapshot.summary.autoHandled} safe internal actions were auto-handled.`, cards: snapshot.cards.filter((c: AutopilotCard) => c.classification === "AUTO_HANDLED"), summary: snapshot.summary };
    }
    if (/blocked/.test(q)) {
      return { answer: `${snapshot.summary.blocked} actions blocked by current policy.`, cards: snapshot.cards.filter((c: AutopilotCard) => c.classification === "BLOCKED"), summary: snapshot.summary };
    }
    return { answer: "Your business is running. Autopilot classified current situations.", cards: snapshot.cards, summary: snapshot.summary };
  }

  private recordExceptionDecision(exception: ExceptionRow, now: string): AutopilotCard | null {
    const plan = one<PlanRow>(this.db, "SELECT * FROM plans WHERE exception_id = ? ORDER BY created_at DESC", [
      exception.id,
    ]);
    const actions = plan
      ? all<ActionRow>(this.db, "SELECT * FROM actions WHERE plan_id = ?", [plan.id])
      : all<ActionRow>(this.db, "SELECT * FROM actions WHERE exception_id = ?", [exception.id]);
    const verifications = all<{ status: string }>(
      this.db,
      "SELECT status FROM verifications WHERE exception_id = ? ORDER BY created_at DESC",
      [exception.id],
    );
    const latestVerification = verifications[0]?.status as "PENDING" | "SUCCESS" | "FAILED" | undefined;
    // Read what this exception is actually worth instead of assuming every non-delay exception is
    // the seeded 320,000 DZD deal.
    const recorded = safeJson(exception.impact_json);
    const impact =
      exception.id === IDS.excDelay
        ? calculateGraphImpact(this.db, IDS.shipment)
        : {
            affected_orders: [],
            associated_revenue: Number(recorded.revenueAssociated) || 0,
            affected_customers: [],
            affected_expected_cash: Number(recorded.cashTimingAmount) || 0,
          };
    const classified = classifySituation({
      hasException: true,
      exceptionKind: exception.kind,
      exceptionAttention: exception.attention,
      exceptionStatus: exception.status,
      isSupplierCascade: exception.id === IDS.excDelay || exception.kind === "delivery_delay",
      affectedOrders: "affected_orders" in impact ? impact.affected_orders.length : 0,
      associatedRevenue: impact.associated_revenue,
      warningActive: false,
      deadlineFuture: exception.status !== "resolved",
      hasPlan: Boolean(plan),
      hasApprovalRequired: actions.some(
        (action) => action.policy_outcome === "APPROVAL_REQUIRED" && action.status !== "executed",
      ),
      hasFinancialApproval: actions.some(
        (action) =>
          action.type === "apply_discount" &&
          action.policy_outcome === "APPROVAL_REQUIRED" &&
          action.status !== "executed",
      ),
      hasBlockedAction: actions.some((action) => action.policy_outcome === "BLOCKED"),
      hasAutoExecuted: actions.some((action) => action.policy_outcome === "AUTO" && action.status === "executed"),
      verificationStatus: latestVerification || null,
    });

    const approvalAction = actions.find(
      (action) => action.policy_outcome === "APPROVAL_REQUIRED" && action.status !== "executed",
    );
    this.upsertDecision({
      situationType: "exception",
      situationId: exception.id,
      classification: classified.classification,
      reasonCode: classified.reasonCode,
      exceptionId: exception.id,
      planId: plan?.id || null,
      actionId: approvalAction?.id || null,
      policyDecision: approvalAction?.policy_outcome || plan?.status || null,
      now,
      impact: {
        associated_revenue: impact.associated_revenue,
        affected_orders: "affected_orders" in impact ? impact.affected_orders.length : 0,
        affected_expected_cash: "affected_expected_cash" in impact ? impact.affected_expected_cash : 0,
      },
      evidence: this.evidenceFor(exception, plan, actions, classified),
      resolvedAt: classified.classification === "HANDLED" ? now : null,
    });
    return this.toCard(this.find("exception", exception.id)!);
  }

  private recordWarningDecision(warning: WarningRow, now: string): AutopilotCard | null {
    if (warning.status === "RESOLVED" || warning.status === "ESCALATED" || warning.status === "DISMISSED") {
      const existing = this.find("warning", warning.id);
      if (existing && existing.classification !== "NORMAL") {
        this.upsertDecision({
          situationType: "warning",
          situationId: warning.id,
          classification: "NORMAL",
          reasonCode: "NO_INTERVENTION_REQUIRED",
          warningId: warning.id,
          now,
          impact: {},
          evidence: { resolved: true },
          resolvedAt: warning.resolved_at || now,
        });
      }
      return null;
    }
    const evidence = safeJson(warning.evidence);
    const classified = classifySituation({
      hasException: false,
      isSupplierCascade: false,
      affectedOrders: 0,
      associatedRevenue: 0,
      warningActive: true,
      bufferState: String(evidence.buffer_state || ""),
      deadlineFuture: warning.status === "ACTIVE" || warning.status === "MONITORING",
      hasPlan: false,
      hasApprovalRequired: false,
      hasFinancialApproval: false,
      hasBlockedAction: false,
      hasAutoExecuted: false,
      verificationStatus: null,
    });
    this.upsertDecision({
      situationType: "warning",
      situationId: warning.id,
      classification: classified.classification,
      reasonCode: classified.reasonCode,
      warningId: warning.id,
      now,
      impact: {},
      evidence: {
        observed: evidence.observed,
        calculated: evidence.calculated,
        explanation: classified.explanation,
        available: warning.available_buffer_minutes,
        required: warning.required_buffer_minutes,
        shortfall: warning.shortfall_minutes,
      },
    });
    return this.toCard(this.find("warning", warning.id)!);
  }

  private upsertDecision(input: {
    situationType: AutopilotDecisionRow["situation_type"];
    situationId: string;
    classification: AutopilotState;
    reasonCode: AutopilotReasonCode;
    warningId?: string | null;
    exceptionId?: string | null;
    planId?: string | null;
    actionId?: string | null;
    policyDecision?: string | null;
    now: string;
    impact: Record<string, unknown>;
    evidence: Record<string, unknown>;
    resolvedAt?: string | null;
  }) {
    const existing = this.find(input.situationType, input.situationId);
    const id = existing?.id || `apd_${input.situationType}_${input.situationId}`;
    if (existing) {
      run(
        this.db,
        `UPDATE autopilot_decisions
         SET classification = ?, reason_code = ?, warning_id = ?, exception_id = ?, plan_id = ?,
             action_id = ?, policy_decision = ?, impact_summary = ?, evidence = ?, updated_at = ?,
             resolved_at = ?
         WHERE id = ?`,
        [
          input.classification,
          input.reasonCode,
          input.warningId ?? existing.warning_id,
          input.exceptionId ?? existing.exception_id,
          input.planId ?? existing.plan_id,
          input.actionId ?? existing.action_id,
          input.policyDecision ?? existing.policy_decision,
          JSON.stringify(input.impact),
          JSON.stringify({ ...safeJson(existing.evidence), ...input.evidence }),
          input.now,
          input.resolvedAt ?? existing.resolved_at,
          id,
        ],
      );
      return;
    }
    run(
      this.db,
      `INSERT INTO autopilot_decisions
        (id, situation_type, situation_id, classification, reason_code, warning_id, exception_id,
         goal_id, plan_id, action_id, policy_decision, impact_summary, evidence, created_at, updated_at,
         resolved_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, '{}')`,
      [
        id,
        input.situationType,
        input.situationId,
        input.classification,
        input.reasonCode,
        input.warningId ?? null,
        input.exceptionId ?? null,
        input.planId ?? null,
        input.actionId ?? null,
        input.policyDecision ?? null,
        JSON.stringify(input.impact),
        JSON.stringify(input.evidence),
        input.now,
        input.now,
        input.resolvedAt ?? null,
      ],
    );
  }

  private find(type: string, situationId: string) {
    return one<AutopilotDecisionRow>(
      this.db,
      "SELECT * FROM autopilot_decisions WHERE situation_type = ? AND situation_id = ?",
      [type, situationId],
    );
  }

  private toCard(row: AutopilotDecisionRow): AutopilotCard {
    const impact = safeJson(row.impact_summary);
    const evidence = safeJson(row.evidence);
    const title =
      row.exception_id === IDS.excDelay
        ? "Supplier cascade"
        : row.exception_id === IDS.excDiscount
          ? "10% discount request"
          : row.exception_id === IDS.excMissed
            ? "320K opportunity recovery"
            : row.warning_id
              ? "Order A delivery"
              : row.action_id
                ? "Safe internal action"
                : "Business situation";
    return {
      id: row.id,
      classification: row.classification,
      reasonCode: row.reason_code,
      title,
      happened: String(evidence.observed || title),
      whyItMatters: String(evidence.impact || evidence.calculated || evidence.explanation || row.reason_code),
      alreadyDone: Array.isArray(evidence.already) ? (evidence.already as string[]) : defaultAlready(row),
      needsFromYou: needsCopy(row),
      href:
        row.warning_id
          ? `/warnings/${row.warning_id}`
          : row.exception_id === IDS.excDelay
            ? `/impact/${IDS.excDelay}`
            : row.exception_id
              ? `/exceptions/${row.exception_id}`
              : `/autopilot/${row.id}`,
      warningId: row.warning_id,
      exceptionId: row.exception_id,
      planId: row.plan_id,
      actionId: row.action_id,
      associatedRevenue: typeof impact.associated_revenue === "number" ? impact.associated_revenue : null,
      currency: "DZD",
    };
  }

  private evidenceFor(
    exception: ExceptionRow,
    plan: PlanRow | undefined,
    actions: ActionRow[],
    classified: ClassifyResult,
  ) {
    return {
      observed: exception.title,
      detected: exception.kind,
      impact: exception.id === IDS.excDelay ? "Cascade impact from the existing graph engine." : "320,000 DZD opportunity associated.",
      plan: plan?.title || "No plan yet",
      policy: actions.map((action) => `${action.type}:${action.policy_outcome}`).join(", "),
      explanation: classified.explanation,
      already:
        exception.id === IDS.excDelay
          ? [
              "traced dependencies",
              "calculated impact",
              "identified affected commitments",
              "prepared response options",
            ]
          : actions.map((action) => action.title),
    };
  }

  private approvalActionId(row: AutopilotDecisionRow) {
    if (row.action_id) return row.action_id;
    if (!row.plan_id) return null;
    const action = one<ActionRow>(
      this.db,
      "SELECT * FROM actions WHERE plan_id = ? AND policy_outcome = 'APPROVAL_REQUIRED' AND status != 'executed'",
      [row.plan_id],
    );
    return action?.id || null;
  }

  private patchMeta(
    id: string,
    extra: Record<string, unknown>,
    now: string,
    classification?: AutopilotState,
    reason?: AutopilotReasonCode,
  ) {
    const row = this.get(id);
    if (!row) return;
    run(
      this.db,
      `UPDATE autopilot_decisions
       SET metadata = ?, updated_at = ?, classification = ?, reason_code = ? WHERE id = ?`,
      [
        JSON.stringify({ ...safeJson(row.metadata), ...extra }),
        now,
        classification || row.classification,
        reason || row.reason_code,
        id,
      ],
    );
  }
}

function defaultAlready(row: AutopilotDecisionRow): string[] {
  if (row.exception_id === IDS.excDelay) {
    return ["traced dependencies", "calculated impact", "identified at-risk commitment", "prepared recovery options"];
  }
  if (row.exception_id === IDS.excMissed) return ["Proposal ready", "Follow-up ready", "Checkpoint ready"];
  if (row.exception_id === IDS.excDiscount) return ["Policy evaluated", "5% + Net-14 alternative prepared"];
  return ["Classified from stored business state"];
}

function needsCopy(row: AutopilotDecisionRow): string {
  if (row.classification === "NEEDS_YOU") return "Choose the recovery strategy.";
  if (row.classification === "NEEDS_APPROVAL") return "Approve, edit, or reject the prepared external action.";
  if (row.classification === "BLOCKED") return "Review the permitted alternative. Policy was enforced.";
  if (row.classification === "MONITORING") return "Nothing yet — EvoPulse is watching the deadline and verification.";
  if (row.classification === "HANDLED") return "Nothing. Verification succeeded.";
  return "No action required.";
}

function safeJson(raw: string | Record<string, unknown>): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw;
  try {
    const value = JSON.parse(String(raw || "{}")) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function eventsProcessedCount(db: DatabaseSync) {
  return all<{ c: number }>(db, "SELECT COUNT(*) as c FROM events")[0]?.c || 0;
}
