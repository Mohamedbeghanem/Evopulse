import type { DatabaseSync } from "node:sqlite";
import { one } from "../db";
import type { ExpectationRow, Impact } from "../types";

/**
 * Impact for an expectation that came from a connector (CSV import). Uses the imported entity's own
 * amount — never the Atlas 320K opportunity fallback, which does not exist in a real workspace.
 */
export function connectorExpectationImpact(db: DatabaseSync, exp: ExpectationRow): Impact {
  const row = exp.entity_id ? one<{ type: string; name: string; payload: string }>(db, "SELECT type, name, payload FROM entities WHERE id = ?", [exp.entity_id]) : undefined;
  let payload: { amount?: unknown; currency?: unknown; customerId?: unknown } = {};
  try {
    payload = row ? (JSON.parse(row.payload) as typeof payload) : {};
  } catch {
    payload = {};
  }
  const amount = typeof payload.amount === "number" ? payload.amount : Number(payload.amount || 0) || 0;
  const currency = typeof payload.currency === "string" && payload.currency ? payload.currency : "DZD";
  const isInvoice = row?.type === "invoice";
  return {
    customersAffected: payload.customerId ? 1 : 0,
    opportunitiesAffected: 0,
    revenueAssociated: amount,
    currency,
    cashTimingAffected: isInvoice,
    urgency: "high",
    notes: `${row?.name || "Imported record"}: ${amount.toLocaleString("en-US")} ${currency} from your imported data. A fact about this record — not a loss forecast.`,
  };
}
