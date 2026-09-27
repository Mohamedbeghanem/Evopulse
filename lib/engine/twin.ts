import type { DatabaseSync } from "node:sqlite";
import { all, getMeta, one } from "../db";
import { EarlyWarningEngine } from "../warnings";
import { calculateGraphImpact } from "./impact";
import { IDS } from "../ids";
import type { ExceptionRow, ExpectationRow } from "../types";
import { isMissedCommitment } from "./exception-types";

export type TwinDomain = {
  id: "SALES" | "OPERATIONS" | "CASH" | "CUSTOMERS" | "SUPPLIERS";
  status: "AT_RISK" | "ATTENTION" | "MONITORING" | "STABLE" | "HANDLED";
  headline: string;
  exceptions: number;
  commitments: number;
  dependencies: number;
  recent_changes: string[];
  future_expectations: string[];
  attention_value: number | null;
  currency: string;
};

export function businessTwin(db: DatabaseSync) {
  const delayed = getMeta(db, "supplier_phase", "stable") === "delayed";
  const phase = getMeta(db, "demo_phase", "seeded");
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions");
  const salesOpen = exceptions.filter(
    (e) => e.attention === "NEEDS_YOU" && (isMissedCommitment(e.kind) || e.kind === "policy_blocked"),
  );
  const delay = exceptions.find((e) => e.id === IDS.excDelay && e.status !== "resolved");
  const impact = delayed ? calculateGraphImpact(db, IDS.shipment) : null;
  const activeWarnings = EarlyWarningEngine.for(db).getActiveWarnings();
  const shipExp = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectShip]);
  const deliverExp = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectDeliverA]);

  const sales: TwinDomain = {
    id: "SALES",
    status: salesOpen.length ? "ATTENTION" : phase === "recovered" ? "HANDLED" : "STABLE",
    headline: salesOpen.length
      ? "320K commitment exception"
      : phase === "discount_blocked"
        ? "10% blocked — alternative ready"
        : phase === "recovered"
          ? "320K recovery executed"
          : "No open sales exception",
    exceptions: salesOpen.length,
    commitments: 2,
    dependencies: 1,
    recent_changes: salesOpen.map((e) => e.title),
    future_expectations: ["Friday customer decision depends on the revised proposal"],
    attention_value: salesOpen.length ? 320000 : null,
    currency: "DZD",
  };

  const operations: TwinDomain = {
    id: "OPERATIONS",
    status: delayed ? "AT_RISK" : "STABLE",
    headline: delayed
      ? `${activeWarnings.length} active early warning · ${impact?.affected_orders.length ?? 0} affected orders · ${
          activeWarnings.length
        } customer commitment at risk`
      : "Shipment SH-204 still expected Monday",
    exceptions: delay ? 1 : 0,
    commitments: delayed ? 1 : 0,
    dependencies: delayed ? (impact?.dependency_depth ?? 0) : 0,
    recent_changes: delayed ? ["SH-204 Monday → Wednesday"] : [],
    future_expectations: delayed
      ? ["Wednesday shipment arrival", deliverExp?.description || "Customer delivery"]
      : [shipExp?.description || "Monday shipment"],
    attention_value: delayed ? impact?.associated_revenue ?? null : null,
    currency: "DZD",
  };

  const cash: TwinDomain = {
    id: "CASH",
    status: delayed ? "MONITORING" : "STABLE",
    headline: delayed
      ? `${(impact?.affected_expected_cash ?? 0).toLocaleString("en-US")} DZD expected timing connected to active cascade`
      : "No cash-timing exception",
    exceptions: delayed ? 1 : 0,
    commitments: 0,
    dependencies: delayed ? 3 : 0,
    recent_changes: delayed ? ["Invoice cash week depends on delayed racking"] : [],
    future_expectations: delayed ? ["540K DZD expected cash events still dated next week"] : ["Cash week on track"],
    attention_value: delayed ? impact?.affected_expected_cash ?? null : null,
    currency: "DZD",
  };

  const customers: TwinDomain = {
    id: "CUSTOMERS",
    status: delayed ? "ATTENTION" : salesOpen.length ? "ATTENTION" : "STABLE",
    headline: delayed
      ? `${impact?.affected_customers.length ?? 0} customers affected`
      : salesOpen.length
        ? "Atlas Medical waiting on the revised proposal"
        : "No customer wait-state",
    exceptions: (delay ? 1 : 0) + salesOpen.length,
    commitments: delayed ? 1 : 0,
    dependencies: delayed ? 3 : 1,
    recent_changes: delayed ? ["Three customer orders share SH-204"] : [],
    future_expectations: delayed ? ["Customer delivery deadlines after Wednesday"] : [],
    attention_value: delayed ? impact?.affected_customers.length ?? null : null,
    currency: "DZD",
  };

  const suppliers: TwinDomain = {
    id: "SUPPLIERS",
    status: delayed ? "AT_RISK" : "STABLE",
    headline: delayed ? "1 shipment delayed · +2 days" : "Atlas Supply on the Monday slot",
    exceptions: delay ? 1 : 0,
    commitments: 1,
    dependencies: 1,
    recent_changes: delayed ? ["Supplier message: Wednesday instead of Monday"] : [],
    future_expectations: delayed ? ["Wednesday 30 Sep arrival"] : ["Monday 28 Sep arrival"],
    attention_value: delayed ? 2 : null,
    currency: "DZD",
  };

  return {
    delayed,
    domains: [sales, operations, cash, customers, suppliers],
    impact,
  };
}
