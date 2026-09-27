import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionFeedback } from "@/components/ActionFeedback";
import { ApproveActionButton } from "@/components/ApproveActionButton";
import { ApproveButton } from "@/components/ApproveButton";
import { ExecuteSafeButton } from "@/components/ExecuteSafeButton";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PolicyBadge, VerificationBadge } from "@/components/ui/badges";
import { ActionBar, ImpactMetric, PageHeader } from "@/components/ui/chrome";
import { formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { buildRecoveryPlan } from "@/lib/engine/recovery";
import { exceptionDetail, policies } from "@/lib/read";

export const dynamic = "force-dynamic";

function asPayload(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

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
  const discountMax = rules.find((rule) => rule.key === "discount_max")?.value || "5";
  const blocked = actions.some((action) => action.policy_outcome === "BLOCKED");
  const autoActions = actions.filter((action) => action.policy_outcome === "AUTO");
  const approvalActions = actions.filter((action) => action.policy_outcome === "APPROVAL_REQUIRED");
  const blockedActions = actions.filter((action) => action.policy_outcome === "BLOCKED");
  const pendingVerification = (verifications || []).find((row) => row.status === "PENDING");
  const lastVerification = (verifications || [])[verifications.length - 1];
  const verificationSuccess = lastVerification?.status === "SUCCESS";
  const handled = exception.attention === "HANDLED" || verificationSuccess;
  const primaryAction = actions.find((action) => action.type === "draft_message") || actions[0];
  const payload = asPayload(primaryAction?.payload);
  const originalStrategy = typeof payload.strategy === "string" ? payload.strategy : "personalized_followup";
  const isDiscountBlock =
    exception.kind === "policy_blocked" ||
    blockedActions.some((action) => action.type === "apply_discount");
  const planOutcome = blocked ? "BLOCKED" : approvalActions.length ? "APPROVAL_REQUIRED" : autoActions.length ? "AUTO" : "PREPARED";
  const executed = plan?.status === "executed";
  const canApprovePlan = Boolean(plan && !executed && !blocked);
  const canExecuteSafe = Boolean(plan && autoActions.some((action) => action.status !== "executed"));

  return (
    <Workspace
      mode="focused"
      inspector={
        <InspectorPanel title={isDiscountBlock ? "Fired rule" : "Human gate"}>
          {isDiscountBlock ? (
            <>
              <p className="text-paper">discount_max = {discountMax}%</p>
              <p className="mt-3">
                A 10% customer request is BLOCKED. Software refused it. This is governed autonomy, not an error.
              </p>
              <p className="mt-3">Safe alternative may be 5% (304,000 DZD) and/or Net-14 at list 320,000 DZD. Both stay APPROVAL_REQUIRED.</p>
              <p className="mt-3">There is no approve control for 10%. AI cannot approve itself.</p>
            </>
          ) : (
            <>
              <p>The 320,000 DZD Atlas recovery is prepared. External send stays behind approval.</p>
              <p className="mt-3">
                AI cannot approve itself. Policy is rechecked immediately before execution. Send is not solved.
              </p>
              <p className="mt-3">Verification SUCCESS is HANDLED. AUTO_HANDLED is not resolution.</p>
            </>
          )}
        </InspectorPanel>
      }
    >
      <PageHeader
        kicker={isDiscountBlock ? "Plan · Policy gate" : "Approval · Human gate"}
        title={plan?.title || (isDiscountBlock ? "What software refuses" : "What needs human authority?")}
      >
        <div className="mt-3 flex flex-wrap gap-3">
          <PolicyBadge outcome={planOutcome} />
          {plan?.status ? <PolicyBadge outcome={plan.status.toUpperCase()} /> : null}
          <VerificationBadge status={lastVerification?.status || "PENDING"} />
          {handled ? <VerificationBadge status="HANDLED" /> : null}
        </div>
        <p className="mt-4">{plan?.summary || exception.evidence.actual || exception.evidence.expected}</p>
      </PageHeader>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <ImpactMetric
          label="Associated opportunity"
          value={formatMoney(exception.impact.revenueAssociated || 320000, exception.impact.currency || "DZD")}
          caption="Proposal / recovery. Not revenue saved. Not lost."
        />
        <ImpactMetric
          label={isDiscountBlock ? "Requested vs ceiling" : "Policy roll-up"}
          value={isDiscountBlock ? `10% → BLOCKED` : planOutcome.replaceAll("_", " ")}
          caption={
            isDiscountBlock
              ? `discount_max=${discountMax}% · 5% + Net-14 stay inside policy`
              : `${autoActions.length} AUTO · ${approvalActions.length} approval · ${blockedActions.length} blocked`
          }
        />
        <ImpactMetric
          label="Verification"
          value={handled ? "HANDLED" : lastVerification?.status || "NONE"}
          caption={
            handled
              ? "Verification SUCCESS resolved the situation."
              : pendingVerification
                ? "Executed is not handled. Waiting for the customer response."
                : "Resolution is not claimed until verification SUCCESS."
          }
        />
      </section>

      <section className="mt-10 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">What EvoPulse wants to do</p>
        <ol className="space-y-0">
          {actions.map((action, index) => {
            const actionPayload = asPayload(action.payload);
            const percent = typeof actionPayload.percent === "number" ? actionPayload.percent : null;
            const isTenPercent = action.type === "apply_discount" && percent === 10;
            return (
              <li key={action.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-3 border-b border-hairline py-4">
                <p className="font-mono text-[11px] text-mute">{String(index + 1).padStart(2, "0")}</p>
                <div className="min-w-0">
                  <p className="text-paper">{action.title}</p>
                  <p className="mt-1 text-sm text-sand">{action.description}</p>
                  <p className="mt-2 text-xs text-mute">{action.policy_reason}</p>
                  {isTenPercent ? (
                    <p className="mt-2 text-sm text-mute" role="status">
                      Cannot approve 10%. Policy discount_max={discountMax}% blocks this action. No approve control exists.
                    </p>
                  ) : null}
                  {action.policy_outcome === "APPROVAL_REQUIRED" && plan && action.status !== "executed" ? (
                    <div className="mt-3">
                      <ApproveActionButton planId={plan.id} actionId={action.id} />
                    </div>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <PolicyBadge outcome={action.policy_outcome} />
                  <PolicyBadge outcome={action.status.toUpperCase()} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-10 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Policies in force</p>
        <dl className="space-y-0">
          {rules.map((rule) => (
            <div key={rule.id} className="grid grid-cols-1 gap-1 border-b border-hairline py-3 sm:grid-cols-[minmax(12rem,1fr)_4rem_minmax(0,1.4fr)] sm:items-baseline sm:gap-4">
              <dt className="font-mono text-sm text-paper">{rule.key}</dt>
              <dd className="font-mono text-sm text-ice">{rule.value}</dd>
              <dd className="text-sm text-sand">{rule.description}</dd>
            </div>
          ))}
        </dl>
        {isDiscountBlock ? (
          <p className="text-sm text-mute">
            Plan outcome rolls to BLOCKED if any action is blocked. 10% stays BLOCKED even if a human later approves 5% or Net-14.
          </p>
        ) : (
          <p className="text-sm text-mute">
            discount_max={discountMax}% is not in play on this 320K recovery. external_message_requires_approval rolls the plan to APPROVAL_REQUIRED.
          </p>
        )}
      </section>

      {historicalEvidence && historicalEvidence.strategies.length > 0 ? (
        <section className="mt-10 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Historical strategy evidence</p>
          <p className="text-sm text-sand">
            Aggregated from stored outcome rows. Synthetic historical seed is marked. Not a prediction. History does not override policy.
          </p>
          <ul className="space-y-2">
            {historicalEvidence.strategies.map((item) => (
              <li key={item.strategy} className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline py-2">
                <span className="text-sm text-sand">
                  {item.label} · {item.successes}/{item.observations} observed successes ({Math.round(item.success_rate * 100)}%)
                </span>
                <PolicyBadge outcome={item.pattern_status} />
              </li>
            ))}
          </ul>
          {historicalEvidence.historically_stronger_strategy ? (
            <p className="text-sm text-paper">{historicalEvidence.historically_stronger_strategy.wording}</p>
          ) : null}
          <p className="text-xs text-mute">{historicalEvidence.note}</p>
        </section>
      ) : null}

      <p className="mt-10 rounded-md border border-hairline bg-ink-800 px-4 py-3 text-sm text-sand" role="status">
        <strong className="text-paper">EvoPulse cannot approve itself.</strong> There is no agent path to{" "}
        <span className="font-mono">approve_action</span>. Policy is rechecked immediately before execution.
      </p>

      {blocked ? (
        <p className="mt-4 rounded-md border border-hairline px-4 py-3 text-sm text-mute" role="status">
          The 10% proposal is BLOCKED by discount_max={discountMax}%. Alternatives (5% or Net-14) stay inside policy and still need a human. There is no approve control for 10%.
        </p>
      ) : null}

      {executed ? (
        <p className="mt-4 rounded-md border border-hairline px-4 py-3 text-sm text-ice" role="status">
          Recovery executed. Verification {pendingVerification ? "PENDING — customer response expected" : lastVerification?.status || "recorded"}.
          Send alone does not mark the exception solved. Verification SUCCESS is HANDLED.
        </p>
      ) : null}

      <div className="mt-8">
        <ActionBar>
          {canApprovePlan && plan ? <ApproveButton planId={plan.id} /> : null}
          {canExecuteSafe && plan ? <ExecuteSafeButton planId={plan.id} /> : null}
          <Link href={`/exceptions/${exception.id}`} className="inline-flex min-h-8 items-center px-4 text-sm text-need">
            Back to evidence
          </Link>
          <Link href="/policy" className="inline-flex min-h-8 items-center px-4 text-sm text-sand">
            Open policy
          </Link>
          <Link href={`/verification/${exception.id}`} className="inline-flex min-h-8 items-center px-4 text-sm text-sand">
            Open verification
          </Link>
        </ActionBar>
      </div>

      {primaryAction && !blocked ? (
        <ActionFeedback actionId={primaryAction.id} originalStrategy={originalStrategy} />
      ) : null}
    </Workspace>
  );
}
