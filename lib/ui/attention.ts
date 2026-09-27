import type { DatabaseSync } from "node:sqlite";
import { all, getMeta, one } from "../db";
import { calculateGraphImpact } from "../engine/impact";
import { serializeException } from "../engine/pulse";
import { IDS } from "../ids";
import type { ActionRow, ExceptionRow, Impact, PlanRow } from "../types";

/** Pulse projection. Stored exception.attention is unchanged. */
export type ProjectedAttention =
  | "NEEDS_YOU"
  | "NEEDS_APPROVAL"
  | "BLOCKED"
  | "MONITORING"
  | "HANDLED"
  | "HEALTHY";

export type SituationLayer =
  | "WARNING"
  | "EXCEPTION"
  | "IMPACT"
  | "GRAPH"
  | "PLAN"
  | "POLICY"
  | "AUTOPILOT"
  | "VERIFICATION"
  | "OUTCOME";

export type Situation = {
  id: string;
  title: string;
  summary: string;
  projection: ProjectedAttention;
  storedAttention: ExceptionRow["attention"];
  kind: string;
  status: string;
  quote: string;
  source: string;
  expected: string;
  actual: string;
  confidence: number;
  money: { amount: number; currency: string; caption: string } | null;
  cashTiming: { amount: number; currency: string } | null;
  impact: Impact;
  planId: string | null;
  planStatus: string | null;
  layers: SituationLayer[];
  primaryHref: string;
  primaryLabel: string;
  whyHref: string;
};

export function projectAttention(exception: ExceptionRow, plan?: PlanRow | null, actions: ActionRow[] = []): ProjectedAttention {
  if (exception.attention === "HANDLED") return "HANDLED";
  if (exception.attention === "MONITORING") return "MONITORING";
  if (exception.attention === "HEALTHY") return "HEALTHY";
  if (actions.some((action) => action.policy_outcome === "BLOCKED")) return "BLOCKED";
  if (
    plan?.status === "approval_required" ||
    actions.some((action) => action.policy_outcome === "APPROVAL_REQUIRED" && action.status !== "executed")
  ) {
    return "NEEDS_APPROVAL";
  }
  return exception.attention;
}

export function listSituations(db: DatabaseSync): Situation[] {
  const rows = all<ExceptionRow>(db, "SELECT * FROM exceptions ORDER BY created_at DESC");
  return rows.map((row) => situationFromException(db, row));
}

export function getSituation(db: DatabaseSync, id: string): Situation | null {
  const row = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [id]);
  if (!row) return null;
  return situationFromException(db, row);
}

export function situationFromException(db: DatabaseSync, row: ExceptionRow): Situation {
  const exception = serializeException(row);
  const plan = one<PlanRow>(db, "SELECT * FROM plans WHERE exception_id = ? ORDER BY created_at DESC", [row.id]);
  const actions = plan
    ? all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ?", [plan.id])
    : all<ActionRow>(db, "SELECT * FROM actions WHERE exception_id = ?", [row.id]);
  const projection = projectAttention(row, plan, actions);
  const delayed = getMeta(db, "supplier_phase", "stable") === "delayed";
  const cascade = delayed && row.id === IDS.excDelay ? calculateGraphImpact(db, IDS.shipment) : null;

  const moneyAmount = cascade?.associated_revenue ?? exception.impact.revenueAssociated;
  const cashTiming = cascade?.affected_expected_cash ?? null;

  return {
    id: row.id,
    title: exception.title,
    summary: situationSummary(row, projection, cascade),
    projection,
    storedAttention: exception.attention,
    kind: exception.kind,
    status: exception.status,
    quote: exception.evidence.quote,
    source: exception.evidence.source,
    expected: exception.evidence.expected,
    actual: exception.evidence.actual,
    confidence: exception.confidence,
    money: moneyAmount
      ? {
          amount: moneyAmount,
          currency: exception.impact.currency,
          caption: cascade ? "associated revenue — not lost" : "associated opportunity — not lost",
        }
      : null,
    cashTiming:
      cashTiming && cashTiming > 0
        ? { amount: cashTiming, currency: exception.impact.currency }
        : null,
    impact: exception.impact,
    planId: plan?.id ?? null,
    planStatus: plan?.status ?? null,
    layers: layersFor(row, projection, Boolean(plan), actions),
    primaryHref: primaryHref(row, projection, plan?.id ?? null),
    primaryLabel: primaryLabel(row, projection),
    whyHref: row.id === IDS.excDelay ? `/explore` : `/evidence/${row.id}`,
  };
}

export function pulseBoard(db: DatabaseSync) {
  const situations = listSituations(db);
  const needs = situations.filter((s) => s.projection === "NEEDS_YOU" || s.projection === "NEEDS_APPROVAL" || s.projection === "BLOCKED");
  const monitoring = situations.filter((s) => s.projection === "MONITORING");
  const handled = situations.filter((s) => s.projection === "HANDLED");
  return {
    now: getMeta(db, "demo_now"),
    phase: getMeta(db, "demo_phase", "seeded"),
    supplierPhase: getMeta(db, "supplier_phase", "stable"),
    needs,
    monitoring,
    handled,
    counts: {
      needsYou: needs.length,
      monitoring: monitoring.length,
      handled: handled.length,
    },
    situations,
  };
}

function situationSummary(
  row: ExceptionRow,
  projection: ProjectedAttention,
  cascade: ReturnType<typeof calculateGraphImpact> | null,
): string {
  if (row.id === IDS.excDelay && cascade) {
    return `Atlas Supply · SH-204 · RK-7 · ${cascade.affected_orders.length} orders · ${cascade.affected_customers.length} customers`;
  }
  if (row.id === IDS.excDiscount) return "Customer requested 10%. Policy discount_max=5% refused it.";
  if (projection === "NEEDS_APPROVAL") return "Recovery is ready. A human must authorize the customer-facing send.";
  if (projection === "MONITORING") return "Action executed. Verification pending — send is not HANDLED.";
  if (projection === "HANDLED") return "Verification confirmed the expected world event.";
  return row.title;
}

function layersFor(row: ExceptionRow, projection: ProjectedAttention, hasPlan: boolean, actions: ActionRow[]): SituationLayer[] {
  const layers: SituationLayer[] = ["EXCEPTION"];
  if (row.id === IDS.excDelay) layers.push("WARNING", "IMPACT", "GRAPH");
  if (hasPlan) layers.push("PLAN", "POLICY");
  if (actions.some((action) => action.policy_outcome === "AUTO")) layers.push("AUTOPILOT");
  if (projection === "BLOCKED") layers.push("POLICY");
  if (projection === "MONITORING" || projection === "HANDLED") layers.push("VERIFICATION");
  if (projection === "HANDLED") layers.push("OUTCOME");
  return [...new Set(layers)];
}

function primaryHref(row: ExceptionRow, projection: ProjectedAttention, planId: string | null): string {
  if (row.id === IDS.excDelay) return `/situations/${row.id}`;
  if (projection === "BLOCKED") return `/policy`;
  if (projection === "MONITORING" || projection === "HANDLED") return `/verification/${row.id}`;
  if (planId) return `/exceptions/${row.id}/plan`;
  return `/situations/${row.id}`;
}

function primaryLabel(row: ExceptionRow, projection: ProjectedAttention): string {
  if (row.id === IDS.excDelay) return "Open cascade";
  if (projection === "BLOCKED") return "Review policy-safe alternatives";
  if (projection === "NEEDS_APPROVAL") return "Review and approve recovery";
  if (projection === "MONITORING") return "Watch verification";
  if (projection === "HANDLED") return "Read outcome";
  return "Open situation";
}
