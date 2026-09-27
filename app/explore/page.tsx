import Link from "next/link";
import { CausalExplorer } from "@/components/CausalExplorer";
import { buildCausalExplorer } from "@/lib/engine/causal";
import { getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  const model = buildCausalExplorer(getDb());
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Causal explorer</p>
        <h1 className="mt-2 font-serif text-5xl">{model.headline}</h1>
        <p className="mt-3 max-w-3xl text-sand">{model.subhead}</p>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Orders" v={String(model.orders)} />
        <Stat k="Customers" v={String(model.customers)} />
        <Stat k="Associated revenue" v={model.revenueLabel} />
        <Stat k="Expected cash timing" v={model.cashLabel} />
      </section>
      <CausalExplorer model={model} />
      <div className="flex flex-wrap gap-3 text-sm">
        <Link href={`/impact/${IDS.excDelay}`} className="rounded-full border border-white/15 px-4 py-2">
          Impact numbers
        </Link>
        <Link href="/graph" className="rounded-full border border-white/15 px-4 py-2">
          Full graph
        </Link>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{k}</p>
      <p className="mt-2 font-serif text-2xl">{v}</p>
    </div>
  );
}
