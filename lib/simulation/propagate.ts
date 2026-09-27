import { isAfter, maxIso, shiftDays } from "./time";
import type { BusinessSnapshot, NodeProjection, Projection, ProjectionMetrics, SimNode } from "./types";

/** Default lags when the graph carries no explicit lead time. */
const DEFAULT_LAG_DAYS: Record<string, number> = { order: 1 };
const DEFAULT_PAYMENT_TERMS_DAYS = 0;
const CLOSED_STATUSES = new Set(["fulfilled", "cancelled", "FULFILLED", "CANCELLED"]);

/**
 * Deterministic dependency propagation over the snapshot.
 *
 * Every node's time = latest time of its timed inputs + its own lag:
 *   shipment   → its expected arrival (the scenario lever)
 *   product    → available when the latest inbound shipment lands
 *   order      → delivered `lagDays` after its inputs are ready
 *   commitment → completes when its latest dependency completes; late if past deadline
 *   invoice    → cash expected max(due date, delivery + payment terms)
 *   customer   → affected when any of its orders is late
 *   cash       → invoices landing after the period end move to the next period
 *
 * No LLM, no I/O. The same function computes baseline and simulation.
 */
export function project(snapshot: BusinessSnapshot): Projection {
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, typeof snapshot.edges>();
  const outgoing = new Map<string, typeof snapshot.edges>();
  for (const edge of snapshot.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    (incoming.get(edge.to) ?? incoming.set(edge.to, []).get(edge.to)!).push(edge);
    (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge);
  }

  const nodes: Record<string, NodeProjection> = {};
  for (const node of topologicalOrder(snapshot)) {
    let critical: NodeProjection["critical"] = null;
    let maxIn: string | null = null;
    for (const edge of incoming.get(node.id) ?? []) {
      const at = nodes[edge.from]?.at ?? null;
      if (at && (!maxIn || isAfter(at, maxIn))) {
        maxIn = at;
        critical = { from: edge.from, edgeId: edge.id, relationship: edge.relationship };
      }
    }
    nodes[node.id] = projectNode(node, maxIn, critical);
  }

  for (const node of snapshot.nodes) {
    const p = nodes[node.id];
    if (!p) continue;
    if (node.type === "customer") {
      const lateOrder = (incoming.get(node.id) ?? []).find(
        (e) => byId.get(e.from)?.type === "order" && nodes[e.from]?.late,
      );
      p.late = Boolean(lateOrder);
      if (lateOrder) p.critical = { from: lateOrder.from, edgeId: lateOrder.id, relationship: lateOrder.relationship };
    }
    if (node.type === "invoice") {
      const cashEdge = (outgoing.get(node.id) ?? []).find((e) => byId.get(e.to)?.type === "cash");
      const periodEnd = cashEdge ? byId.get(cashEdge.to)?.attrs.periodEnd : undefined;
      if (periodEnd && p.at) p.inPeriod = !isAfter(p.at, periodEnd);
    }
  }

  return { nodes };
}

function projectNode(node: SimNode, maxIn: string | null, critical: NodeProjection["critical"]): NodeProjection {
  const a = node.attrs;
  const base = {
    id: node.id,
    type: node.type,
    label: node.label,
    dueAt: a.dueAt ?? null,
    amount: typeof a.amount === "number" ? a.amount : null,
  };
  const lag = a.lagDays ?? DEFAULT_LAG_DAYS[node.type] ?? 0;

  switch (node.type) {
    case "shipment": {
      const at = a.expectedAt ?? maxIn;
      return { ...base, at, late: Boolean(at && a.dueAt && isAfter(at, a.dueAt)), critical: a.expectedAt ? null : critical };
    }
    case "invoice": {
      if (!maxIn) return { ...base, at: a.dueAt ?? null, late: false, critical: null };
      const earliest = shiftDays(maxIn, a.paymentTermsDays ?? DEFAULT_PAYMENT_TERMS_DAYS);
      const at = maxIso(a.dueAt ?? null, earliest);
      return { ...base, at, late: Boolean(at && a.dueAt && isAfter(at, a.dueAt)), critical };
    }
    case "commitment": {
      const open = !CLOSED_STATUSES.has(a.status ?? "");
      return { ...base, at: maxIn, late: Boolean(open && maxIn && a.dueAt && isAfter(maxIn, a.dueAt)), critical };
    }
    case "customer":
    case "cash":
    case "supplier":
      return { ...base, at: node.type === "supplier" ? null : maxIn, late: false, critical };
    default: {
      const at = maxIn ? shiftDays(maxIn, lag) : null;
      return { ...base, at, late: Boolean(at && a.dueAt && isAfter(at, a.dueAt)), critical };
    }
  }
}

