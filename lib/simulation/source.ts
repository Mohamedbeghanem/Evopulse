import type { DatabaseSync } from "node:sqlite";
import { all, getMeta } from "../db";
import { graphFor } from "../graph";
import type { CommitmentRow } from "../types";
import { endOfLocalWeek } from "./time";
import type { BusinessSnapshot, SimAttrs, SimNode } from "./types";

/**
 * Read the live Business Graph (PR #4: `lib/graph`) into a plain snapshot.
 *
 * Read-only: GraphRepository list calls plus one SELECT on `commitments` for
 * commitment deadlines. The snapshot is a detached copy — the simulator can
 * change it freely without any path back to SQLite.
 */
export function loadSnapshot(db: DatabaseSync): BusinessSnapshot {
  const graph = graphFor(db);
  const commitments = new Map(
    all<Pick<CommitmentRow, "id" | "deadline" | "status">>(db, "SELECT id, deadline, status FROM commitments").map(
      (c) => [c.id, c],
    ),
  );

  const nodes = graph.listNodes().map((node): SimNode => {
    const attrs = attrsFromMetadata(node.type, node.metadata);
    const commitment = node.type === "commitment" ? commitments.get(node.entity_id) : undefined;
    if (commitment) {
      attrs.dueAt = attrs.dueAt || commitment.deadline;
      attrs.status = commitment.status;
    }
    return { id: node.id, type: node.type, label: node.label, attrs };
  });
  const edges = graph.listEdges().map((edge) => ({
    id: edge.id,
    from: edge.source_node_id,
    to: edge.target_node_id,
    relationship: edge.relationship,
  }));

  return { source: "business_graph", asOf: getMeta(db, "demo_now"), nodes, edges };
}

function attrsFromMetadata(type: string, meta: Record<string, unknown>): SimAttrs {
  const str = (k: string) => (typeof meta[k] === "string" ? (meta[k] as string) : undefined);
  const num = (k: string) => {
    const value = meta[k] === undefined || meta[k] === null ? NaN : Number(meta[k]);
    return Number.isFinite(value) ? value : undefined;
  };
  const attrs: SimAttrs = {
    expectedAt: str("expectedAt"),
    originalExpectedAt: str("originalExpectedAt"),
    dueAt: str("dueAt"),
    lagDays: num("lagDays") ?? num("leadDays"),
    paymentTermsDays: num("paymentTermsDays"),
    periodEnd: str("periodEnd"),
    amount: num("amount"),
    currency: str("currency"),
    status: str("status"),
  };
  // A cash bucket without an explicit period closes at the end of its due week.
  if (type === "cash" && !attrs.periodEnd && attrs.dueAt) attrs.periodEnd = endOfLocalWeek(attrs.dueAt);
  for (const key of Object.keys(attrs) as (keyof SimAttrs)[]) if (attrs[key] === undefined) delete attrs[key];
  return attrs;
}

/**
 * Clone the target, everything downstream, then every predecessor of a kept
 * node. Predecessors' other children stay out, so a sibling input is visible
 * and a sibling's private downstream is not.
 */
export function relevantSlice(snapshot: BusinessSnapshot, targetId: string): BusinessSnapshot {
  const keep = new Set<string>([targetId]);
  const queue = [targetId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const edge of snapshot.edges) {
      if (edge.from === current && !keep.has(edge.to)) {
        keep.add(edge.to);
        queue.push(edge.to);
      }
    }
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const edge of snapshot.edges) {
      if (keep.has(edge.to) && !keep.has(edge.from)) {
        keep.add(edge.from);
        grew = true;
      }
    }
  }

  return structuredClone({
    source: snapshot.source,
    asOf: snapshot.asOf,
    nodes: snapshot.nodes.filter((n) => keep.has(n.id)),
    edges: snapshot.edges.filter((e) => keep.has(e.from) && keep.has(e.to)),
  });
}
