import type { DatabaseSync } from "node:sqlite";
import { formatDay, formatMoney } from "../clock";
import { one } from "../db";
import { getDownstream, graphFor, type GraphEdge, type GraphNode } from "../graph";
import { IDS } from "../ids";
import type { ExpectationChangeRow, GraphImpact } from "../types";
import { calculateGraphImpact } from "./impact";
import { SEED_MESSAGE_SUPPLIER } from "./seed-graph";

export type CausalRole = "cause" | "event" | "dependency" | "consequence";

export type CausalNodeView = {
  id: string;
  type: string;
  label: string;
  role: CausalRole;
  relationship: string | null;
  amount: number | null;
  amountLabel: string | null;
  source: string;
  evidence: string;
  timestamp: string;
  confidence: number;
  status: string;
  affected: { id: string; type: string; label: string }[];
};

export type CausalColumn = {
  key: string;
  title: string;
  role: CausalRole;
  nodes: CausalNodeView[];
};

export type CausalExplorerModel = {
  headline: string;
  subhead: string;
  delayed: boolean;
  deltaDays: number | null;
  orders: number;
  customers: number;
  revenueLabel: string;
  cashLabel: string;
  columns: CausalColumn[];
};

const COLUMNS: { key: string; title: string; role: CausalRole; types: string[] }[] = [
  { key: "cause", title: "Cause", role: "cause", types: ["supplier"] },
  { key: "event", title: "Event", role: "event", types: ["shipment"] },
  { key: "dependency", title: "Dependency", role: "dependency", types: ["product"] },
  { key: "orders", title: "Orders", role: "consequence", types: ["order"] },
  { key: "customers", title: "Customers", role: "consequence", types: ["customer"] },
  { key: "deadlines", title: "Deadlines", role: "consequence", types: ["commitment"] },
  { key: "cash", title: "Expected cash", role: "consequence", types: ["invoice", "cash"] },
];

/** Interactive cause → event → dependency → consequence model. Amounts come from graph metadata. */
export function buildCausalExplorer(db: DatabaseSync, originId = IDS.supplier): CausalExplorerModel {
  const repo = graphFor(db);
  const origin = repo.getNode(originId) ?? repo.getNode(IDS.supplier);
  const impact = calculateGraphImpact(db, IDS.shipment);
  const change = latestShipmentChange(db);
  const delayed = Boolean(change) || shipmentStatus(repo.getNode(IDS.shipment)) === "delayed";
  const deltaDays = change?.delta_days ?? numberMeta(repo.getNode(IDS.shipment), "deltaDays");

  const included = new Map<string, GraphNode>();
  if (origin) included.set(origin.id, origin);
  if (origin) {
    for (const hit of getDownstream(db, origin.id).hits) included.set(hit.node.id, hit.node);
  }

  const edges = repo.listEdges().filter((edge) => included.has(edge.source_node_id) && included.has(edge.target_node_id));
  const incoming = new Map<string, GraphEdge>();
  for (const edge of edges) {
    if (!incoming.has(edge.target_node_id)) incoming.set(edge.target_node_id, edge);
  }

  const columns = COLUMNS.map((column) => ({
    key: column.key,
    title: column.title,
    role: column.role,
    nodes: [...included.values()]
      .filter((node) => column.types.includes(node.type))
      .map((node) => toView(db, node, column.role, incoming.get(node.id), included, impact, change, delayed))
      .sort((a, b) => a.label.localeCompare(b.label)),
  })).filter((column) => column.nodes.length > 0);

  const revenue = impact.associated_revenue;
  const cash = impact.affected_expected_cash;
  const headline = delayed && deltaDays
    ? `SUPPLIER DELAY +${deltaDays} DAYS`
    : "SUPPLIER CHAIN · ON TRACK";

  return {
    headline,
    subhead: delayed
      ? `${change?.reason || SEED_MESSAGE_SUPPLIER} Associated revenue ${formatMoney(revenue)}. Expected cash timing ${formatMoney(cash)}. These are graph facts, not a loss forecast.`
      : "Atlas Supply → SH-204 → RK-7 → three orders. Trigger the supplier delay to open the cause.",
    delayed,
    deltaDays,
    orders: impact.affected_orders.length,
    customers: impact.affected_customers.length,
    revenueLabel: formatMoney(revenue),
    cashLabel: formatMoney(cash),
    columns,
  };
}

function toView(
  db: DatabaseSync,
  node: GraphNode,
  role: CausalRole,
  edge: GraphEdge | undefined,
  included: Map<string, GraphNode>,
  impact: GraphImpact,
  change: ExpectationChangeRow | undefined,
  delayed: boolean,
): CausalNodeView {
  const parent = edge ? included.get(edge.source_node_id) : undefined;
  const amount = numberMeta(node, "amount");
  const downstream = getDownstream(db, node.id).hits.filter((hit) =>
    hit.node.type === "order" || hit.node.type === "customer" || hit.node.type === "invoice",
  );
  const path = impact.paths.find((item) => item.nodeIds.includes(node.id));
  const isShipment = node.id === IDS.shipment;
  const timestamp = isShipment && change
    ? change.created_at
    : stringMeta(node, "expectedAt") || stringMeta(node, "dueAt") || change?.created_at || "";

  let source = parent && edge ? `${parent.label} · ${edge.relationship}` : "Business graph";
  let evidence = path?.explanation || node.label;
  let confidence = edge?.confidence ?? 1;
  if (isShipment && delayed && change) {
    source = "Supplier message";
    evidence = change.reason;
    confidence = change.confidence;
  } else if (node.type === "supplier") {
    source = "Inbound supplier record";
    evidence = delayed ? SEED_MESSAGE_SUPPLIER : "No delay recorded. Shipment is still expected on the seeded date.";
  }

  return {
    id: node.id,
    type: node.type,
    label: node.label,
    role,
    relationship: edge?.relationship ?? null,
    amount,
    amountLabel: amount ? formatMoney(amount) : null,
    source,
    evidence,
    timestamp: timestamp ? formatDay(timestamp) : "",
    confidence,
    status: stringMeta(node, "status"),
    affected: downstream.slice(0, 8).map((hit) => ({
      id: hit.node.id,
      type: hit.node.type,
      label: hit.node.label,
    })),
  };
}

function latestShipmentChange(db: DatabaseSync) {
  return one<ExpectationChangeRow>(
    db,
    "SELECT * FROM expectation_changes WHERE expectation_id = ? ORDER BY created_at DESC",
    [IDS.expectShip],
  );
}

function shipmentStatus(node: GraphNode | undefined) {
  return stringMeta(node, "status");
}

function stringMeta(node: GraphNode | undefined, key: string) {
  const value = node?.metadata[key];
  return typeof value === "string" ? value : "";
}

function numberMeta(node: GraphNode | undefined, key: string) {
  const value = node?.metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
