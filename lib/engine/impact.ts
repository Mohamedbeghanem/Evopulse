import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import { getDownstream, graphFor } from "../graph";
import { IDS } from "../ids";
import type { CommitmentRow, EntityRow, GraphImpact, Impact } from "../types";

/** 320K opportunity impact — leave this path unchanged for the PR #1 loop. */
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

function amountOf(meta: Record<string, unknown>): number {
  const value = meta.amount;
  return typeof value === "number" ? value : Number(value || 0);
}

/** Factual cascade from a graph node. Totals are sums of seeded entity amounts — not a loss forecast. */
export function calculateGraphImpact(db: DatabaseSync, nodeId: string, maxDepth = 12): GraphImpact {
  const { start, hits, paths } = getDownstream(db, nodeId, maxDepth);
  const orders = hits.filter((h) => h.node.type === "order");
  const customers = hits.filter((h) => h.node.type === "customer");
  const invoices = hits.filter((h) => h.node.type === "invoice");
  const commitments = hits.filter((h) => h.node.type === "commitment");
  const atRisk = all<CommitmentRow>(
    db,
    "SELECT * FROM commitments WHERE id IN (SELECT entity_id FROM graph_nodes WHERE type = 'commitment') AND status = 'at_risk'",
  );
  const associated_revenue = orders.reduce((sum, h) => sum + amountOf(h.node.metadata), 0);
  const affected_expected_cash = invoices.reduce((sum, h) => sum + amountOf(h.node.metadata), 0);
  const dependency_depth = hits.reduce((max, h) => Math.max(max, h.depth), 0);
  const repo = graphFor(db);
  const origin = start || repo.getNode(nodeId);

  return {
    kind: "factual",
    affected_entities: hits.map((h) => ({ id: h.node.id, type: h.node.type, label: h.node.label })),
    affected_orders: orders.map((h) => ({
      id: h.node.id,
      label: h.node.label,
      amount: amountOf(h.node.metadata),
    })),
    affected_customers: customers.map((h) => ({ id: h.node.id, label: h.node.label })),
    affected_invoices: invoices.map((h) => ({
      id: h.node.id,
      label: h.node.label,
      amount: amountOf(h.node.metadata),
    })),
    associated_revenue,
    affected_expected_cash,
    dependency_depth,
    commitments_at_risk: atRisk.length || commitments.filter((h) => h.node.metadata.status === "at_risk").length,
    currency: "DZD",
    paths,
    notes: origin
      ? `Associated revenue ${associated_revenue.toLocaleString("en-US")} DZD from ${orders.length} orders. Expected cash timing ${affected_expected_cash.toLocaleString("en-US")} DZD. These are graph facts — not a claim that the money is lost.`
      : "Node not found.",
  };
}

export function explainWhyAffected(db: DatabaseSync, fromId: string, entityId: string): string {
  const impact = calculateGraphImpact(db, fromId);
  const path = impact.paths.find((p) => p.nodeIds.includes(entityId));
  if (!path) return "No graph path from the origin to this entity.";
  const target = path.labels[path.labels.length - 1];
  return `${target} is affected because: ${path.explanation}.`;
}
