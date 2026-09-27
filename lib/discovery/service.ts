import type { DatabaseSync } from "node:sqlite";
import { AuthService, getWorkspace, type PublicWorkspace } from "../auth";
import { getControlDb } from "../auth/control-db";
import { id } from "../ids";
import { IntegrationService } from "../integrations/service";
import { toPlain } from "../plain";

export type DiscoveryFact = {
  id: string;
  kind: string;
  label: string;
  count: number;
  confidence: "observed" | "inferred" | "stated" | "unknown";
  source: string;
  notes: string;
};

const KINDS = [
  { kind: "customers", label: "Customers" },
  { kind: "suppliers", label: "Suppliers" },
  { kind: "orders", label: "Open orders" },
  { kind: "invoices", label: "Invoices" },
  { kind: "commitments", label: "Active commitments" },
  { kind: "expectations", label: "Expectations" },
  { kind: "goals", label: "Goals" },
  { kind: "relationships", label: "Relationships" },
] as const;

function count(db: DatabaseSync, sql: string) {
  return (db.prepare(sql).get() as { n: number }).n;
}

function entityCount(db: DatabaseSync, type: string) {
  return (db.prepare("SELECT COUNT(*) as n FROM entities WHERE type = ?").get(type) as { n: number }).n;
}

export const DiscoveryService = {
  list(workspaceId: string): DiscoveryFact[] {
    const rows = getControlDb()
      .prepare("SELECT * FROM discovery_facts WHERE workspace_id = ? ORDER BY kind")
      .all(workspaceId) as DiscoveryFact[];
    return toPlain(rows);
  },

  discover(workspaceId: string, db: DatabaseSync, workspace: PublicWorkspace) {
    const connected = IntegrationService.connectedCount(workspaceId);
    const observed = {
      customers: entityCount(db, "contact") + entityCount(db, "customer") + entityCount(db, "company"),
      suppliers: entityCount(db, "supplier"),
      orders: entityCount(db, "order") + entityCount(db, "opportunity"),
      invoices: entityCount(db, "invoice"),
      commitments: count(db, "SELECT COUNT(*) as n FROM commitments"),
      expectations: count(db, "SELECT COUNT(*) as n FROM expectations"),
      goals: count(db, "SELECT COUNT(*) as n FROM goals"),
      relationships: count(db, "SELECT COUNT(*) as n FROM graph_edges"),
    };

    const ts = new Date().toISOString();
    const facts: DiscoveryFact[] = KINDS.map(({ kind, label }) => {
      const value = observed[kind as keyof typeof observed] || 0;
      const confidence = value > 0 ? "observed" : connected > 0 ? "unknown" : workspace.industry ? "stated" : "unknown";
      const notes =
        value > 0
          ? "Counted from connected business records."
          : connected === 0
            ? "No business source connected yet. This is not a claim."
            : "Connected, but nothing of this type is visible yet.";
      return {
        id: id("dsc"),
        kind,
        label,
        count: value,
        confidence,
        source: value > 0 ? "workspace-db" : "onboarding",
        notes,
      };
    });

    const control = getControlDb();
    control.prepare("DELETE FROM discovery_facts WHERE workspace_id = ?").run(workspaceId);
    for (const fact of facts) {
      control
        .prepare(
          `INSERT INTO discovery_facts (id, workspace_id, kind, label, count, confidence, source, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(fact.id, workspaceId, fact.kind, fact.label, fact.count, fact.confidence, fact.source, fact.notes, ts, ts);
    }
    return facts;
  },

  correct(workspaceId: string, kind: string, countValue: number, notes = "") {
    const safe = Math.max(0, Math.floor(Number(countValue) || 0));
    const ts = new Date().toISOString();
    getControlDb()
      .prepare(
        `UPDATE discovery_facts
         SET count = ?, confidence = 'stated', source = 'user-correction', notes = ?, updated_at = ?
         WHERE workspace_id = ? AND kind = ?`,
      )
      .run(safe, notes || "Corrected by you. Governed user input — not an observed fact.", ts, workspaceId, kind);
    return this.list(workspaceId);
  },

  summary(workspaceId: string) {
    const facts = this.list(workspaceId);
    const workspace = getWorkspace(workspaceId);
    return {
      workspace: workspace ? AuthService.updateWorkspace(workspaceId, {}) : null,
      facts,
      observed: facts.filter((fact) => fact.confidence === "observed").length,
      inferred: facts.filter((fact) => fact.confidence !== "observed").length,
    };
  },
};
