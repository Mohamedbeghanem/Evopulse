import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/Badge";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import {
  DEFAULT_PROTECT_GOAL,
  evaluateEarlyWarnings,
  formatHours,
  getWarningView,
  simulationAvailable,
} from "@/lib/engine/warnings";

export const dynamic = "force-dynamic";

export default async function WarningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  evaluateEarlyWarnings(db, getMeta(db, "demo_now"));
  const warning = getWarningView(db, id);
  if (!warning) notFound();
  const canSimulate = simulationAvailable() && warning.scenario;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Early warning</p>
        <h1 className="mt-2 max-w-3xl font-serif text-4xl sm:text-5xl">{warning.headline}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{warning.status}</Badge>
          <Badge>{warning.severity}</Badge>
          <Badge>{warning.bufferState}</Badge>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Block title="What may go wrong?">
          <p className="font-serif text-2xl leading-snug">{warning.summary}</p>
        </Block>
        <Block title="Has it failed?">
          <p className="font-serif text-2xl">{warning.failedAnswer}</p>
          {warning.exceptionId ? (
            <Link href={`/exceptions/${warning.exceptionId}`} className="mt-3 inline-block text-sm text-ice">
              Open the exception
            </Link>
          ) : null}
        </Block>
      </section>

      <Block title="Why is it at risk?">
        <p className="text-sand">{warning.explanation}</p>
        {warning.evidence.path.length ? (
          <ol className="mt-4 space-y-2">
            {warning.evidence.path.map((hop, index) => (
              <li key={hop.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-mute">{index + 1}</span>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{hop.type}</span>
                <span>{hop.label}</span>
              </li>
            ))}
          </ol>
        ) : null}
        {warning.children.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {warning.children.map((child) => (
              <li key={child.entityId} className="rounded-xl bg-ink-900/80 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{child.label}</span>
                  <Badge>{child.state}</Badge>
                </div>
                <p className="mt-1 text-mute">{child.customer}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </Block>

      <section className="grid gap-4 lg:grid-cols-2">
        <Block title="Source">
          <dl className="space-y-2 text-sm">
            <Row k="Source" v={warning.source} />
            <Row k="Confidence" v={`${Math.round(warning.confidence * 100)}%`} />
            <Row k="Entity" v={warning.entityLabel} />
          </dl>
        </Block>
        <Block title="Time">
          {warning.kind === "inactivity_window" ? (
            <dl className="space-y-2 text-sm">
              <Row k="Silence" v={warning.availableHours != null ? formatHours(warning.availableHours) : "—"} />
              <Row k="Window" v={warning.requiredHours != null ? formatHours(warning.requiredHours) : "—"} />
              <Row k="Remaining" v={warning.bufferHours != null ? formatHours(warning.bufferHours) : "—"} />
            </dl>
          ) : (
            <dl className="space-y-2 text-sm">
              <Row k="Available" v={warning.availableHours != null ? formatHours(warning.availableHours) : "—"} />
              <Row k="Required" v={warning.requiredHours != null ? formatHours(warning.requiredHours) : "—"} />
              <Row
                k={warning.shortfallHours && warning.shortfallHours > 0 ? "Shortfall" : "Buffer"}
                v={formatHours(
                  warning.shortfallHours && warning.shortfallHours > 0
                    ? warning.shortfallHours
                    : warning.bufferHours || 0,
                )}
              />
              {warning.deadlineAt ? <Row k="Deadline" v={formatDay(warning.deadlineAt)} /> : null}
              {warning.projectedAt ? <Row k="Projected" v={formatDay(warning.projectedAt)} /> : null}
            </dl>
          )}
        </Block>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Block title="Business context">
          <dl className="space-y-2 text-sm">
            <Row k="Value" v={formatMoney(warning.valueAmount, warning.currency)} />
            <Row
              k="Customer"
              v={warning.children.map((child) => child.customer).filter(Boolean).join(", ") || warning.entityLabel}
            />
            <Row
              k="Expected cash"
              v={warning.cashAmount > 0 ? formatMoney(warning.cashAmount, warning.currency) : "None linked"}
            />
          </dl>
        </Block>
        <Block title="Evidence">
          <blockquote className="font-serif text-xl leading-snug">“{warning.evidence.quote}”</blockquote>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Event" v={warning.evidence.eventType || "—"} />
            <Row k="When" v={warning.evidence.occurredAt ? formatDay(warning.evidence.occurredAt) : "—"} />
            <Row k="Event id" v={warning.evidence.eventId || "—"} />
          </dl>
        </Block>
      </section>

      <Block title="Next">
        <p className="text-sand">
          Goal context includes this warning when it is still early and high confidence: {DEFAULT_PROTECT_GOAL}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {warning.exceptionId ? (
            <Link
              href={`/exceptions/${warning.exceptionId}/plan`}
              className="rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink-950"
            >
              Open recovery plan
            </Link>
          ) : null}
          {canSimulate ? (
            <p className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-paper">
              Test a scenario · {warning.scenario?.question}
            </p>
          ) : null}
          <Link href="/warnings" className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-paper">
            All warnings
          </Link>
        </div>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
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
