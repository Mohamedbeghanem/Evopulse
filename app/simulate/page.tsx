import { Simulator } from "@/components/Simulator";
import { getDb } from "@/lib/db";
import { simulationTargets, stateFingerprint } from "@/lib/simulation";

export const dynamic = "force-dynamic";

export default async function SimulatePage({
  searchParams,
}: {
  searchParams?: Promise<{ run?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const db = getDb();
  const targets = simulationTargets(db);
  return (
    <div className="px-6 py-8 lg:px-10">
      <Simulator
        shipments={targets.shipments}
        source={targets.source}
        initialFingerprint={stateFingerprint(db).hash}
        autoRun={params.run === "1"}
      />
    </div>
  );
}
