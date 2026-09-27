import Link from "next/link";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { getDb } from "@/lib/db";
import { businessTwin } from "@/lib/engine/twin";

export const dynamic = "force-dynamic";

const ghost =
  "inline-flex min-h-[34px] items-center rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 text-sm text-[#0D1B24]";

export default function BusinessPage() {
  const twin = businessTwin(getDb());
  return (
    <Workspace
      mode="operational"
      inspector={
        <InspectorPanel title="Operating model">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Operating model</p>
          <p className="mt-2 text-[#0D1B24]">
            Supplier, customer, company, shipment, order, invoice, commitment, expectation, goal, event, situation.
          </p>
          <p className="mt-3 text-[#5C6B73]">This is the Business Twin — not a CRM contacts list.</p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Business · Twin</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">Connected operating model</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          {twin.delayed
            ? "Atlas Supply is late. The twin shows what that touches."
            : "The operating model is connected. No CRM contacts screen."}
        </p>
        <p className="mt-3 flex flex-wrap gap-4">
          <Link href="/graph" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Graph
          </Link>
          <Link href="/timeline" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Timeline
          </Link>
        </p>
        <div className="mt-8 grid gap-3 md:grid-cols-2">
          {twin.domains.map((domain) => (
            <article key={domain.id} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C6B73]">{domain.id}</p>
              <div className="mt-2">
                <StatusPill value={domain.status} />
              </div>
              <p className="mt-3 text-sm text-[#5C6B73]">{domain.headline}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-2 text-sm">
          <Link href="/graph" className={ghost}>
            Graph
          </Link>
          <Link href="/policy" className={ghost}>
            Policies
          </Link>
          <Link href="/learning" className={ghost}>
            Learning
          </Link>
        </div>
      </div>
    </Workspace>
  );
}

function StatusPill({ value }: { value: string }) {
  const v = value.toUpperCase();
  const cls = /BLOCK|FAIL|MISS/.test(v)
    ? "bg-[#FDECEC] text-[#B42318]"
    : /RISK|NEED|DELAY|OPEN|ATTENTION/.test(v)
      ? "bg-[#FDE8DC] text-[#B33A0F]"
      : /OK|HEALTH|HANDLED|SAFE|STABLE/.test(v)
        ? "bg-[#E4F3EA] text-[#1B7A4A]"
        : /WARN|MONITOR|WATCH|PENDING/.test(v)
          ? "bg-[#F8EFCC] text-[#B45309]"
          : "bg-[#E8F1F4] text-[#0F4C5C]";
  return (
    <span className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold tracking-wide ${cls}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
