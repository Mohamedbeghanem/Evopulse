import Link from "next/link";
import { notFound } from "next/navigation";
import { Metric, PageTitle, Pill, rowCard, Screen } from "@/components/pulse/attend";
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
    <Screen>
      <div className="max-w-[920px] space-y-6 px-4 py-6 lg:px-8">
        <PageTitle title="What may go wrong?">
          <p>{warning.title} under current timing assumptions.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>{warning.buffer_state}</Pill>
            <Pill>{warning.failed ? "FAILED" : "NOT MISSED"}</Pill>
            <Pill>{warning.status}</Pill>
          </div>
        </PageTitle>

        <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
          <p className="text-[13px] text-[#5C6B73]">Has it failed?</p>
          <p className="mt-1 text-[22px] font-semibold tracking-tight text-[#0D1B24]">
            {warning.failed ? "Yes — deadline passed." : "No."}
          </p>
          <p className="mt-2 text-sm text-[#5C6B73]">
            The customer delivery is still a future commitment unless the warning has escalated into an
            exception.
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Metric label="Available" value={formatHours(warning.available_buffer_minutes)} />
          <Metric label="Required" value={formatHours(warning.required_buffer_minutes)} />
          <Metric label="Projected shortfall" value={formatHours(Math.abs(warning.shortfall_minutes))} />
        </section>

        <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
          <p className="text-[13px] text-[#5C6B73]">Why is it at risk?</p>
          <p className="mt-2 text-[#0D1B24]">{explanation.current_state.buffer.state} under current timing assumptions.</p>
          <p className="mt-2 text-sm text-[#5C6B73]">
            {explanation.available_buffer} available. {explanation.required_buffer} required. Projected
            shortfall {explanation.shortfall}.
          </p>
        </section>

        <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
          <p className="text-[13px] text-[#5C6B73]">What changed?</p>
          <p className="mt-2 text-[#0D1B24]">
            {explanation.evidence.find((item) => item.kind === "OBSERVED")?.statement ||
              "Upstream shipment timing changed."}
          </p>
        </section>

        <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
          <h2 className="text-base font-semibold">Dependency</h2>
          <ol className="mt-3 space-y-2">
            {explanation.dependency_path.labels.map((label, index) => (
              <li key={`${label}-${index}`} className="text-[15px] font-medium text-[#0D1B24]">
                {label}
                {index < explanation.dependency_path.labels.length - 1 ? (
                  <p className="text-xs text-[#EC6025]">↓</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
          <h2 className="text-base font-semibold">Business context</h2>
          <ul className="mt-3 space-y-1 text-sm text-[#5C6B73]">
            <li>{impact.affected_orders} orders connected</li>
            <li>{impact.affected_customers} customers connected</li>
            <li>{formatMoney(impact.associated_revenue)} associated revenue — not a loss forecast</li>
            <li>{formatMoney(impact.affected_expected_cash)} expected cash timing affected / may shift</li>
          </ul>
          <p className="mt-3 text-xs text-[#5C6B73]">{impact.notes}</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-semibold">Evidence</h2>
          {explanation.evidence.map((item) => (
            <div key={`${item.kind}-${item.statement}`} className={rowCard(false)}>
              <div>
                <Pill>{item.kind}</Pill>
                <p className="mt-2 text-sm text-[#5C6B73]">{item.statement}</p>
              </div>
            </div>
          ))}
        </section>

        <Link href="/warnings" className="inline-block text-sm text-[#5C6B73] underline underline-offset-4">
          Back to warnings
        </Link>
      </div>
    </Screen>
  );
}
