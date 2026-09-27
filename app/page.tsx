import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default function PulsePage() {
  const db = getDb();
  const pulse = pulseSummary(db, getMeta(db, "demo_now"));
  const phase = getMeta(db, "demo_phase", "seeded");
  const primary = pulse.exceptions.find((e) => e.attention === "NEEDS_YOU") || pulse.exceptions[0];

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-mute">Sunday 27 Sep · Atlas Retail</p>
          <h1 className="mt-3 font-serif text-5xl leading-[1.05] text-paper sm:text-6xl">
            {pulse.headline}
          </h1>
          <p className="mt-4 max-w-xl text-sand">
            Expected versus actual. The Thursday proposal never left, so Friday&apos;s 320K decision is blocked.
            EvoPulse is not asking you to scan a dashboard — it is asking you to recover one promise.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {primary ? (
              <Link
                href={`/exceptions/${primary.id}`}
                className="animate-throb rounded-full bg-need px-5 py-2.5 text-sm font-medium text-ink-950"
              >
                Review exception
              </Link>
            ) : null}
            <Link
              href="/command"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-paper hover:border-paper"
            >
              Ask EvoPulse
            </Link>
          </div>
        </div>
        <aside className="grid grid-cols-2 gap-3 self-start">
          <Stat label="NEEDS YOU" count={pulse.counts.NEEDS_YOU} className="text-need" />
          <Stat label="HANDLED" count={pulse.counts.HANDLED} className="text-ok" />
          <Stat label="MONITORING" count={pulse.counts.MONITORING} className="text-ice" />
          <Stat label="HEALTHY" count={pulse.counts.HEALTHY} className="text-mute" />
        </aside>
      </section>

      <div className="rule" />

      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-3xl">Critical</h2>
          <p className="font-mono text-xs text-mute">phase {phase}</p>
        </div>
        <div className="space-y-3">
          {pulse.exceptions.map((exception) => (
            <Link
              key={exception.id}
              href={`/exceptions/${exception.id}`}
              className="block rounded-2xl border border-white/10 bg-ink-800/50 p-5 transition hover:border-need/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{exception.attention}</Badge>
                    <Badge>{exception.status}</Badge>
                  </div>
                  <h3 className="mt-3 font-serif text-2xl">{exception.title}</h3>
                  <p className="mt-1 text-sm text-sand">{exception.evidence.quote}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl text-need">
                    {formatMoney(exception.impact.revenueAssociated, exception.impact.currency)}
                  </p>
                  <p className="text-xs text-mute">associated opportunity</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

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

function Stat({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{label}</p>
      <p className={`mt-2 font-serif text-4xl ${className}`}>{count}</p>
    </div>
  );
}
