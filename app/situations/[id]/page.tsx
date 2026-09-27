import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { Aside, btn, Screen, StatusWord } from "@/components/pulse/attend";
import { attentionById, projectAttention } from "@/lib/attention";
import { formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { buildCausalExplorer } from "@/lib/engine/causal";
import { calculateGraphImpact } from "@/lib/engine/impact";
import { IDS } from "@/lib/ids";
import { exceptionDetail } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function SituationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const detail = exceptionDetail(db, id);
  const attention = attentionById(projectAttention(db, now).items, id);
  if (!detail && !attention) notFound();

  const cascade = id === IDS.excDelay || attention?.sourceExceptionId === IDS.excDelay;
  const impact = cascade ? calculateGraphImpact(db, IDS.shipment) : null;
  const causal = cascade ? buildCausalExplorer(db) : null;
  const exception = detail?.exception;
  const title = attention?.title || exception?.title || "Situation";
  const status = attention?.classification || exception?.attention || "NEEDS_YOU";
  const expectationLabel = detail?.expectation?.status.replaceAll("_", " ").toUpperCase();
  const secondaryStatus = expectationLabel === "AT RISK" || expectationLabel === "NOT MISSED" ? expectationLabel : null;

  return (
    <Screen className="flex min-h-0">
      <div className="min-w-0 max-w-[840px] flex-1 px-4 py-6 lg:px-8">
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <StatusWord value={status} />
            {secondaryStatus ? <StatusWord value={secondaryStatus} /> : null}
          </div>
          <h1 className="mt-2 text-[30px] font-semibold leading-tight tracking-tight text-[#0D1B24]">{title}</h1>
          {exception?.status ? <p className="mt-2 text-[12px] text-[#5C6B73]">{exception.status}</p> : null}
        </header>

        <section className="mt-8">
          <h2 className="text-[19px] font-semibold text-[#0D1B24]">What changed</h2>
          {exception?.evidence.expected || exception?.evidence.actual ? (
            <div className="mt-3 space-y-1">
              {exception.evidence.expected ? <p className="text-[15px] text-[#0D1B24]">Expected {exception.evidence.expected}</p> : null}
              {exception.evidence.actual ? <p className="text-[15px] text-[#0D1B24]">Actual {exception.evidence.actual}</p> : null}
            </div>
          ) : !exception && attention?.summary ? (
            <p className="mt-3 text-[15px] leading-relaxed text-[#0D1B24]">{attention.summary}</p>
          ) : null}
          {exception || attention?.layers.length ? (
            <ul className="mt-4 divide-y divide-[#D8DDD6] border-t border-[#D8DDD6]">
              {exception ? (
                <li className="py-3">
                  <p className="text-[12px] font-medium text-[#5C6B73]">01 · OBSERVED</p>
                  <p className="mt-1 text-[14px] text-[#0D1B24]">{exception.evidence.source || "Observed message"}</p>
                  {exception.evidence.quote ? <p className="mt-1 text-[14px] text-[#5C6B73]">{exception.evidence.quote}</p> : null}
                </li>
              ) : null}
              {attention?.layers.map((layer, index) => (
                <li key={`${layer.kind}-${layer.id || index}`} className="py-3">
                  <p className="text-[12px] font-medium text-[#5C6B73]">
                    {String(index + (exception ? 2 : 1)).padStart(2, "0")} · {layer.kind}
                  </p>
                  <p className="mt-1 text-[14px] text-[#0D1B24]">{layer.label}</p>
                  <p className="mt-1 text-[13px] text-[#5C6B73]">Canonical engine layer — not a second situation.</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="mt-8">
          <h2 className="text-[19px] font-semibold text-[#0D1B24]">Why it matters</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[#0D1B24]">
            {attention?.summary || exception?.evidence.actual || exception?.evidence.expected}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#5C6B73]">
            One situation. Warning, exception, impact, and autopilot collapse here.
          </p>
          {cascade ? (
            <p className="mt-2 text-[14px] leading-relaxed text-[#5C6B73]">
              Atlas Supply → SH-204 → RK-7 → 3 orders → 3 customers. Associated revenue is not a loss.
            </p>
          ) : null}
        </section>

        {cascade && impact ? (
          <section className="mt-8">
            <h2 className="text-[19px] font-semibold text-[#0D1B24]">What it affects</h2>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[12px] text-[#5C6B73]">Associated revenue</p>
                <p className="mt-1 text-[16px] font-semibold text-[#0D1B24]">{formatMoney(impact.associated_revenue, "DZD")}</p>
                <p className="mt-1 text-[13px] text-[#5C6B73]">
                  {impact.affected_orders.length} orders · {impact.affected_customers.length} customers. Not a loss.
                </p>
              </div>
              <div>
                <p className="text-[12px] text-[#5C6B73]">Expected cash timing</p>
                <p className="mt-1 text-[16px] font-semibold text-[#0D1B24]">{formatMoney(impact.affected_expected_cash, "DZD")}</p>
                <p className="mt-1 text-[13px] text-[#5C6B73]">Timing at risk if Atlas stays late.</p>
              </div>
            </div>
            {causal ? (
              <div className="mt-4">
                <p className="text-[15px] text-[#0D1B24]">Atlas Supply → Shipment SH-204 → RK-7 → 3 orders → 3 customers</p>
                <p className="mt-1 text-[13px] text-[#5C6B73]">{causal.subhead}</p>
              </div>
            ) : null}
          </section>
        ) : exception?.impact.revenueAssociated ? (
          <section className="mt-8">
            <h2 className="text-[19px] font-semibold text-[#0D1B24]">What it affects</h2>
            <div className="mt-3">
              <p className="text-[12px] text-[#5C6B73]">Associated revenue</p>
              <p className="mt-1 text-[16px] font-semibold text-[#0D1B24]">
                {formatMoney(exception.impact.revenueAssociated, exception.impact.currency)}
              </p>
              <p className="mt-1 text-[13px] text-[#5C6B73]">Needs approval before it leaves the building.</p>
            </div>
          </section>
        ) : causal ? (
          <section className="mt-8">
            <h2 className="text-[19px] font-semibold text-[#0D1B24]">What it affects</h2>
            <p className="mt-3 text-[15px] text-[#0D1B24]">Atlas Supply → Shipment SH-204 → RK-7 → 3 orders → 3 customers</p>
            <p className="mt-1 text-[13px] text-[#5C6B73]">{causal.subhead}</p>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="text-[19px] font-semibold text-[#0D1B24]">Recommended response</h2>
          {attention?.alreadyDone.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] text-[#0D1B24]">
              {attention.alreadyDone.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/explore?from=${id}`} className={btn.ghost}>
              Causal
            </Link>
            <Link href={`/simulate?from=${id}`} className={`${btn.ghost} gap-1.5`}>
              <Icon name="simulation" size={14} />
              Simulate
            </Link>
            <Link href={detail?.plan ? `/exceptions/${id}/plan` : `/goals`} className={`${btn.orange} gap-1.5`}>
              <Icon name="action" size={14} />
              Act
            </Link>
            <Link href={`/evidence/${id}`} className={`${btn.quiet} gap-1.5`}>
              <Icon name="evidence" size={14} />
              Evidence
            </Link>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-[19px] font-semibold text-[#0D1B24]">What needs you</h2>
          {attention?.needsFromYou ? <p className="mt-3 text-[15px] leading-relaxed text-[#0D1B24]">{attention.needsFromYou}</p> : null}
          <p className="mt-2 text-[13px] text-[#5C6B73]">
            <StatusWord value={status} />
          </p>
        </section>
      </div>
      <Aside title="Why this matters">
        <p className="text-[#5C6B73]">One situation. Warning, exception, impact, and autopilot collapse here.</p>
        {cascade ? (
          <p className="text-[#5C6B73]">
            Atlas Supply → SH-204 → RK-7 → 3 orders → 3 customers. Associated revenue is not a loss.
          </p>
        ) : null}
      </Aside>
    </Screen>
  );
}
