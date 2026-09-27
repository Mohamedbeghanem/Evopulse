import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionFeedback } from "@/components/ActionFeedback";
import { ApproveActionButton } from "@/components/ApproveActionButton";
import { ApproveButton } from "@/components/ApproveButton";
import { ExecuteSafeButton } from "@/components/ExecuteSafeButton";
import { Aside, btn, Metric, PageTitle, Pill, Screen } from "@/components/pulse/attend";
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
    <Screen className="flex min-h-0">
      <div className="min-w-0 max-w-[840px] flex-1 px-4 py-6 lg:px-8">
        <p className="text-[13px] text-[#0F4C5C]">
          {isDiscountBlock ? "Plan · Policy gate" : "Approval · Human gate"}
        </p>
        <PageTitle title={plan?.title || (isDiscountBlock ? "What software refuses" : "What needs human authority?")}>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>{planOutcome}</Pill>
            {plan?.status ? <Pill>{plan.status.toUpperCase()}</Pill> : null}
            <Pill>{lastVerification?.status || "PENDING"}</Pill>
            {handled ? <Pill>HANDLED</Pill> : null}
          </div>
          <p className="mt-3">{plan?.summary || exception.evidence.actual || exception.evidence.expected}</p>
        </PageTitle>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Associated opportunity"
            value={formatMoney(exception.impact.revenueAssociated || 320000, exception.impact.currency || "DZD")}
            caption="Proposal / recovery. Not revenue saved. Not lost."
          />
          <Metric
            label={isDiscountBlock ? "Requested vs ceiling" : "Policy roll-up"}
            value={isDiscountBlock ? `10% → BLOCKED` : planOutcome.replaceAll("_", " ")}
            caption={
              isDiscountBlock
                ? `discount_max=${discountMax}% · 5% + Net-14 stay inside policy`
                : `${autoActions.length} AUTO · ${approvalActions.length} approval · ${blockedActions.length} blocked`
            }
          />
          <Metric
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

        <section className="mt-8 space-y-2">
          <h2 className="text-base font-semibold">What EvoPulse wants to do</h2>
          <ol className="space-y-2">
            {actions.map((action, index) => {
              const actionPayload = asPayload(action.payload);
              const percent = typeof actionPayload.percent === "number" ? actionPayload.percent : null;
              const isTenPercent = action.type === "apply_discount" && percent === 10;
              return (
                <li key={action.id} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
                  <div className="flex items-start gap-3">
                    <p className="text-[11px] text-[#5C6B73]">{String(index + 1).padStart(2, "0")}</p>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#0D1B24]">{action.title}</p>
                      <p className="mt-1 text-sm text-[#5C6B73]">{action.description}</p>
                      <p className="mt-2 text-xs text-[#5C6B73]">{action.policy_reason}</p>
                      {isTenPercent ? (
                        <p className="mt-2 text-sm text-[#B42318]" role="status">
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
                      <Pill>{action.policy_outcome}</Pill>
                      <Pill>{action.status.toUpperCase()}</Pill>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="mt-8 space-y-3">
          <h2 className="text-base font-semibold">Policies in force</h2>
          <dl className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="grid grid-cols-1 gap-1 border-b border-[#D8DDD6] py-3 last:border-b-0 sm:grid-cols-[minmax(12rem,1fr)_4rem_minmax(0,1.4fr)] sm:items-baseline sm:gap-4"
              >
                <dt className="font-mono text-sm text-[#0D1B24]">{rule.key}</dt>
                <dd className="font-mono text-sm text-[#0F4C5C]">{rule.value}</dd>
                <dd className="text-sm text-[#5C6B73]">{rule.description}</dd>
              </div>
            ))}
          </dl>
          {isDiscountBlock ? (
            <p className="text-sm text-[#5C6B73]">
              Plan outcome rolls to BLOCKED if any action is blocked. 10% stays BLOCKED even if a human later approves 5% or Net-14.
            </p>
          ) : (
            <p className="text-sm text-[#5C6B73]">
              discount_max={discountMax}% is not in play on this 320K recovery. external_message_requires_approval rolls the plan to APPROVAL_REQUIRED.
            </p>
          )}
        </section>

        {historicalEvidence && historicalEvidence.strategies.length > 0 ? (
          <section className="mt-8 space-y-3">
            <h2 className="text-base font-semibold">Historical strategy evidence</h2>
            <p className="text-sm text-[#5C6B73]">
              Aggregated from stored outcome rows. Synthetic historical seed is marked. Not a prediction. History does not override policy.
            </p>
            <ul className="space-y-2">
              {historicalEvidence.strategies.map((item) => (
                <li key={item.strategy} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-4 py-3">
                  <span className="text-sm text-[#5C6B73]">
                    {item.label} · {item.successes}/{item.observations} observed successes ({Math.round(item.success_rate * 100)}%)
                  </span>
                  <Pill>{item.pattern_status}</Pill>
                </li>
              ))}
            </ul>
            {historicalEvidence.historically_stronger_strategy ? (
              <p className="text-sm text-[#0D1B24]">{historicalEvidence.historically_stronger_strategy.wording}</p>
            ) : null}
            <p className="text-xs text-[#5C6B73]">{historicalEvidence.note}</p>
          </section>
        ) : null}

        <p className="mt-8 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-4 py-3 text-sm text-[#5C6B73]" role="status">
          <strong className="text-[#0D1B24]">EvoPulse cannot approve itself.</strong> There is no agent path to{" "}
          <span className="font-mono">approve_action</span>. Policy is rechecked immediately before execution.
        </p>

        {blocked ? (
          <p className="mt-4 rounded-[14px] border border-[#D8DDD6] bg-[#FDECEC] px-4 py-3 text-sm text-[#B42318]" role="status">
            The 10% proposal is BLOCKED by discount_max={discountMax}%. Alternatives (5% or Net-14) stay inside policy and still need a human. There is no approve control for 10%.
          </p>
        ) : null}

        {executed ? (
          <p className="mt-4 rounded-[14px] border border-[#D8DDD6] bg-[#E7F1F3] px-4 py-3 text-sm text-[#0F4C5C]" role="status">
            Recovery executed. Verification {pendingVerification ? "PENDING — customer response expected" : lastVerification?.status || "recorded"}.
            Send alone does not mark the exception solved. Verification SUCCESS is HANDLED.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {canApprovePlan && plan ? <ApproveButton planId={plan.id} /> : null}
          {canExecuteSafe && plan ? <ExecuteSafeButton planId={plan.id} /> : null}
          <Link href={`/exceptions/${exception.id}`} className={btn.quiet}>
            Back to evidence
          </Link>
          <Link href="/policy" className={btn.quiet}>
            Open policy
          </Link>
          <Link href={`/verification/${exception.id}`} className={btn.quiet}>
            Open verification
          </Link>
        </div>

        {primaryAction && !blocked ? (
          <ActionFeedback actionId={primaryAction.id} originalStrategy={originalStrategy} />
        ) : null}
      </div>
      <Aside title={isDiscountBlock ? "Fired rule" : "Human gate"}>
        {isDiscountBlock ? (
          <>
            <p className="font-semibold text-[#0D1B24]">discount_max = {discountMax}%</p>
            <p className="text-[#5C6B73]">
              A 10% customer request is BLOCKED. Software refused it. This is governed autonomy, not an error.
            </p>
            <p className="text-[#5C6B73]">Safe alternative may be 5% (304,000 DZD) and/or Net-14 at list 320,000 DZD. Both stay APPROVAL_REQUIRED.</p>
            <p className="text-[#5C6B73]">There is no approve control for 10%. AI cannot approve itself.</p>
          </>
        ) : (
          <>
            <p className="text-[#5C6B73]">The 320,000 DZD Atlas recovery is prepared. External send stays behind approval.</p>
            <p className="text-[#5C6B73]">
              AI cannot approve itself. Policy is rechecked immediately before execution. Send is not solved.
            </p>
            <p className="text-[#5C6B73]">Verification SUCCESS is HANDLED. AUTO_HANDLED is not resolution.</p>
          </>
        )}
      </Aside>
    </Screen>
  );
}
