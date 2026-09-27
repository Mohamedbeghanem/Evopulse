import Link from "next/link";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { StatusBadge } from "@/components/ui/badges";
import { getDb } from "@/lib/db";
import { businessTwin } from "@/lib/engine/twin";

export const dynamic = "force-dynamic";

export default function BusinessPage() {
  const twin = businessTwin(getDb());
  return (
    <Workspace
      mode="operational"
      inspector={
        <InspectorPanel title="Operating model">
          <p>Supplier, customer, company, shipment, order, invoice, commitment, expectation, goal, event, situation.</p>
          <p className="mt-3">This is the Business Twin — not a CRM contacts list.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Business · Twin" title="Connected operating model">
        <p>{twin.delayed ? "Atlas Supply is late. The twin shows what that touches." : "The operating model is connected. No CRM contacts screen."}</p>
      </PageHeader>
      <div className="mt-8 grid gap-3 md:grid-cols-2">
        {twin.domains.map((domain) => (
          <article key={domain.id} className="rounded-md border border-hairline bg-ink-800 p-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{domain.id}</p>
            <div className="mt-2">
              <StatusBadge value={domain.status} />
            </div>
            <p className="mt-3 text-sm text-sand">{domain.headline}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/graph" className="text-need">
          Graph
        </Link>
        <Link href="/policy" className="text-sand hover:text-paper">
          Policies
        </Link>
        <Link href="/learning" className="text-sand hover:text-paper">
          Learning
        </Link>
      </div>
    </Workspace>
  );
}
