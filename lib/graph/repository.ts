import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import type { GraphEdgeRow, GraphNodeRow } from "../types";

export type GraphNode = {
  id: string;
  type: string;
  entity_id: string;
  label: string;
  metadata: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relationship: string;
  source_event_id: string | null;
  confidence: number;
  metadata: Record<string, unknown>;
};

export class GraphRepository {
  constructor(private readonly db: DatabaseSync) {}

  upsertNode(node: {
    id: string;
    type: string;
    entity_id: string;
    label: string;
    metadata?: Record<string, unknown>;
  }) {
    run(
      this.db,
      `INSERT INTO graph_nodes (id, type, entity_id, label, metadata)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET type = excluded.type, label = excluded.label, metadata = excluded.metadata`,
      [node.id, node.type, node.entity_id, node.label, JSON.stringify(node.metadata ?? {})],
    );
  }

  upsertEdge(edge: {
    id: string;
    source_node_id: string;
    target_node_id: string;
    relationship: string;
    source_event_id?: string | null;
    confidence?: number;
    metadata?: Record<string, unknown>;
  }) {
    run(
      this.db,
      `INSERT INTO graph_edges (id, source_node_id, target_node_id, relationship, source_event_id, confidence, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         relationship = excluded.relationship,
         source_event_id = excluded.source_event_id,
         confidence = excluded.confidence,
         metadata = excluded.metadata`,
      [
        edge.id,
        edge.source_node_id,
        edge.target_node_id,
        edge.relationship,
        edge.source_event_id ?? null,
        edge.confidence ?? 1,
        JSON.stringify(edge.metadata ?? {}),
      ],
    );
  }

  getNode(id: string): GraphNode | undefined {
    const row = one<GraphNodeRow>(this.db, "SELECT * FROM graph_nodes WHERE id = ? OR entity_id = ?", [id, id]);
    return row ? toNode(row) : undefined;
  }

  listNodes(): GraphNode[] {
    return all<GraphNodeRow>(this.db, "SELECT * FROM graph_nodes").map(toNode);
  }

  listEdges(): GraphEdge[] {
    return all<GraphEdgeRow>(this.db, "SELECT * FROM graph_edges").map(toEdge);
  }

  edgesFrom(nodeId: string): GraphEdge[] {
    return all<GraphEdgeRow>(this.db, "SELECT * FROM graph_edges WHERE source_node_id = ?", [nodeId]).map(toEdge);
  }

  edgesTo(nodeId: string): GraphEdge[] {
    return all<GraphEdgeRow>(this.db, "SELECT * FROM graph_edges WHERE target_node_id = ?", [nodeId]).map(toEdge);
  }
}

export function graphFor(db: DatabaseSync) {
  return new GraphRepository(db);
}

function toNode(row: GraphNodeRow): GraphNode {
  return {
    id: row.id,
    type: row.type,
    entity_id: row.entity_id,
    label: row.label,
    metadata: parseObj(row.metadata),
  };
}

function toEdge(row: GraphEdgeRow): GraphEdge {
  return {
    id: row.id,
    source_node_id: row.source_node_id,
    target_node_id: row.target_node_id,
    relationship: row.relationship,
    source_event_id: row.source_event_id,
    confidence: row.confidence,
    metadata: parseObj(row.metadata),
  };
}

function parseObj(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
