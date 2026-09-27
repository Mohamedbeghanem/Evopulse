import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { all, getDb } from "@/lib/db";
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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Memory</p>
          <p className="mt-2 text-[#0D1B24]">Operational memory. Historical cases. Outcomes. Patterns. Playbooks. Proposed improvements.</p>
          <p className="mt-3 text-[#5C6B73]">This is not silent foundation-model retraining.</p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Learning · Memory</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">What the business already learned</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          Outcomes become memory. Policy does not rewrite itself.
        </p>
        <section className="mt-8 space-y-2">
          <h2 className="text-base font-semibold">Outcomes</h2>
          {outcomes.map((row, index) => (
            <article key={row.id} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-3.5">
              <h3 className="text-[15px] font-semibold">
                {String(index + 1).padStart(2, "0")} {row.problem_type}
              </h3>
              <p className="mt-1 text-[13px] text-[#5C6B73]">
                OUTCOME · {row.strategy} · {row.result}
                {row.success ? " · worked" : ""}
              </p>
            </article>
          ))}
        </section>
        <section className="mt-8 space-y-2">
          <h2 className="text-base font-semibold">Playbooks</h2>
          {strategies.slice(0, 8).map((row, index) => (
            <article key={row.id} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-3.5">
              <h3 className="text-[15px] font-semibold">
                S{index + 1} {row.strategy}
              </h3>
              <p className="mt-1 text-[13px] text-[#5C6B73]">
                PLAYBOOK · {row.status} · {row.successes}/{row.observations}
              </p>
            </article>
          ))}
        </section>
      </div>
    </Workspace>
  );
}
