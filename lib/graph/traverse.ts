import type { DatabaseSync } from "node:sqlite";
import type { GraphPath } from "../types";
import { graphFor, type GraphEdge, type GraphNode } from "./repository";

const DEFAULT_MAX_DEPTH = 12;

export type WalkHit = {
  node: GraphNode;
  depth: number;
  path: GraphPath;
};

export function getDownstream(db: DatabaseSync, nodeId: string, maxDepth = DEFAULT_MAX_DEPTH) {
  return walk(db, nodeId, "down", maxDepth);
}

export function getUpstream(db: DatabaseSync, nodeId: string, maxDepth = DEFAULT_MAX_DEPTH) {
  return walk(db, nodeId, "up", maxDepth);
}

export function getDependencies(db: DatabaseSync, nodeId: string, maxDepth = DEFAULT_MAX_DEPTH) {
  return getUpstream(db, nodeId, maxDepth);
}

export function getAffectedEntities(db: DatabaseSync, nodeId: string, maxDepth = DEFAULT_MAX_DEPTH) {
  return getDownstream(db, nodeId, maxDepth).hits;
}

function walk(db: DatabaseSync, startId: string, direction: "down" | "up", maxDepth: number) {
  const repo = graphFor(db);
  const start = repo.getNode(startId);
  if (!start) return { start: undefined, hits: [] as WalkHit[], paths: [] as GraphPath[] };

  const nodes = new Map(repo.listNodes().map((n) => [n.id, n]));
  const hits: WalkHit[] = [];
  const paths: GraphPath[] = [];
  const visited = new Set<string>([start.id]);
  const queue: { id: string; depth: number; labels: string[]; ids: string[]; rels: string[] }[] = [
    { id: start.id, depth: 0, labels: [start.label], ids: [start.id], rels: [] },
  ];

  while (queue.length) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    const edges = direction === "down" ? repo.edgesFrom(current.id) : repo.edgesTo(current.id);
    for (const edge of edges) {
      const nextId = direction === "down" ? edge.target_node_id : edge.source_node_id;
      if (visited.has(nextId)) continue;
      visited.add(nextId);
      const next = nodes.get(nextId);
      if (!next) continue;
      const ids = [...current.ids, next.id];
      const labels = [...current.labels, next.label];
      const rels = [...current.rels, edge.relationship];
      const path = toPath(ids, labels, rels);
      hits.push({ node: next, depth: current.depth + 1, path });
      paths.push(path);
      queue.push({ id: next.id, depth: current.depth + 1, labels, ids, rels });
    }
  }

  return { start, hits, paths };
}

export function pathTo(db: DatabaseSync, fromId: string, toId: string, maxDepth = DEFAULT_MAX_DEPTH): GraphPath | undefined {
  const { hits } = getDownstream(db, fromId, maxDepth);
  return hits.find((h) => h.node.id === toId || h.node.entity_id === toId)?.path;
}

export function explainPath(path: GraphPath, closer?: string): string {
  if (path.labels.length === 0) return closer || "";
  const steps = path.labels.map((label, i) => (i === 0 ? label : `${path.relationships[i - 1]} ${label}`));
  const chain = steps.join(" → ");
  return closer ? `${chain} → ${closer}` : chain;
}

function toPath(ids: string[], labels: string[], relationships: string[]): GraphPath {
  return {
    nodeIds: ids,
    labels,
    relationships,
    explanation: explainPath({ nodeIds: ids, labels, relationships, explanation: "" }),
  };
}

export function findEdge(edges: GraphEdge[], from: string, to: string) {
  return edges.find((e) => e.source_node_id === from && e.target_node_id === to);
}
