import { Simulator } from "@/components/Simulator";
import { getDb } from "@/lib/db";
import { simulationTargets, stateFingerprint } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export default function SimulatePage() {
  const db = getDb();
  const targets = simulationTargets(db);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Business Simulator</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">What happens if it gets later?</h1>
        <p className="mt-3 max-w-2xl text-sand">
          EvoPulse clones the relevant slice of the live Business Twin, changes one assumption, and propagates it
          through real dependencies. Reality is never written to.
        </p>
      </div>
      <Simulator
        shipments={targets.shipments}
        source={targets.source}
        initialFingerprint={stateFingerprint(db).hash}
      />
    </div>
  );
}
