import type { DatabaseSync } from "node:sqlite";
import { one } from "../db";
import { IDS } from "../ids";
import type { EntityRow, Impact } from "../types";

export function calculateImpact(db: DatabaseSync, opportunityId = IDS.opportunity): Impact {
  const opp = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [opportunityId]);
  const payload = opp ? (JSON.parse(opp.payload) as { amount?: number; currency?: string }) : {};
  const amount = payload.amount ?? 320000;
  const currency = payload.currency ?? "DZD";
  return {
    customersAffected: 1,
    opportunitiesAffected: 1,
    revenueAssociated: amount,
    currency,
    cashTimingAffected: true,
    urgency: "high",
    notes: `Associated opportunity ${amount.toLocaleString("en-US")} ${currency}. Causal certainty is limited to this deal — not a forecast.`,
  };
}
