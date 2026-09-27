import { PulseBoard } from "@/components/pulse/PulseBoard";
import type { AttentionItem } from "@/lib/attention";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";

export const dynamic = "force-dynamic";

function plainItems(items: AttentionItem[]): AttentionItem[] {
  return JSON.parse(JSON.stringify(items)) as AttentionItem[];
}

export default function PulsePage() {
  const db = getDb();
  const pulse = pulseSummary(db, getMeta(db, "demo_now"));
  return (
    <PulseBoard
      pulse={{
        now: pulse.now,
        company: pulse.company?.name ? { name: String(pulse.company.name) } : null,
        counts: {
          NEEDS_YOU: pulse.counts.NEEDS_YOU,
          MONITORING: pulse.counts.MONITORING,
          HANDLED: pulse.counts.HANDLED,
        },
        attention: {
          needsMe: plainItems(pulse.attention.needsMe),
          watching: plainItems(pulse.attention.watching),
          handled: plainItems(pulse.attention.handled),
        },
      }}
    />
  );
}
