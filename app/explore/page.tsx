import Link from "next/link";
import { CausalExplorer } from "@/components/CausalExplorer";
import { presentCausalImpact } from "@/components/sim/copy";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { buildCausalExplorer } from "@/lib/engine/causal";
import { getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

const ghost =
  "inline-flex min-h-[34px] items-center rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 text-sm text-[#0D1B24]";

export default function ExplorePage() {
  const model = buildCausalExplorer(getDb());
  const impact = presentCausalImpact(model);
  const story = model.columns.filter((column) =>
    ["cause", "event", "dependency", "orders"].includes(column.key),
  );
  return (
    <Workspace
      mode="canvas"
      inspector={
        <InspectorPanel title="Why this path">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Selected node</p>
          <p className="mt-2 text-[#0D1B24]">{impact.chain}</p>
          <p className="mt-3 text-[#5C6B73]">
            {impact.associated.value} associated revenue. {impact.cashTiming.value} expected cash timing. Neither is a
            loss.
          </p>
          <p className="mt-3 text-xs text-[#5C6B73]">Select a node for source, evidence, and confidence.</p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Causal explorer</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">{model.headline}</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">{impact.chain}</p>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">{model.subhead}</p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Orders" value={impact.orders} caption="Orders A · B · C on RK-7." />
          <Metric label="Customers" value={impact.customers} caption="Oran Fresh · Constantine Clinic · Sétif Depot." />
          <Metric label="Associated revenue" value={impact.associated.value} caption={impact.associated.caption} />
          <Metric label="Expected cash timing" value={impact.cashTiming.value} caption={impact.cashTiming.caption} />
        </section>

        {story.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {story.map((column) => (
              <div key={column.key} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C6B73]">{column.title}</p>
                <p className="mt-2 text-sm">{column.nodes.map((node) => node.label).join(" · ")}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6">
          <CausalExplorer model={model} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/impact/${IDS.excDelay}`}
            className="inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white"
          >
            Open impact
          </Link>
          <Link href="/simulate" className={ghost}>
            Simulate +3 days
          </Link>
          <Link href={`/situations/${IDS.excDelay}`} className={ghost}>
            Situation
          </Link>
          <Link href="/graph" className={ghost}>
            Full graph
          </Link>
        </div>
      </div>
    </Workspace>
  );
}

function Metric({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C6B73]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight">{value}</p>
      {caption ? <p className="mt-1 text-xs text-[#5C6B73]">{caption}</p> : null}
    </div>
  );
}
