import Link from "next/link";
import { CausalExplorer } from "@/components/CausalExplorer";
import { presentCausalImpact } from "@/components/sim/copy";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { ImpactMetric, PageHeader } from "@/components/ui/chrome";
import { buildCausalExplorer } from "@/lib/engine/causal";
import { getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  const model = buildCausalExplorer(getDb());
  const impact = presentCausalImpact(model);
  return (
    <Workspace
      mode="canvas"
      inspector={
        <InspectorPanel title="Why this path">
          <p className="text-paper">{impact.chain}</p>
          <p className="mt-3">
            {impact.associated.value} associated revenue. {impact.cashTiming.value} expected cash timing. Neither is a
            loss.
          </p>
          <p className="mt-3 text-xs text-mute">Select a node for source, evidence, and confidence.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Causal · Why" title={model.headline}>
        <p>{impact.chain}</p>
        <p className="mt-2">{model.subhead}</p>
      </PageHeader>
      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ImpactMetric label="Orders" value={impact.orders} caption="Orders A · B · C on RK-7." />
        <ImpactMetric label="Customers" value={impact.customers} caption="Oran Fresh · Constantine Clinic · Sétif Depot." />
        <ImpactMetric label="Associated revenue" value={impact.associated.value} caption={impact.associated.caption} />
        <ImpactMetric label="Expected cash timing" value={impact.cashTiming.value} caption={impact.cashTiming.caption} />
      </section>
      <div className="mt-8">
        <CausalExplorer model={model} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link href={`/situations/${IDS.excDelay}`} className="text-need">
          Situation
        </Link>
        <Link href="/graph" className="text-sand hover:text-paper">
          Full graph
        </Link>
      </div>
    </Workspace>
  );
}
