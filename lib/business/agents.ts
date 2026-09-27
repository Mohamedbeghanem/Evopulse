import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import { formatMoney } from "../clock";
import { IDS } from "../ids";
import { businessOverview, type BusinessOverview } from "./overview";

/**
 * Customer-facing agents. Their "recent activity" is derived from live state
 * (entities, graph impact, exceptions, plans, agent runs). No hardcoded activity strings:
 * a line appears only when the state that backs it exists.
 */

export type AgentId = "pulse" | "revenue" | "supply" | "cash" | "operations";

export type AgentCard = {
  id: AgentId;
  name: string;
  scope: string;
  status: "ACTIVE" | "ATTENTION";
  activity: string[];
};

export const AGENT_NAMES: Record<AgentId, string> = {
  pulse: "Pulse",
  revenue: "Revenue Guardian",
  supply: "Supply Guardian",
  cash: "Cash Guardian",
  operations: "Operations Guardian",
};

export const AGENT_SCOPES: Record<AgentId, string> = {
  pulse: "General business control",
  revenue: "Customers, orders, invoices, commitments",
  supply: "Suppliers, shipments, products, orders",
  cash: "Invoices, expected cash timing, customer commitments",
  operations: "Orders, shipments, supplier dependencies",
};

type Counts = { needsYou: number; monitoring: number; handled: number };

function money(amount: number | undefined, currency = "DZD") {
  return formatMoney(amount ?? 0, currency);
}

export function agentRoster(db: DatabaseSync, counts: Counts, overview: BusinessOverview = businessOverview(db)): AgentCard[] {
  const canonical = overview.canonical;
  const delayed = overview.supplierDelayed;
  const delayException = one<{ id: string; status: string }>(db, "SELECT id, status FROM exceptions WHERE id = ?", [
    IDS.excDelay,
  ]);
  const delayPlan = one<{ id: string; status: string }>(
    db,
    "SELECT id, status FROM plans WHERE exception_id = ? ORDER BY created_at DESC LIMIT 1",
    [IDS.excDelay],
  );
  const lastRun = one<{ command: string; status: string; summary: string }>(
    db,
    "SELECT command, status, summary FROM agent_runs ORDER BY started_at DESC LIMIT 1",
  );
  const eventsProcessed = one<{ c: number }>(db, "SELECT COUNT(*) AS c FROM events")?.c ?? 0;
  const supplier = overview.suppliers.find((row) => row.id === IDS.supplier);
  const shipment = overview.shipments.find((row) => row.id === IDS.shipment);
  const product = overview.products.find((row) => row.id === IDS.product);
  const dependencyEdges = all<{ c: number }>(
    db,
    "SELECT COUNT(*) AS c FROM graph_edges WHERE relationship IN ('supplies', 'contains', 'required_by')",
  )[0]?.c ?? 0;

  // Pulse
  const pulse: string[] = [
    `${counts.needsYou} need you · ${counts.monitoring} monitoring · ${counts.handled} handled`,
    `${eventsProcessed} business events processed`,
  ];
  if (lastRun) pulse.push(`Last command: "${lastRun.command}" — ${lastRun.status.toLowerCase()}`);

  // Revenue Guardian
  const revenue: string[] = [];
  if (delayException && supplier) {
    revenue.push(`Investigated ${supplier.name} delay`);
    revenue.push(`Traced ${money(canonical.associatedRevenue)} associated revenue`);
    revenue.push(`Identified ${canonical.customers} affected customers`);
  }
  if (delayPlan) revenue.push(`Prepared recovery plan (${delayPlan.status.toLowerCase()})`);
  revenue.push(
    `Watching ${overview.census.customers} customers · ${overview.census.orders} orders · ${overview.census.invoices} invoices · ${overview.census.commitments} commitments`,
  );

  // Supply Guardian
  const supply: string[] = [];
  if (supplier) supply.push(`Monitoring ${supplier.name}${delayed ? " — delay reported" : ""}`);
  if (shipment) supply.push(`Tracking ${shipment.name.replace(/^Shipment\s+/i, "")}${shipment.status ? ` — ${shipment.status}` : ""}`);
  if (product) {
    const sku = product.sku ?? product.name;
    supply.push(`Tracing ${sku} → ${canonical.orders} orders`);
  }
  for (const row of overview.suppliers) {
    if (row.id !== IDS.supplier) supply.push(`Monitoring ${row.name}`);
  }

  // Cash Guardian
  const cash: string[] = [];
  if (canonical.expectedCash > 0) cash.push(`Tracking ${money(canonical.expectedCash)} expected cash timing`);
  const canonicalInvoices = new Set(canonical.invoiceIds);
  const invoiceC = overview.invoices.find((row) => row.id === IDS.invoiceC);
  if (invoiceC) cash.push(`Monitoring ${invoiceC.name} · ${money(invoiceC.amount, invoiceC.currency)}`);
  for (const row of overview.invoices) {
    if (!canonicalInvoices.has(row.id)) cash.push(`Monitoring ${row.name} · ${money(row.amount, row.currency)}`);
  }

  // Operations Guardian
  const activeOrders = overview.orders.filter((row) => !row.status || row.status === "active").length;
  const operations: string[] = [
    `${activeOrders} active orders`,
    `${overview.census.suppliers} suppliers`,
  ];
  if (dependencyEdges > 0) operations.push("Supply dependency monitoring active");

  const cards: [AgentId, string[], boolean][] = [
    ["pulse", pulse, counts.needsYou > 0],
    ["revenue", revenue, Boolean(delayException && delayException.status !== "resolved")],
    ["supply", supply, delayed],
    ["cash", cash, delayed],
    ["operations", operations, delayed],
  ];
  return cards.map(([id, activity, attention]) => ({
    id,
    name: AGENT_NAMES[id],
    scope: AGENT_SCOPES[id],
    status: attention ? "ATTENTION" : "ACTIVE",
    activity,
  }));
}
