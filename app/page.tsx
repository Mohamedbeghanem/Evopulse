import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";
import { IDS } from "@/lib/ids";
import type { AttentionItem } from "@/lib/attention";

export const dynamic = "force-dynamic";

export default function PulsePage() {
  const db = getDb();
  const pulse = pulseSummary(db, getMeta(db, "demo_now"));
  const phase = getMeta(db, "demo_phase", "seeded");
  const supplierPhase = getMeta(db, "supplier_phase", "stable");
  const attention = pulse.attention;
  const summary = attention.summary;
  const twin = pulse.twin;
  const delay = attention.needsMe.find((item) => item.sourceExceptionId === IDS.excDelay);
  const sales = attention.needsMe.find(
    (item) => item.sourceExceptionId === IDS.excMissed || item.sourceExceptionId === IDS.excDiscount,
  );

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-mute">Sunday 27 Sep · Business Pulse</p>
          <h1 className="mt-3 font-serif text-5xl leading-[1.05] text-paper sm:text-6xl">
            {pulse.headline}
          </h1>
          <p className="mt-4 max-w-xl text-sand">
            Your business is running. {summary.eventsProcessed} events understood · {summary.autoHandled} handled
            automatically · {summary.monitoring} monitoring · {summary.needsYou + summary.needsApproval} need you.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {delay ? (
              <Link
                href={delay.href}
                className="animate-throb rounded-full bg-need px-5 py-2.5 text-sm font-medium text-ink-950"
              >
                View supplier impact
              </Link>
            ) : null}
            {sales ? (
              <Link
                href={sales.href}
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-paper hover:border-paper"
              >
                Review recovery
              </Link>
            ) : null}
            <Link
              href="/command"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-paper hover:border-paper"
            >
              Protect this week
            </Link>
          </div>
        </div>
        <aside className="grid grid-cols-2 gap-3 self-start">
          <Stat label="NEEDS YOU" count={summary.needsYou} className="text-need" />
          <Stat label="APPROVAL" count={summary.needsApproval} className="text-need" />
          <Stat label="MONITORING" count={summary.monitoring} className="text-ice" />
          <Stat label="HANDLED" count={summary.handled} className="text-ok" />
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        {twin.domains.map((domain) => (
          <div key={domain.id} className="rounded-2xl border border-white/10 bg-ink-800/40 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{domain.id}</p>
            <p className={`mt-2 font-mono text-xs ${toneClass(domain.status)}`}>{domain.status}</p>
            <p className="mt-2 text-sm text-sand">{domain.headline}</p>
          </div>
        ))}
      </section>

      <div className="rule" />

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl">What needs me?</h2>
          <p className="font-mono text-xs text-mute">
            phase {phase} · supplier {supplierPhase}
          </p>
        </div>
        {attention.needsMe.length ? (
          attention.needsMe.map((item) => <AttentionCard key={item.id} item={item} />)
        ) : (
          <p className="rounded-2xl border border-white/10 p-5 text-sand">Nothing needs you.</p>
        )}
      </section>

      {attention.watching.length ? (
        <section className="space-y-4">
          <h2 className="font-serif text-3xl">Watching</h2>
          {attention.watching.map((item) => (
            <AttentionCard key={item.id} item={item} />
          ))}
        </section>
      ) : null}

      {attention.handled.length ? (
        <section className="space-y-3">
          <h2 className="font-serif text-3xl">Handled</h2>
          {attention.handled.map((item) => (
            <article key={item.id} className="rounded-2xl border border-ok/20 bg-ok/5 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>{item.classification}</Badge>
                <Badge>{item.reasonCode}</Badge>
              </div>
              <h3 className="mt-3 font-serif text-2xl">{item.title}</h3>
              <p className="mt-2 text-sm text-sand">{item.summary}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Contact</p>
          <p className="mt-2 font-serif text-xl">{pulse.contact?.name}</p>
          <p className="text-sm text-sand">Purchasing · {pulse.company?.name}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Opportunity</p>
          <p className="mt-2 font-serif text-xl">{pulse.opportunity?.name}</p>
          <p className="text-sm text-sand">{formatMoney(320000)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Clock</p>
          <p className="mt-2 font-serif text-xl">{formatDay(pulse.now)}</p>
          <p className="text-sm text-sand">
            <Link href="/timeline" className="underline decoration-need/60 underline-offset-4">
              Open the Time Machine
            </Link>
          </p>
        </div>
      </section>

      {phase === "recovered" ? (
        <p className="rounded-2xl border border-ok/30 bg-ok/10 p-4 text-sm text-ok">
          Recovery executed. Use <span className="font-mono">Later message: 10%</span> in the demo bar to
          trigger the policy block.
        </p>
      ) : null}

      <p className="hidden font-mono text-[10px] text-mute">{IDS.excMissed}</p>
    </div>
  );
}

function AttentionCard({ item }: { item: AttentionItem }) {
  return (
    <article className="rounded-2xl border border-need/30 bg-need/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{item.classification}</Badge>
            <Badge>{item.reasonCode}</Badge>
          </div>
          <h3 className="mt-3 font-serif text-2xl">{item.title}</h3>
          <p className="mt-2 text-sm text-sand">{item.summary}</p>
          {item.impact.associatedRevenue != null ? (
            <p className="mt-2 text-sm text-sand">
              {item.impact.orders != null ? `${item.impact.orders} orders · ` : null}
              {item.impact.customers != null ? `${item.impact.customers} customers · ` : null}
              {formatMoney(item.impact.associatedRevenue, item.impact.currency)} associated
              {item.impact.expectedCash != null
                ? ` · ${formatMoney(item.impact.expectedCash, item.impact.currency)} expected cash timing`
                : null}
              . Not a loss claim.
            </p>
          ) : null}
          <ul className="mt-3 space-y-1 text-sm text-mute">
            {item.layers.map((layer) => (
              <li key={`${layer.kind}-${layer.id || layer.label}`}>
                {layer.kind}: {layer.label}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-paper">Needs you: {item.needsFromYou}</p>
        </div>
        {item.impact.associatedRevenue != null ? (
          <div className="text-right">
            <p className="font-mono text-2xl text-need">
              {formatMoney(item.impact.associatedRevenue, item.impact.currency)}
            </p>
            <p className="text-xs text-mute">associated — not lost</p>
          </div>
        ) : null}
      </div>
      <Link href={item.href} className="mt-4 inline-flex rounded-full bg-need px-4 py-2 text-sm font-medium text-ink-950">
        Review
      </Link>
      {item.autopilotDecisionId ? (
        <Link href={`/autopilot/${item.autopilotDecisionId}`} className="ml-3 text-sm underline underline-offset-4">
          Why?
        </Link>
      ) : null}
    </article>
  );
}

function Stat({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{label}</p>
      <p className={`mt-2 font-serif text-4xl ${className}`}>{count}</p>
    </div>
  );
}

function toneClass(status: string) {
  if (status === "AT_RISK") return "text-need";
  if (status === "ATTENTION") return "text-need";
  if (status === "MONITORING") return "text-ice";
  if (status === "HANDLED") return "text-ok";
  return "text-mute";
}
