import type { DatabaseSync } from "node:sqlite";
import { all } from "../db";
import type { CommitmentRow, DependencyRow, EntityRow, ExceptionRow, ExpectationRow } from "../types";

/** How far a single event may walk. Hackathon graphs are shallow; this stops cycles. */
export const DEFAULT_MAX_DEPTH = 6;

export type DependencyEdge = { from_id: string; to_id: string };

export type TraversalNode = {
  id: string;
  depth: number;
  path: string[];
};

export function dependencyEdges(db: DatabaseSync): DependencyEdge[] {
  return all<DependencyEdge>(db, "SELECT from_id, to_id FROM dependencies");
}

/**
 * Walk the relational dependency table from one node.
 * Downstream: `from` depends on `to`, so a delay at `to` reaches `from`.
 * Upstream walks back to prerequisites. Visited ids are never queued twice.
 */
export function traverseDependencies(
  edges: DependencyEdge[],
  startId: string,
  options?: { maxDepth?: number; direction?: "downstream" | "upstream" },
): TraversalNode[] {
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const direction = options?.direction ?? "downstream";
  const visited = new Set<string>([startId]);
  const queue: TraversalNode[] = [{ id: startId, depth: 0, path: [startId] }];
  const out: TraversalNode[] = [];

  while (queue.length) {
    const current = queue.shift()!;
    out.push(current);
    if (current.depth >= maxDepth) continue;
    for (const edge of edges) {
      const next =
        direction === "downstream"
          ? edge.to_id === current.id
            ? edge.from_id
            : null
          : edge.from_id === current.id
            ? edge.to_id
            : null;
      if (!next || visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, depth: current.depth + 1, path: [...current.path, next] });
    }
  }

  return out;
}

export function businessGraph(db: DatabaseSync) {
  const entities = all<EntityRow>(db, "SELECT * FROM entities");
  const commitments = all<CommitmentRow>(db, "SELECT * FROM commitments");
  const expectations = all<ExpectationRow>(db, "SELECT * FROM expectations");
  const dependencies = all<DependencyRow>(db, "SELECT * FROM dependencies");
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions");

  const nodes = [
    ...entities.map((e) => ({ id: e.id, kind: e.type, label: e.name, status: "" })),
    ...commitments.map((c) => ({
      id: c.id,
      kind: "commitment",
      label: `${c.actor === "company" ? "OUR" : "THEIR"} · ${c.description}`,
      status: c.status,
    })),
    ...expectations.map((e) => ({
      id: e.id,
      kind: "expectation",
      label: e.description,
      status: e.status,
    })),
    ...exceptions.map((e) => ({
      id: e.id,
      kind: "exception",
      label: e.title,
      status: e.attention,
    })),
  ];

  const edges = [
    { from: "ent_amine", to: "ent_atlas", label: "works at" },
    { from: "ent_opp_320k", to: "ent_atlas", label: "opportunity of" },
    { from: "ent_opp_320k", to: "ent_amine", label: "owned with" },
    { from: "cmt_send_proposal", to: "ent_opp_320k", label: "on" },
    { from: "cmt_decision_friday", to: "ent_opp_320k", label: "on" },
    { from: "exp_send_proposal", to: "cmt_send_proposal", label: "expects" },
    { from: "exp_decision_friday", to: "cmt_decision_friday", label: "expects" },
    { from: "exc_proposal_missed", to: "exp_send_proposal", label: "raised from" },
    ...dependencies.map((d) => ({ from: d.from_id, to: d.to_id, label: "depends on" })),
  ];

  return { nodes, edges };
}
