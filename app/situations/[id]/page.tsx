import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { InspectorField } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { ActionBar, ImpactMetric, PageHeader, SectionHeader } from "@/components/ui/chrome";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { exceptionDetail } from "@/lib/read";
import { getSituation } from "@/lib/ui/attention";

export const dynamic = "force-dynamic";

export default async function SituationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const situation = getSituation(db, id);
  const detail = exceptionDetail(db, id);
  if (!situation || !detail) notFound();
  const { exception, expectation, commitments, dependencies, plan, actions } = detail;
  const recommended = actions[0];

  return (
    <Workspace
      inspectorTitle="Evidence"
      inspector={
        <>
          <InspectorField label="Source" value={situation.source} />
          <InspectorField label="Quote" value={`“${situation.quote}”`} />
          <InspectorField label="Expected" value={situation.expected} />
          <InspectorField label="Actual" value={situation.actual} />
          <InspectorField label="Confidence" value={`${Math.round(situation.confidence * 100)}%`} />
          <InspectorField label="Attention" value={situation.projection} />
        </>
      }
    >
      <PageHeader kicker={`Situation · ${situation.projection.replaceAll("_", " ")}`} title={situation.title}>
        <p>{situation.summary}</p>
      </PageHeader>
      <div className="mt-4 flex flex-wrap gap-2">
        <Badge>{situation.projection}</Badge>
        <Badge>{situation.kind}</Badge>
        <Badge>{situation.status}</Badge>
      </div>

      <div className="mt-10 space-y-8">
        <section>
          <SectionHeader title="What changed" />
          <blockquote className="mt-4 font-serif text-2xl leading-snug">“{situation.quote}”</blockquote>
          <p className="mt-3 text-sm text-sand">
            {situation.source}
            {expectation ? ` · due ${formatDay(expectation.due_at)}` : ""}
          </p>
        </section>

        <section>
          <SectionHeader title="Why it matters" />
          <p className="mt-4 text-sand">{exception.impact.notes}</p>
        </section>

        <section>
          <SectionHeader title="What it affects" />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <ImpactMetric label="Customers" value={String(exception.impact.customersAffected)} />
            <ImpactMetric
              label="Associated"
              value={formatMoney(situation.money?.amount ?? exception.impact.revenueAssociated, exception.impact.currency)}
              caption={situation.money?.caption}
            />
            <ImpactMetric
              label="Cash timing"
              value={
                situation.cashTiming
                  ? formatMoney(situation.cashTiming.amount, situation.cashTiming.currency)
                  : exception.impact.cashTimingAffected
                    ? "Affected"
                    : "No"
              }
              caption={situation.cashTiming ? "Expected timing — not a cash loss" : undefined}
            />
          </div>
        </section>

        <section>
          <SectionHeader title="What EvoPulse recommends" />
          <p className="mt-4 text-sand">
            {plan?.summary || recommended?.description || "No recovery plan is attached to this situation yet."}
          </p>
          {recommended ? (
            <p className="mt-2 text-sm text-mute">
              Next: {recommended.title} · {recommended.policy_outcome}
            </p>
          ) : null}
        </section>

        <section>
          <SectionHeader title="Evidence" />
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            {commitments
              .slice()
              .sort((a, b) => (a.actor === "company" ? -1 : 1))
              .map((commitment, index) => (
                <div key={commitment.id} className="flex-1 border border-white/10 p-4">
                  <Badge>{commitment.actor === "company" ? "OUR COMMITMENT" : "CUSTOMER COMMITMENT"}</Badge>
                  <p className="mt-3 font-serif text-xl">{commitment.description}</p>
                  <p className="mt-1 text-sm text-sand">
                    {formatDay(commitment.deadline)} · {commitment.status}
                  </p>
                  {index === 0 ? <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-need">depends on this</p> : null}
                </div>
              ))}
          </div>
          <p className="mt-3 text-sm text-mute">{dependencies[0]?.description || "Customer decision depends on the revised proposal."}</p>
        </section>

        <section>
          <SectionHeader title="Next action" />
          <ActionBar>
            <Link href={situation.primaryHref} className="inline-flex min-h-10 items-center rounded-full bg-need px-4 text-sm font-medium text-ink-950">
              {situation.primaryLabel}
            </Link>
            <Link href={situation.whyHref} className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm">
              Why? / Evidence
            </Link>
            {situation.id.includes("delay") || situation.kind === "delivery_delay" ? (
              <Link href="/simulate" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm">
                Simulate another 3 days
              </Link>
            ) : null}
            <Link href="/command" className="inline-flex min-h-10 items-center rounded-full border border-white/15 px-4 text-sm">
              Command
            </Link>
          </ActionBar>
        </section>
      </div>
    </Workspace>
  );
}
