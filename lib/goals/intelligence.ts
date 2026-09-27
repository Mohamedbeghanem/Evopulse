import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import { calculateGraphImpact } from "../engine/impact";
import { IDS } from "../ids";
import type { DependencyRow, EntityRow, ExceptionRow, ExpectationRow, GraphImpact, Impact } from "../types";
import { orderAmountsFromDb } from "./seed-risks";
import type { BusinessRisk, RiskDomain } from "./types";

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function domainForException(kind: string, title: string): RiskDomain {
  if (/cash|payment|invoice/.test(`${kind} ${title}`)) return "cash";
  if (/ship|deliver|supplier|operation/.test(`${kind} ${title}`)) return "operations";
  if (/customer|commitment/.test(`${kind} ${title}`) && /customer/.test(kind)) return "customers";
  return "sales";
}

function pathFromGraph(impact: GraphImpact | null, fallback: string[]): string[] {
  const path = impact?.paths.find((p) => p.nodeIds.includes(IDS.orderA)) || impact?.paths[0];
  if (path?.labels?.length) return path.labels;
  return fallback;
}

/**
 * Narrow read-model over current business state.
 * Prefers Business Graph impact when the shipment node exists.
 */
export function collectBusinessRisks(db: DatabaseSync): BusinessRisk[] {
  const risks: BusinessRisk[] = [];
  const seen = new Set<string>();
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions");
  const deps = all<DependencyRow>(db, "SELECT * FROM dependencies");
  const totals = orderAmountsFromDb(db);
  const graphImpact = one(db, "SELECT id FROM entities WHERE id = ?", [IDS.shipment])
    ? calculateGraphImpact(db, IDS.shipment)
    : null;

  for (const exception of exceptions) {
    const resolved = exception.status === "resolved";
    const impact = parseJson<Impact & { affectedExpectedCash?: number }>(exception.impact_json, {
      customersAffected: 0,
      opportunitiesAffected: 0,
      revenueAssociated: 0,
      currency: "DZD",
      cashTimingAffected: false,
      urgency: "medium",
      notes: "",
    });
    const evidence = parseJson<Record<string, unknown>>(exception.evidence_json, {});
    const domain = domainForException(exception.kind, exception.title);
    const associatedValue =
      domain === "operations" && (graphImpact?.associated_revenue || totals.revenue)
        ? graphImpact?.associated_revenue || totals.revenue
        : impact.revenueAssociated || 0;
    const customers =
      domain === "operations"
        ? graphImpact?.affected_customers.length || totals.customers || impact.customersAffected
        : impact.customersAffected;
    const orders =
      domain === "operations"
        ? graphImpact?.affected_orders.length || totals.orders || impact.affectedOrders || 0
        : impact.affectedOrders || impact.opportunitiesAffected;
    const risk: BusinessRisk = {
      id: `risk_${exception.id}`,
      domain,
      kind: exception.kind,
      title: exception.title,
      associatedValue,
      currency: impact.currency || "DZD",
      affectedOrders: orders || 0,
      affectedCustomers: customers || 0,
      exceptionId: exception.id,
      entityIds: [exception.opportunity_id, exception.expectation_id].filter((v): v is string => Boolean(v)),
      evidence: {
        kind: "OBSERVED_FACT",
        source: String(evidence.source || "exception"),
        quote: String(evidence.quote || exception.title),
        expected: evidence.expected ? String(evidence.expected) : undefined,
        actual: evidence.actual ? String(evidence.actual) : undefined,
        path: pathFromGraph(
          domain === "operations" ? graphImpact : null,
          Array.isArray(evidence.path) ? evidence.path.map(String) : [],
        ),
      },
      severity: exception.severity,
      urgency: exception.urgency,
      deadline: undefined,
      dependencyCount:
        domain === "operations"
          ? graphImpact?.dependency_depth || 0
          : deps.filter((d) => d.from_id === exception.opportunity_id || d.to_id === exception.opportunity_id).length,
      status: exception.status,
      resolved,
    };
    if (!seen.has(risk.id)) {
      seen.add(risk.id);
      risks.push(risk);
    }

    const cashAmount =
      impact.cashTimingAmount ||
      impact.affectedExpectedCash ||
      (domain === "operations" ? graphImpact?.affected_expected_cash || totals.cash : 0);
    if (!resolved && cashAmount > 0 && domain === "operations") {
      const cashId = `risk_cash_${exception.id}`;
      if (!seen.has(cashId)) {
        seen.add(cashId);
        risks.push({
          id: cashId,
          domain: "cash",
          kind: "cash_timing_shift",
          title: "Expected cash timing affected",
          associatedValue: cashAmount,
          currency: impact.currency || "DZD",
          affectedOrders: orders || 0,
          affectedCustomers: customers || 0,
          exceptionId: exception.id,
          entityIds: [IDS.cashWeek, IDS.invoiceA, IDS.invoiceB, IDS.invoiceC],
          evidence: {
            kind: "CALCULATED_IMPACT",
            source: "business-graph",
            quote: "Open invoices sit downstream of the delayed shipment.",
            path: ["Shipment SH-204", "Orders", "Invoices", "Expected cash"],
          },
          severity: "high",
          urgency: "high",
          deadline: undefined,
          dependencyCount: graphImpact?.affected_invoices.length || 0,
          status: "open",
          resolved: false,
        });
      }
    }
  }

  const atRisk = all<ExpectationRow>(
    db,
    "SELECT * FROM expectations WHERE status IN ('AT_RISK', 'MISSED', 'BLOCKED')",
  );
  for (const expectation of atRisk) {
    const match = risks.find(
      (r) => r.exceptionId && exceptions.some((e) => e.id === r.exceptionId && e.expectation_id === expectation.id),
    );
    if (match) match.deadline = expectation.due_at;
  }

  return risks;
}

export function loadEntity(db: DatabaseSync, id: string): EntityRow | undefined {
  return one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [id]);
}
