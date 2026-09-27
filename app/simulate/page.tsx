import { Simulator } from "@/components/Simulator";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { getDb } from "@/lib/db";
import { simulationTargets, stateFingerprint } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export default function SimulatePage() {
  const db = getDb();
  const targets = simulationTargets(db);
  return (
    <Workspace mode="canvas">
      <p className="sim-banner mb-6 rounded-md px-3 py-2 font-mono text-xs uppercase">Simulation · not live</p>
      <PageHeader kicker="Simulation · What if" title="What if Atlas is another 3 days late?">
        <p>LIVE, SIMULATION, and DELTA stay distinct. Reality is never written.</p>
      </PageHeader>
      <div className="mt-8">
        <Simulator
          shipments={targets.shipments}
          source={targets.source}
          initialFingerprint={stateFingerprint(db).hash}
        />
      </div>
    </Workspace>
  );
}
