import Link from "next/link";
import { notFound } from "next/navigation";
import { Aside, btn, PageTitle, Pill, Screen } from "@/components/pulse/attend";
import { getDb } from "@/lib/db";
import { ExceptionAutopilotService } from "@/lib/autopilot";

export const dynamic = "force-dynamic";

const STEPS = [
  ["OBSERVED", "observed"],
  ["DETECTED", "detected"],
  ["IMPACT", "impact"],
  ["PLAN", "plan"],
  ["POLICY", "policy"],
  ["AUTOPILOT", "autopilot"],
  ["CURRENT", "current"],
] as const;

function verificationFromState(state: string) {
  if (state === "HANDLED") return "SUCCESS";
  if (state === "MONITORING") return "PENDING";
  if (state === "AUTO_HANDLED") return "AUTO_HANDLED";
  return "NONE";
}

function policyFromState(state: string, reason: string) {
  if (state === "BLOCKED" || reason === "POLICY_BLOCKED") return "BLOCKED";
  if (state === "NEEDS_APPROVAL") return "APPROVAL_REQUIRED";
  if (reason === "SAFE_INTERNAL_ACTION") return "AUTO";
  return state === "HANDLED" ? "AUTO" : state;
}

export default async function AutopilotTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = ExceptionAutopilotService.for(getDb()).explain(id);
  if (!trace) notFound();
  const current = trace.current;
  const reason = trace.decision.reasonCode;
  const policy = policyFromState(current, reason);
  const verification = verificationFromState(current);
  const autoHandled = current === "AUTO_HANDLED" || reason === "SAFE_INTERNAL_ACTION";
  const handled = current === "HANDLED" || reason === "VERIFIED_RESOLVED";
  const blocked = policy === "BLOCKED";
  const needsApproval = current === "NEEDS_APPROVAL";

  return (
    <Screen className="flex min-h-0">
      <div className="min-w-0 max-w-[840px] flex-1 px-4 py-6 lg:px-8">
        <PageTitle title="Why did EvoPulse do this?">
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill>{current}</Pill>
            <Pill>{policy}</Pill>
            <Pill>{verification}</Pill>
            <Pill>{reason}</Pill>
          </div>
          <p className="mt-3">{trace.decision.whyItMatters || trace.decision.happened}</p>
        </PageTitle>

        {autoHandled ? (
          <p className="mt-6 rounded-[14px] border border-[#D8DDD6] bg-[#E7F1F3] px-4 py-3 text-sm text-[#0F4C5C]" role="status">
            This classification is AUTO_HANDLED. A policy-AUTO internal action executed. That is not verification of the business outcome. Verification SUCCESS is HANDLED.
          </p>
        ) : null}
        {handled ? (
          <p className="mt-6 rounded-[14px] border border-[#D8DDD6] bg-[#E8F6EE] px-4 py-3 text-sm text-[#1B7A4A]" role="status">
            Verification SUCCESS. The situation is HANDLED. AUTO_HANDLED did not get it here.
          </p>
        ) : null}
        {blocked ? (
          <p className="mt-6 rounded-[14px] border border-[#D8DDD6] bg-[#FDECEC] px-4 py-3 text-sm text-[#B42318]" role="status">
            Policy BLOCKED the proposed action. Canonical: discount_max=5% blocks a 10% request. Safe alternative may be 5% + Net-14, still APPROVAL_REQUIRED.
          </p>
        ) : null}
        {needsApproval ? (
          <p className="mt-6 rounded-[14px] border border-[#D8DDD6] bg-[#FDE8DC] px-4 py-3 text-sm text-[#B33A0F]" role="status">
            The 320K recovery requires approval. External send and financial commitments stay behind a human. AI cannot approve itself.
          </p>
        ) : null}

        <ol className="mt-8 border-l-2 border-[#D8DDD6] pl-4">
          {STEPS.map(([label, key]) => (
            <li key={label} className="relative pb-4">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#EC6025]" aria-hidden />
              <p className="text-[11px] font-semibold tracking-wide text-[#5C6B73]">{label}</p>
              <p className="mt-1 text-sm text-[#0D1B24]">{String(trace[key])}</p>
            </li>
          ))}
        </ol>

        {trace.historical ? (
          <section className="mt-8">
            <h2 className="text-base font-semibold">Historical context</h2>
            <p className="mt-2 text-sm text-[#5C6B73]">{trace.historical}</p>
            <p className="mt-2 text-xs text-[#5C6B73]">History does not override policy. discount_max stays 5%.</p>
          </section>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/autopilot" className={btn.ink}>
            Back to autopilot
          </Link>
          <Link href="/" className={btn.quiet}>
            Back to Pulse
          </Link>
          <Link href="/policy" className={btn.quiet}>
            Open policy
          </Link>
        </div>
      </div>
      <Aside title="Why this ran">
        <p className="text-[#5C6B73]">Observed → Detected → Impact → Plan → Policy → Autopilot → Verification.</p>
        <p className="text-[#5C6B73]">No hidden reasoning. Autopilot classifies. It does not invent HANDLED.</p>
        <p className="text-[#5C6B73]">
          AUTO_HANDLED is not resolution. Verification SUCCESS is HANDLED. Policy is rechecked before execution.
        </p>
      </Aside>
    </Screen>
  );
}
