import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { exceptionDetail } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function ExceptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = exceptionDetail(getDb(), id);
  if (!detail) notFound();
  const { exception, expectation, commitment, dependencies, commitments, opportunity } = detail;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-mute">Exception</p>
          <h1 className="mt-2 max-w-3xl font-serif text-4xl sm:text-5xl">{exception.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge>{exception.attention}</Badge>
            <Badge>{exception.kind}</Badge>
            <Badge>{exception.status}</Badge>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-3xl text-need">
            {formatMoney(exception.impact.revenueAssociated, exception.impact.currency)}
          </p>
          <p className="text-xs text-mute">business impact</p>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Evidence</p>
          <blockquote className="mt-3 font-serif text-2xl leading-snug text-paper">
            “{exception.evidence.quote}”
          </blockquote>
          <dl className="mt-5 space-y-2 text-sm">
            <Row k="Source" v={exception.evidence.source} />
            <Row k="Expected" v={exception.evidence.expected} />
            <Row k="Actual" v={exception.evidence.actual} />
            <Row k="Deal" v={exception.evidence.deal} />
            <Row k="Confidence" v={`${Math.round(exception.confidence * 100)}%`} />
            <Row k="Model" v={commitment?.model || "heuristic-v1"} />
          </dl>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Impact</p>
          <ul className="mt-4 space-y-3 text-sm">
            <li>Customers affected · {exception.impact.customersAffected}</li>
            <li>Opportunities affected · {exception.impact.opportunitiesAffected}</li>
            <li>
              Revenue associated ·{" "}
              {formatMoney(exception.impact.revenueAssociated, exception.impact.currency)}
            </li>
            <li>Cash timing affected · {exception.impact.cashTimingAffected ? "Yes" : "No"}</li>
            <li>Urgency · {exception.impact.urgency}</li>
          </ul>
          <p className="mt-4 text-xs text-mute">{exception.impact.notes}</p>
          {opportunity ? (
            <p className="mt-4 text-sm text-sand">
              Opportunity: {opportunity.name}
              {expectation ? ` · due ${formatDay(expectation.due_at)}` : ""}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Dependency chain</p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-stretch">
          {commitments
            .slice()
            .sort((a, b) => (a.actor === "company" ? -1 : 1))
            .map((c, index) => (
              <div key={c.id} className="flex-1 rounded-xl bg-ink-800/70 p-4">
                <Badge>{c.actor === "company" ? "OUR COMMITMENT" : "CUSTOMER COMMITMENT"}</Badge>
                <p className="mt-3 font-serif text-xl">{c.description}</p>
                <p className="mt-1 text-sm text-sand">
                  {formatDay(c.deadline)} · {c.status}
                </p>
                {index === 0 ? (
                  <p className="mt-3 text-xs uppercase tracking-[0.16em] text-need">depends on this →</p>
                ) : null}
              </div>
            ))}
        </div>
        <p className="mt-3 text-sm text-mute">
          {dependencies[0]?.description || "Customer decision depends on the revised proposal."}
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        {exception.kind === "delivery_delay" ? (
          <Link
            href={`/impact/${exception.id}`}
            className="rounded-full bg-need px-5 py-2.5 text-sm font-medium text-ink-950"
          >
            View impact cascade
          </Link>
        ) : null}
        {exception.kind !== "delivery_delay" ? (
          <Link
            href={`/exceptions/${exception.id}/plan`}
            className="rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink-950"
          >
            Open recovery plan
          </Link>
        ) : null}
        <Link
          href="/graph"
          className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-paper"
        >
          Commitment graph
        </Link>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-mute">{k}</dt>
      <dd className="text-right text-paper">{v}</dd>
    </div>
  );
}
