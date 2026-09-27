import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionFeedback } from "@/components/ActionFeedback";
import { ApproveButton } from "@/components/ApproveButton";
import { Badge } from "@/components/Badge";
import { getDb, getMeta } from "@/lib/db";
import { buildRecoveryPlan } from "@/lib/engine/recovery";
import { exceptionDetail } from "@/lib/read";
import { policies } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  try {
    buildRecoveryPlan(db, id, getMeta(db, "demo_now"));
  } catch {
    /* already exists or unknown */
  }
  const detail = exceptionDetail(db, id);
  if (!detail) notFound();
  const { exception, plan, actions, historicalEvidence, verifications } = detail;
  const rules = policies(db);
  const blocked = actions.some((a) => a.policy_outcome === "BLOCKED");
  const pendingVerification = (verifications || []).find((v) => v.status === "PENDING");
  const primaryAction = actions.find((a) => a.type === "draft_message") || actions[0];
  const payload =
    primaryAction && typeof primaryAction.payload === "object" && primaryAction.payload
      ? (primaryAction.payload as { strategy?: string })
      : {};
  const originalStrategy = payload.strategy || "personalized_followup";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Recovery</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{plan?.title || "Recovery plan"}</h1>
        <p className="mt-3 max-w-2xl text-sand">{plan?.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {plan ? <Badge>{plan.status}</Badge> : null}
          {blocked ? <Badge>BLOCKED</Badge> : <Badge>APPROVAL_REQUIRED</Badge>}
        </div>
      </div>

      <ol className="space-y-3">
        {actions.map((action, index) => (
          <li key={action.id} className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-xs text-mute">
                {String(index + 1).padStart(2, "0")} · {action.type}
              </p>
              <div className="flex gap-2">
                <Badge>{action.policy_outcome}</Badge>
                <Badge>{action.status}</Badge>
              </div>
            </div>
            <h2 className="mt-2 font-serif text-2xl">{action.title}</h2>
            <p className="mt-1 text-sm text-sand">{action.description}</p>
            <p className="mt-3 text-xs text-mute">{action.policy_reason}</p>
          </li>
        ))}
      </ol>

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Policies in force</p>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {rules.map((rule) => (
            <li key={rule.id} className="font-mono text-sand">
              {rule.key} = {rule.value}
            </li>
          ))}
        </ul>
      </section>

      {historicalEvidence && historicalEvidence.strategies.length > 0 ? (
        <section className="rounded-2xl border border-white/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Historical strategy evidence</p>
          <p className="mt-2 text-sm text-sand">
            Aggregated from stored outcome rows. Synthetic historical seed is marked. Not a prediction.
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
          {historicalEvidence.historically_stronger_strategy ? (
            <p className="mt-4 text-sm text-paper">
              {historicalEvidence.historically_stronger_strategy.wording}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-mute">{historicalEvidence.note}</p>
        </section>
      ) : null}

      {plan && plan.status !== "executed" && !blocked ? <ApproveButton planId={plan.id} /> : null}
      {plan?.status === "executed" ? (
        <p className="rounded-2xl border border-ok/30 bg-ok/10 p-4 text-sm text-ok">
          Recovery executed. Verification {pendingVerification ? "pending — customer response expected" : "recorded"}.
          Send alone does not mark the exception solved. Use the demo bar to ingest “I&apos;ll sign today if you
          give me 10%.”
        </p>
      ) : null}
      {primaryAction && !blocked ? (
        <ActionFeedback actionId={primaryAction.id} originalStrategy={originalStrategy} />
      ) : null}
      {blocked ? (
        <p className="rounded-2xl border border-miss/30 bg-miss/10 p-4 text-sm text-miss">
          The 10% proposal is BLOCKED. Alternatives (5% or Net-14) stay inside policy. Humans still
          govern the send.
        </p>
      ) : null}

      <Link href={`/exceptions/${exception.id}`} className="text-sm text-sand underline underline-offset-4">
        Back to evidence
      </Link>
    </div>
  );
}
