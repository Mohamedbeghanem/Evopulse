import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionFeedback } from "@/components/ActionFeedback";
import { ApproveButton } from "@/components/ApproveButton";
import { Badge } from "@/components/Badge";
import { InspectorField } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader, SectionHeader } from "@/components/ui/chrome";
import { PolicyBadge } from "@/components/ui/badges";
import { getDb, getMeta } from "@/lib/db";
import { buildRecoveryPlan } from "@/lib/engine/recovery";
import { exceptionDetail, policies } from "@/lib/read";
import { getSituation } from "@/lib/ui/attention";

export const dynamic = "force-dynamic";

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  try {
    buildRecoveryPlan(db, id, getMeta(db, "demo_now"));
  } catch {
    /* already exists or unknown */
  }
  const detail = exceptionDetail(db, id);
  const situation = getSituation(db, id);
  if (!detail || !situation) notFound();
  const { exception, plan, actions, historicalEvidence, verifications } = detail;
  const rules = policies(db);
  const blocked = actions.some((a) => a.policy_outcome === "BLOCKED");
  const pendingVerification = (verifications || []).find((v) => v.status === "PENDING");
  const primaryAction = actions.find((a) => a.type === "draft_message") || actions[0];
  const payload =
    primaryAction && typeof primaryAction.payload === "object" && primaryAction.payload
      ? (primaryAction.payload as { strategy?: string })
      : {};

  return (
    <Workspace
      inspectorTitle="Business source"
      inspector={
        <>
          <InspectorField label="Quote" value={`“${exception.evidence.quote}”`} />
          <InspectorField label="Source" value={exception.evidence.source} />
          <InspectorField label="Expected" value={exception.evidence.expected} />
          <InspectorField label="Actual" value={exception.evidence.actual} />
          <InspectorField label="Confidence" value={`${Math.round(exception.confidence * 100)}%`} />
          <p className="text-xs text-mute">The model cannot approve this. A human must.</p>
        </>
      }
    >
      <PageHeader
        kicker={blocked ? "Policy · BLOCKED" : "Human gate · NEEDS APPROVAL"}
        title={blocked ? "Software already refused this." : "What needs human authority?"}
      >
        <p>{plan?.summary || "Recovery is ready for a human decision."}</p>
      </PageHeader>
      <div className="mt-4 flex flex-wrap gap-2">
        {plan ? <Badge>{plan.status}</Badge> : null}
        {blocked ? <Badge>BLOCKED</Badge> : <Badge>NEEDS_APPROVAL</Badge>}
      </div>

      <section className="mt-10">
        <SectionHeader title="What EvoPulse wants to do" />
        <ol className="mt-4 divide-y divide-white/10 border-y border-white/10">
          {actions.map((action, index) => (
            <li key={action.id} className="py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-[11px] text-mute">
                  {String(index + 1).padStart(2, "0")} · {action.type}
                </p>
                <div className="flex gap-3">
                  <PolicyBadge outcome={action.policy_outcome} />
                  <Badge>{action.status}</Badge>
                </div>
              </div>
              <h2 className="mt-2 font-serif text-2xl">{action.title}</h2>
              <p className="mt-1 text-sm text-sand">{action.description}</p>
              <p className="mt-2 text-xs text-mute">{action.policy_reason}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <SectionHeader title="Policy in force" />
        <ul className="mt-4 grid gap-2 font-mono text-sm text-sand sm:grid-cols-2">
          {rules.map((rule) => (
            <li key={rule.id}>
              {rule.key} = {rule.value}
            </li>
          ))}
        </ul>
      </section>

      {historicalEvidence && historicalEvidence.strategies.length > 0 ? (
        <section className="mt-8">
          <SectionHeader title="Learning — historical evidence" />
          <p className="mt-3 text-sm text-sand">
            Aggregated from stored outcome rows. Synthetic historical seed is marked. Not silent retraining.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {historicalEvidence.strategies.map((item) => (
              <li key={item.strategy} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {item.label} · {item.successes}/{item.observations} observed successes (
                  {Math.round(item.success_rate * 100)}%)
                </span>
                <Badge>{item.pattern_status}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-mute">{historicalEvidence.note}</p>
        </section>
      ) : null}

      <div className="mt-8 space-y-4">
        {plan && plan.status !== "executed" && !blocked ? <ApproveButton planId={plan.id} /> : null}
        {plan?.status === "executed" ? (
          <p className="border border-ice/30 bg-ice/10 p-4 text-sm text-ice">
            Recovery executed. Verification {pendingVerification ? "pending — customer response expected" : "recorded"}.
            EXECUTED ≠ HANDLED.{" "}
            <Link href={`/verification/${exception.id}`} className="underline underline-offset-4">
              Open verification
            </Link>
            .
          </p>
        ) : null}
        {primaryAction && !blocked ? (
          <ActionFeedback actionId={primaryAction.id} originalStrategy={payload.strategy || "personalized_followup"} />
        ) : null}
        {blocked ? (
          <p className="border border-white/10 p-4 text-sm text-sand" role="status">
            BLOCKED is successful governance, not an application error. The 10% proposal cannot execute.{" "}
            <Link href="/policy" className="text-need underline underline-offset-4">
              Open policy alternatives
            </Link>
            .
          </p>
        ) : null}
        <Link href={`/situations/${exception.id}`} className="text-sm text-sand underline underline-offset-4">
          Back to situation
        </Link>
      </div>
    </Workspace>
  );
}
