import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { WarningExplanationService, formatHours } from "@/lib/warnings";

export const dynamic = "force-dynamic";

export default async function WarningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const explanation = WarningExplanationService.for(getDb()).explain(id, getMeta(getDb(), "demo_now"));
  if (!explanation) notFound();
  const { warning, impact } = explanation;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Early warning</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">What may go wrong?</h1>
        <p className="mt-3 max-w-2xl text-sand">{warning.title} under current timing assumptions.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{warning.buffer_state}</Badge>
          <Badge>{warning.failed ? "FAILED" : "NOT MISSED"}</Badge>
          <Badge>{warning.status}</Badge>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Has it failed?</p>
        <p className="mt-2 font-serif text-3xl">{warning.failed ? "Yes — deadline passed." : "No."}</p>
        <p className="mt-2 text-sm text-sand">
          The customer delivery is still a future commitment unless the warning has escalated into an
          exception.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Stat label="Available" value={formatHours(warning.available_buffer_minutes)} />
        <Stat label="Required" value={formatHours(warning.required_buffer_minutes)} />
        <Stat label="Projected shortfall" value={formatHours(Math.abs(warning.shortfall_minutes))} />
      </section>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Why is it at risk?</p>
        <p className="mt-2 text-sand">{explanation.current_state.buffer.state} under current timing assumptions.</p>
        <p className="mt-2 text-sm text-mute">
          {explanation.available_buffer} available. {explanation.required_buffer} required. Projected
          shortfall {explanation.shortfall}.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">What changed?</p>
        <p className="mt-2 text-sand">
          {explanation.evidence.find((item) => item.kind === "OBSERVED")?.statement ||
            "Upstream shipment timing changed."}
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Dependency</p>
        <ol className="mt-3 space-y-2">
          {explanation.dependency_path.labels.map((label, index) => (
            <li key={`${label}-${index}`} className="font-serif text-xl">
              {label}
              {index < explanation.dependency_path.labels.length - 1 ? (
                <p className="text-xs uppercase tracking-[0.16em] text-need">↓</p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Business context</p>
        <ul className="mt-3 space-y-1 text-sm text-sand">
          <li>{impact.affected_orders} orders connected</li>
          <li>{impact.affected_customers} customers connected</li>
          <li>{formatMoney(impact.associated_revenue)} associated revenue — not a loss forecast</li>
          <li>{formatMoney(impact.affected_expected_cash)} expected cash timing affected / may shift</li>
        </ul>
        <p className="mt-3 text-xs text-mute">{impact.notes}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-3xl">Evidence</h2>
        {explanation.evidence.map((item) => (
          <div key={`${item.kind}-${item.statement}`} className="rounded-xl border border-white/10 px-4 py-3">
            <Badge>{item.kind}</Badge>
            <p className="mt-2 text-sm text-sand">{item.statement}</p>
          </div>
        ))}
      </section>

      <Link href="/warnings" className="text-sm text-sand underline underline-offset-4">
        Back to warnings
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{label}</p>
      <p className="mt-2 font-mono text-2xl text-paper">{value}</p>
    </div>
  );
}
