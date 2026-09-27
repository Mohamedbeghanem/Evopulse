import { TwinCanvas } from "@/components/twin/TwinCanvas";
import { all, getDb, getMeta } from "@/lib/db";
import { businessGraph } from "@/lib/engine/graph";
import { businessTwin } from "@/lib/engine/twin";
import type { CommitmentRow, EventRow, ExpectationRow } from "@/lib/types";
import { listSituations } from "@/lib/ui/attention";

export const dynamic = "force-dynamic";

export default function BusinessPage() {
  const db = getDb();
  const twin = businessTwin(db);
  const graph = businessGraph(db);
  const situations = listSituations(db);
  const commitments = all<CommitmentRow>(db, "SELECT * FROM commitments");
  const expectations = all<ExpectationRow>(db, "SELECT * FROM expectations");
  const events = all<EventRow>(db, "SELECT * FROM events ORDER BY occurred_at DESC LIMIT 12");
  const delayed = getMeta(db, "supplier_phase", "stable") === "delayed";

  return (
    <TwinCanvas
      delayed={delayed}
      domains={twin.domains}
      impact={twin.impact}
      nodes={graph.nodes}
      edges={graph.edges}
      situations={situations.map((s) => ({ id: s.id, title: s.title, projection: s.projection }))}
      commitments={commitments.map((c) => ({
        id: c.id,
        label: `${c.actor === "company" ? "OUR" : "THEIR"} · ${c.description}`,
        status: c.status,
      }))}
      expectations={expectations.map((e) => ({ id: e.id, label: e.description, status: e.status }))}
      events={events.map((e) => ({ id: e.id, type: e.type, source: e.source }))}
    />
  );
}
