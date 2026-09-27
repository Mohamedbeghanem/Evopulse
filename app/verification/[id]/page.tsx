import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/Badge";
import { PageHeader, SectionHeader } from "@/components/ui/chrome";
import { VerificationBadge } from "@/components/ui/badges";
import { Workspace } from "@/components/shell/Workspace";
import { InspectorField } from "@/components/shell/Inspector";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { exceptionDetail } from "@/lib/read";
import { getSituation } from "@/lib/ui/attention";

export const dynamic = "force-dynamic";

export default async function VerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const detail = exceptionDetail(db, id);
  const situation = getSituation(db, id);
  if (!detail || !situation) notFound();
  const { exception, plan, actions, verifications } = detail;
  const latest = (verifications || [])[0];
  const verificationStatus = latest?.status || "QUEUED";
  const executed = actions.filter((a) => a.status === "executed");
  const handled = situation.projection === "HANDLED";
  const monitoring = situation.projection === "MONITORING";

  return (
    <Workspace
      inspectorTitle="Verification"
      inspector={
        <>
          <InspectorField label="Exception" value={exception.title} />
          <InspectorField label="Attention" value={situation.projection} />
          <InspectorField label="Verification" value={verificationStatus} />
          <InspectorField
            label="Expected event"
            value={latest?.expected_event_type || "customer.response after execute"}
          />
          <InspectorField label="Law" value="EXECUTED ≠ HANDLED" />
        </>
      }
    >
      <PageHeader kicker="Verification · Did it work?" title="Executed is what we did. Handled is what the world confirmed.">
        <p>
          {formatMoney(exception.impact.revenueAssociated, exception.impact.currency)} remains associated opportunity
          value. Success does not invent revenue recovered. Failure does not invent revenue lost.
        </p>
      </PageHeader>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <section className="border border-white/10 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ok">Executed</p>
          <p className="mt-3 font-serif text-3xl">{executed.length ? "Actions ran" : "Nothing executed yet"}</p>
          <ul className="mt-4 space-y-2 text-sm text-sand">
            {actions.map((action) => (
              <li key={action.id}>
                {action.title} · {action.status}
              </li>
            ))}
          </ul>
        </section>
        <div className="flex items-center justify-center font-serif text-4xl text-mute" aria-hidden>
          ≠
        </div>
        <section className="border border-white/10 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ice">World</p>
          <p className="mt-3 font-serif text-3xl">
            {handled ? "Verified" : monitoring ? "Verifying" : "Not opened"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <VerificationBadge status={verificationStatus} />
            <Badge>{situation.projection}</Badge>
          </div>
          {latest ? (
            <p className="mt-3 text-sm text-sand">
              Expected {latest.expected_event_type}
              {latest.expected_by ? ` by ${formatDay(latest.expected_by)}` : ""}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-sand">Verification opens only after a verifiable action executes.</p>
          )}
        </section>
      </div>

      <section className="mt-10">
        <SectionHeader title="Lifecycle" />
        <ol className="mt-4 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.14em]">
          <li className={executed.length ? "text-paper" : "text-mute"}>Executed</li>
          <li className={monitoring || latest ? "text-ice" : "text-mute"}>Verifying</li>
          <li className={latest?.status === "SUCCESS" || handled ? "text-ok" : "text-mute"}>Verified</li>
          <li className={handled ? "text-ok" : "text-mute"}>Handled</li>
        </ol>
        {latest?.status === "FAILED" ? (
          <p className="mt-4 text-sm text-need">Failed verification reopened NEEDS YOU. It did not produce HANDLED.</p>
        ) : null}
        {plan?.status === "executed" && !handled ? (
          <p className="mt-4 text-sm text-ice">Send alone does not mark the exception solved.</p>
        ) : null}
      </section>

      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href={`/evidence/${id}`} className="underline underline-offset-4">
          Evidence
        </Link>
        <Link href={`/exceptions/${id}/plan`} className="underline underline-offset-4">
          Plan
        </Link>
      </div>
    </Workspace>
  );
}
