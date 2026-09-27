import Link from "next/link";
import { CausalExplorer } from "@/components/CausalExplorer";
import { Workspace } from "@/components/shell/Workspace";
import { ImpactMetric, PageHeader } from "@/components/ui/chrome";
import { buildCausalExplorer } from "@/lib/engine/causal";
import { getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  const model = buildCausalExplorer(getDb());
  return (
    <Workspace mode="canvas">
      <PageHeader kicker="Causal · Why" title={model.headline}>
        <p>{model.subhead}</p>
      </PageHeader>
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ImpactMetric label="Orders" value={String(model.orders)} />
        <ImpactMetric label="Customers" value={String(model.customers)} />
        <ImpactMetric label="Associated revenue" value={model.revenueLabel} caption="Not a loss." />
        <ImpactMetric label="Expected cash timing" value={model.cashLabel} />
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
