import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { autopilotSummary, type AutopilotCard, type AutopilotState } from "@/lib/autopilot";
import { businessTwin } from "@/lib/engine/twin";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

const SECTIONS: { state: AutopilotState; title: string; caption: string; tone: string }[] = [
  { state: "NEEDS_YOU", title: "Needs you", caption: "Judgment calls. Everything else is prepared.", tone: "border-need/40 bg-need/5" },
  { state: "BLOCKED", title: "Blocked by policy", caption: "Refused — an allowed alternative is ready.", tone: "border-miss/40 bg-miss/5" },
  { state: "NEEDS_APPROVAL", title: "Needs approval", caption: "Prepared. One click to send.", tone: "border-need/20 bg-ink-800/50" },
  { state: "MONITORING", title: "Monitoring", caption: "Watching for the expected event.", tone: "border-ice/30 bg-ice/5" },
  { state: "AUTO_HANDLED", title: "Handled automatically", caption: "Low-risk, reversible, inside policy.", tone: "border-ok/20 bg-ok/5" },
  { state: "HANDLED", title: "Handled", caption: "Verified — the intervention worked.", tone: "border-ok/30 bg-ok/5" },
];

export default function PulsePage() {
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const pulse = autopilotSummary(db, now);
  const twin = businessTwin(db);
  const phase = getMeta(db, "demo_phase", "seeded");
  const supplierPhase = getMeta(db, "supplier_phase", "stable");
  const t = pulse.totals;

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-mute">{formatDay(now)} · Business Pulse</p>
          <h1 className="mt-3 font-serif text-5xl leading-[1.05] text-paper sm:text-6xl">Your business is running.</h1>
          <p className="mt-4 max-w-xl text-sand" data-testid="autopilot-headline">
            {t.eventsUnderstood} events understood · {t.requiredNothing} required nothing · {t.safelyHandled} safely
            handled · {t.monitored} monitored · {t.needYou} need you
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/command"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-paper hover:border-paper"
            >
              Protect this week
            </Link>
          </div>
        </div>
        <aside className="grid grid-cols-2 gap-3 self-start">
          <Stat label="NEED YOU" count={t.needYou} className="text-need" />
          <Stat label="SAFELY HANDLED" count={t.safelyHandled} className="text-ok" />
          <Stat label="MONITORED" count={t.monitored} className="text-ice" />
          <Stat label="REQUIRED NOTHING" count={t.requiredNothing} className="text-mute" />
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

      {SECTIONS.map((section) => {
        const cards = pulse.cards.filter((c) => c.state === section.state);
        if (!cards.length) return null;
        const compact = section.state === "AUTO_HANDLED";
        return (
          <section key={section.state} className="space-y-3">
            <div className="flex items-end justify-between">
              <h2 className="font-serif text-3xl">
                {section.title} <span className="font-mono text-base text-mute">{cards.length}</span>
              </h2>
              <p className="text-xs text-mute">{section.caption}</p>
            </div>
            {compact ? (
              <ul className="grid gap-2 md:grid-cols-3">
                {cards.map((card) => (
                  <li key={card.id} className={`rounded-xl border p-3 text-sm ${section.tone}`}>
                    <p className="text-paper">{card.title}</p>
                    <p className="mt-1 text-xs text-sand">{card.actions[0]?.title}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-3">
                {cards.map((card) => (
                  <Card key={card.id} card={card} tone={section.tone} />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <details className="rounded-2xl border border-white/10 bg-ink-800/30 p-4">
        <summary className="cursor-pointer text-sm text-sand">
          {t.requiredNothing} normal events hidden. <span className="underline underline-offset-4">View activity</span>
        </summary>
        <ol className="mt-4 space-y-2">
          {pulse.activity.map((event) => (
            <li key={event.id} className="grid gap-1 border-l border-white/10 pl-3 md:grid-cols-[11rem_12rem_1fr]">
              <span className="font-mono text-[11px] text-mute">{formatDay(event.occurred_at)}</span>
              <span className="font-mono text-xs text-paper">{event.type}</span>
              <span className="text-xs text-sand">{describe(event.payload)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-mute">Latest {pulse.activity.length} shown.</p>
      </details>

      <p className="font-mono text-xs text-mute">
        phase {phase} · supplier {supplierPhase} ·{" "}
        <Link href="/timeline" className="underline decoration-need/60 underline-offset-4">
          Time Machine
        </Link>
      </p>
    </div>
  );
}

function Card({ card, tone }: { card: AutopilotCard; tone: string }) {
  const href =
    card.id === IDS.excDelay
      ? `/impact/${card.id}`
      : card.id === IDS.excMissed && card.state === "NEEDS_YOU"
        ? `/exceptions/${card.id}/plan`
        : `/exceptions/${card.id}`;
  return (
    <article className={`rounded-2xl border p-5 ${tone}`} data-state={card.state}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{card.state}</Badge>
            <span className="font-mono text-[10px] text-mute">{card.rule}</span>
          </div>
          <h3 className="mt-3 font-serif text-2xl">{card.title}</h3>
          <p className="mt-2 text-sm text-sand">{card.reason}</p>
          {card.quote ? <p className="mt-2 text-xs italic text-mute">“{card.quote}”</p> : null}
        </div>
        {card.impactValue ? (
          <div className="text-right">
            <p className="font-mono text-2xl text-need">{formatMoney(card.impactValue, card.currency)}</p>
            <p className="text-xs text-mute">associated — not lost</p>
          </div>
        ) : null}
      </div>

      {card.actions.length ? (
        <ul className="mt-4 flex flex-wrap gap-2 text-xs">
          {card.actions.map((action) => (
            <li key={action.id} className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">
              <span className="text-sand">{action.title}</span>
              <Badge>{action.gate}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {card.earlyWarnings.length ? (
        <ul className="mt-3 space-y-1 text-xs text-ice">
          {card.earlyWarnings.map((w) => (
            <li key={w.id}>Early warning · {w.title}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-mute">
        {card.verification ? (
          <span>
            Verification <Badge>{card.verification.status}</Badge>
            {card.verification.resolvedAt ? ` · ${formatDay(card.verification.resolvedAt)}` : ` · by ${formatDay(card.verification.expectedBy)}`}
          </span>
        ) : null}
        {card.memory ? <span>Memory · {card.memory}</span> : null}
        {card.history.length > 1 ? <span>{card.history.map((h) => h.state.replaceAll("_", " ")).join(" → ")}</span> : null}
      </div>

      <Link
        href={href}
        className="mt-4 inline-flex rounded-full border border-white/15 px-4 py-2 text-sm text-paper hover:border-paper"
      >
        Open
      </Link>
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

function describe(payload: Record<string, unknown>) {
  const parts = [payload.customer, payload.order, payload.invoice, payload.task, payload.text]
    .filter((v) => typeof v === "string")
    .join(" · ");
  const amount = typeof payload.amount === "number" ? ` · ${formatMoney(payload.amount)}` : "";
  return `${parts}${amount}`;
}

function toneClass(status: string) {
  if (status === "AT_RISK") return "text-need";
  if (status === "ATTENTION") return "text-need";
  if (status === "MONITORING") return "text-ice";
  if (status === "HANDLED") return "text-ok";
  return "text-mute";
}
