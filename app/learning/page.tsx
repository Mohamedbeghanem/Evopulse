import { Badge } from "@/components/Badge";
import { PageHeader, SectionHeader } from "@/components/ui/chrome";
import { getDb } from "@/lib/db";
import { OutcomeLedger, SEED_FOLLOWUP_SIGNATURE, StrategyMemory } from "@/lib/learning";

export const dynamic = "force-dynamic";

export default function LearningPage() {
  const db = getDb();
  const evidence = StrategyMemory.for(db).getStrategyEvidence(SEED_FOLLOWUP_SIGNATURE);
  const outcomes = OutcomeLedger.for(db).listByContext(SEED_FOLLOWUP_SIGNATURE);

  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader kicker="Learning · operational memory" title="Evidence-backed memory. Not silent retraining.">
        <p>
          Rates come from stored outcome rows, including a synthetic historical seed. This is not a claim that the
          model retrained itself.
        </p>
      </PageHeader>

      <section className="mt-10">
        <SectionHeader title="Strategy evidence" />
        <ul className="mt-4 space-y-3">
          {evidence.strategies.map((item) => (
            <li key={item.strategy} className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 py-3">
              <div>
                <p className="text-paper">{item.label}</p>
                <p className="text-sm text-sand">
                  {item.successes}/{item.observations} observed successes ({Math.round(item.success_rate * 100)}%)
                </p>
              </div>
              <Badge>{item.pattern_status}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-mute">{evidence.note}</p>
      </section>

      <section className="mt-10">
        <SectionHeader title="Outcome ledger" count={outcomes.length} />
        <ul className="mt-4 space-y-2 font-mono text-xs text-mute">
          {outcomes.slice(0, 24).map((row) => (
            <li key={row.id}>
              {row.id.startsWith("syn_out_") ? "SYNTHETIC" : "LIVE"} · {row.result} · {row.strategy}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
