import type { DatabaseSync } from "node:sqlite";
import { all } from "../db";
import { graphFor } from "../graph";
import type { CommitmentRow, DependencyRow, ExceptionRow, ExpectationRow } from "../types";

export function businessGraph(db: DatabaseSync) {
  const persisted = graphFor(db);
  const commitments = all<CommitmentRow>(db, "SELECT * FROM commitments");
  const expectations = all<ExpectationRow>(db, "SELECT * FROM expectations");
  const dependencies = all<DependencyRow>(db, "SELECT * FROM dependencies");
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions");

  const nodes = [
    ...persisted.listNodes().map((n) => ({
      id: n.id,
      kind: n.type,
      label: n.label,
      status: typeof n.metadata.status === "string" ? n.metadata.status : "",
    })),
    ...commitments
      .filter((c) => !persisted.getNode(c.id))
      .map((c) => ({
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
    ...persisted.listEdges().map((e) => ({
      from: e.source_node_id,
      to: e.target_node_id,
      label: e.relationship,
    })),
    ...dependencies.map((d) => ({ from: d.from_id, to: d.to_id, label: "depends on" })),
  ];

  return { nodes, edges };
}
