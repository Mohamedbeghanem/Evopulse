import Link from "next/link";
import { CausalExplorer } from "@/components/CausalExplorer";
import { PageHeader } from "@/components/ui/chrome";
import { buildCausalExplorer } from "@/lib/engine/causal";
import { getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default function ExplorePage() {
  const model = buildCausalExplorer(getDb());
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader kicker="Causal explorer" title={model.headline}>
        <p>{model.subhead}</p>
      </PageHeader>
      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat k="Orders" v={String(model.orders)} />
        <Stat k="Customers" v={String(model.customers)} />
        <Stat k="Associated revenue" v={model.revenueLabel} />
        <Stat k="Expected cash timing" v={model.cashLabel} />
      </section>
      <div className="mt-8">
        <CausalExplorer model={model} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href={`/situations/${IDS.excDelay}`} className="underline underline-offset-4">
          Situation
        </Link>
        <Link href={`/impact/${IDS.excDelay}`} className="underline underline-offset-4">
          Impact numbers
        </Link>
        <Link href="/simulate" className="underline underline-offset-4">
          Simulate +3 days
        </Link>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-white/10 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-mute">{k}</p>
      <p className="mt-2 font-serif text-2xl">{v}</p>
    </div>
  );
}
