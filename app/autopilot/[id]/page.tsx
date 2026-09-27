import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PolicyBadge, StatusBadge, VerificationBadge } from "@/components/ui/badges";
import { ActionBar, PageHeader } from "@/components/ui/chrome";
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
    <Workspace
      mode="focused"
      inspector={
        <InspectorPanel title="Why this ran">
          <p>Observed → Detected → Impact → Plan → Policy → Autopilot → Verification.</p>
          <p className="mt-3">No hidden reasoning. Autopilot classifies. It does not invent HANDLED.</p>
          <p className="mt-3">
            AUTO_HANDLED is not resolution. Verification SUCCESS is HANDLED. Policy is rechecked before execution.
          </p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Autopilot trace" title="Why did EvoPulse do this?">
        <div className="mt-3 flex flex-wrap gap-3">
          <StatusBadge value={current} />
          <PolicyBadge outcome={policy} />
          <VerificationBadge status={verification} />
          <StatusBadge value={reason} />
        </div>
        <p className="mt-4">{trace.decision.whyItMatters || trace.decision.happened}</p>
      </PageHeader>

      {autoHandled ? (
        <p className="mt-8 rounded-md border border-hairline px-4 py-3 text-sm text-ice" role="status">
          This classification is AUTO_HANDLED. A policy-AUTO internal action executed. That is not verification of the business outcome. Verification SUCCESS is HANDLED.
        </p>
      ) : null}
      {handled ? (
        <p className="mt-8 rounded-md border border-hairline px-4 py-3 text-sm text-ice" role="status">
          Verification SUCCESS. The situation is HANDLED. AUTO_HANDLED did not get it here.
        </p>
      ) : null}
      {blocked ? (
        <p className="mt-8 rounded-md border border-hairline px-4 py-3 text-sm text-mute" role="status">
          Policy BLOCKED the proposed action. Canonical: discount_max=5% blocks a 10% request. Safe alternative may be 5% + Net-14, still APPROVAL_REQUIRED.
        </p>
      ) : null}
      {needsApproval ? (
        <p className="mt-8 rounded-md border border-hairline px-4 py-3 text-sm text-need" role="status">
          The 320K recovery requires approval. External send and financial commitments stay behind a human. AI cannot approve itself.
        </p>
      ) : null}

      <ol className="mt-10 space-y-0">
        {STEPS.map(([label, key]) => (
          <li key={label} className="border-b border-hairline py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{label}</p>
            <p className="mt-2 text-sand">{String(trace[key])}</p>
          </li>
        ))}
      </ol>

      {trace.historical ? (
        <section className="mt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Historical context</p>
          <p className="mt-2 text-sand">{trace.historical}</p>
          <p className="mt-2 text-xs text-mute">History does not override policy. discount_max stays 5%.</p>
        </section>
      ) : null}

      <div className="mt-8">
        <ActionBar>
          <Link href="/autopilot" className="inline-flex min-h-8 items-center rounded-md bg-paper px-4 py-2 text-sm font-medium text-ink-950">
            Back to autopilot
          </Link>
          <Link href="/" className="inline-flex min-h-8 items-center px-4 text-sm text-need">
            Back to Pulse
          </Link>
          <Link href="/policy" className="inline-flex min-h-8 items-center px-4 text-sm text-sand">
            Open policy
          </Link>
        </ActionBar>
      </div>
    </Workspace>
  );
}
