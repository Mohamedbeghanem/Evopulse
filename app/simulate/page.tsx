import { Simulator } from "@/components/Simulator";
import { SIMULATION_BANNER } from "@/components/sim/copy";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { getDb } from "@/lib/db";
import { simulationTargets, stateFingerprint } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export default function SimulatePage() {
  const db = getDb();
  const targets = simulationTargets(db);
  const fingerprint = stateFingerprint(db);
  return (
    <Workspace
      mode="canvas"
      inspector={
        <InspectorPanel title="Scenario · clone">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Lever</p>
          <p className="mt-2 text-paper">supplier_delay · SH-204 · +3 days</p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Financial semantics</p>
          <p className="mt-2">
            When the engine reclassifies cash, the DELTA is invoice timing — Invoice C 160,000 DZD in the canonical +3
            day Atlas run. The live 540,000 DZD week total does not move as a block.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Isolation</p>
          <p className="mt-2">
            Simulation never writes live state. Exit compares fingerprint{" "}
            <span className="font-mono text-paper">{fingerprint.hash}</span>.
          </p>
        </InspectorPanel>
      }
    >
      <p className="sim-banner mb-6 rounded-md px-3 py-2 font-mono text-xs uppercase">{SIMULATION_BANNER}</p>
      <PageHeader kicker="Simulation · What if" title="What if Atlas is another 3 days late?">
        <p>LIVE, SIMULATION, and DELTA stay distinct. Reality is never written.</p>
      </PageHeader>
      <div className="mt-8">
        <Simulator
          shipments={targets.shipments}
          source={targets.source}
          initialFingerprint={fingerprint.hash}
        />
      </div>
    </Workspace>
  );
}