function topologicalOrder(snapshot: BusinessSnapshot): SimNode[] {
  const indegree = new Map(snapshot.nodes.map((n) => [n.id, 0]));
  for (const e of snapshot.edges) if (indegree.has(e.from) && indegree.has(e.to)) indegree.set(e.to, indegree.get(e.to)! + 1);
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n]));
  const queue = snapshot.nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order: SimNode[] = [];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(byId.get(id)!);
    for (const e of snapshot.edges) {
      if (e.from !== id || !indegree.has(e.to)) continue;
      indegree.set(e.to, indegree.get(e.to)! - 1);
      if (indegree.get(e.to) === 0) queue.push(e.to);
    }
  }
  // Cycles: process remaining nodes with whatever inputs are known (never loops forever).
  for (const node of snapshot.nodes) if (!seen.has(node.id)) order.push(node);
  return order;
}

export function metricsFor(snapshot: BusinessSnapshot, projection: Projection, originId: string): ProjectionMetrics {
  const list = snapshot.nodes.map((n) => projection.nodes[n.id]).filter(Boolean);
  const typeOf = new Map(snapshot.nodes.map((n) => [n.id, n.type]));
  const ordersLate = list
    .filter((p) => p.type === "order" && p.late)
    .map((p) => ({ id: p.id, label: p.label, amount: p.amount ?? 0 }));
  const invoices = list.filter((p) => p.type === "invoice" && p.inPeriod !== undefined);
  const cashNode = snapshot.nodes.find((n) => n.type === "cash");
  const currency =
    snapshot.nodes.map((n) => n.attrs.currency).find((c): c is string => Boolean(c)) ?? "DZD";

  // An order's own delivery deadline is a promise to the customer. It counts as a
  // commitment unless an explicit commitment node already tracks that delivery.
  const hasCommitment = new Set(
    snapshot.edges.filter((e) => typeOf.get(e.to) === "commitment").map((e) => e.from),
  );
  const deliveryPromisesMissed = list
    .filter((p) => p.type === "order" && p.dueAt && p.at && isAfter(p.at, p.dueAt) && !hasCommitment.has(p.id))
    .map((p) => ({ id: p.id, label: `Deliver ${p.label}` }));

  return {
    shipmentArrival: projection.nodes[originId]?.at ?? null,
    commitmentsMissed: [
      ...list.filter((p) => p.type === "commitment" && p.late).map((p) => ({ id: p.id, label: p.label })),
      ...deliveryPromisesMissed,
    ],
    ordersLate,
    customersAffected: list.filter((p) => p.type === "customer" && p.late).map((p) => ({ id: p.id, label: p.label })),
    revenueAtRisk: ordersLate.reduce((sum, o) => sum + o.amount, 0),
    cashInPeriod: invoices.filter((p) => p.inPeriod).reduce((sum, p) => sum + (p.amount ?? 0), 0),
    cashNextPeriod: invoices.filter((p) => !p.inPeriod).reduce((sum, p) => sum + (p.amount ?? 0), 0),
    cashPeriodEnd: cashNode?.attrs.periodEnd ?? null,
    currency,
  };
}

