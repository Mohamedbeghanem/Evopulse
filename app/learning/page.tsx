import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { EvidenceRow } from "@/components/ui/rows";
import { all } from "@/lib/db";
import { getDb } from "@/lib/db";
import { StrategyMemory } from "@/lib/learning";
import type { OutcomeRow } from "@/lib/learning/types";

export const dynamic = "force-dynamic";

export default function LearningPage() {
  const db = getDb();
  const outcomes = all<OutcomeRow>(db, "SELECT * FROM outcomes ORDER BY created_at DESC LIMIT 8");
  const strategies = StrategyMemory.for(db).listPatterns();
  return (
    <Workspace
      inspector={
        <InspectorPanel title="Memory">
          <p>Operational memory. Historical cases. Outcomes. Patterns. Playbooks. Proposed improvements.</p>
          <p className="mt-3">This is not silent foundation-model retraining.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Learning · Memory" title="What the business already learned">
        <p>Outcomes become memory. Policy does not rewrite itself.</p>
      </PageHeader>
      <section className="mt-8 space-y-2">
        {outcomes.map((row, index) => (
          <EvidenceRow
            key={row.id}
            index={String(index + 1).padStart(2, "0")}
            kind="OUTCOME"
            title={row.problem_type}
            fact={`${row.strategy} · ${row.result}${row.success ? " · worked" : ""}`}
          />
        ))}
      </section>
      <section className="mt-8 space-y-2">
        {strategies.slice(0, 8).map((row, index) => (
          <EvidenceRow
            key={row.id}
            index={`S${index + 1}`}
            kind="PLAYBOOK"
            title={row.strategy}
            fact={`${row.status} · ${row.successes}/${row.observations}`}
          />
        ))}
      </section>
    </Workspace>
  );
}
