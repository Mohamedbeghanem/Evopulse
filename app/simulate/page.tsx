import { Simulator } from "@/components/Simulator";
import { SIMULATION_BANNER } from "@/components/sim/copy";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Integrity</p>
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C6B73]">Lever</p>
          <p className="mt-2 text-[#0D1B24]">supplier_delay · SH-204 · +3 days</p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C6B73]">Financial semantics</p>
          <p className="mt-2 text-[#5C6B73]">
            When the engine reclassifies cash, the DELTA is invoice timing — Invoice C 160,000 DZD in the canonical +3
            day Atlas run. The live 540,000 DZD week total does not move as a block.
          </p>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C6B73]">Isolation</p>
          <p className="mt-2 text-[#5C6B73]">
            Simulation never writes live state. Exit compares fingerprint{" "}
            <span className="font-mono text-[#0D1B24]">{fingerprint.hash}</span>.
          </p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="mb-6 rounded-[14px] border border-[#0F4C5C]/30 bg-[#E8F1F4] px-3 py-2 font-mono text-xs uppercase text-[#0F4C5C]">
          {SIMULATION_BANNER}
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Business Simulator</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">What if Atlas is another 3 days late?</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          LIVE, SIMULATION, and DELTA stay distinct. Reality is never written.
        </p>
        <div className="mt-8">
          <Simulator
            shipments={targets.shipments}
            source={targets.source}
            initialFingerprint={fingerprint.hash}
          />
        </div>
      </div>
    </Workspace>
  );
}
