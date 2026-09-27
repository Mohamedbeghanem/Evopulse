import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveActionButton } from "@/components/ApproveActionButton";
import { ExecuteSafeButton } from "@/components/ExecuteSafeButton";
import { formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { getGoalBundle } from "@/lib/goals";
import type { ClassifiedAction, RankedRisk } from "@/lib/goals/types";

export const dynamic = "force-dynamic";

const DOMAIN_LABEL: Record<string, string> = {
  sales: "Sales",
  operations: "Operations",
  cash: "Cash",
  customers: "Customers",
};

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bundle = getGoalBundle(getDb(), id);
  if (!bundle) notFound();
  const { goal, context, plan } = bundle;
  const actions = plan?.actions || [];
  const auto = actions.filter((a) => a.policyDecision === "AUTO");
  const approval = actions.filter((a) => a.policyDecision === "APPROVAL_REQUIRED");
  const blocked = actions.filter((a) => a.policyDecision === "BLOCKED");
  const domains = ["sales", "operations", "cash", "customers"].filter((domain) =>
    context.risks.some((risk) => risk.domain === domain) || actions.some((a) => a.domain === domain),
  );

  return (
    <div className="space-y-10 bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Goal</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">{goal.objective || goal.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>{goal.status}</Pill>
          <Pill>{goal.goal_type}</Pill>
          <Pill>{goal.scope}</Pill>
        </div>
        <p className="mt-4 max-w-2xl text-[15px] text-[#5C6B73]">
          {context.risks.length} business risk{context.risks.length === 1 ? "" : "s"} threaten this outcome.
          Plan generated ≠ goal achieved.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">What threatens it?</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {context.risks.map((risk) => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      </section>

      {plan ? (
        <section className="space-y-6">
          <div>
            <h2 className="text-base font-semibold">What should happen next?</h2>
            <p className="mt-2 text-sm text-[#5C6B73]">{plan.summary}</p>
            <p className="mt-2 font-mono text-xs text-[#5C6B73]">
              {plan.expectedImpact.associatedValueAddressed.toLocaleString("en-US")}{" "}
              {plan.expectedImpact.currency} associated value under attention
              {plan.expectedImpact.cashTimingUnderAttention
                ? ` · ${plan.expectedImpact.cashTimingUnderAttention.toLocaleString("en-US")} cash timing`
                : ""}
            </p>
          </div>

          {domains.map((domain) => {
            const risk = context.risks.find((r) => r.domain === domain);
            const domainActions = actions.filter((a) => a.domain === domain);
            if (!risk && domainActions.length === 0) return null;
            return (
              <div key={domain} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5C6B73]">{DOMAIN_LABEL[domain] || domain}</p>
                <p className="mt-2 text-[22px] font-semibold tracking-tight">
                  {risk
                    ? `${formatMoney(risk.associatedValue, risk.currency)} requires attention`
                    : DOMAIN_LABEL[domain]}
                </p>
                {risk ? <p className="mt-1 text-sm text-[#5C6B73]">{risk.title}</p> : null}
                <ol className="mt-4 space-y-3">
                  {domainActions.map((action) => (
                    <ActionCard key={action.id} action={action} planId={plan.id || ""} />
                  ))}
                </ol>
              </div>
            );
          })}
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Bucket title="Safe to execute" tone="ok" items={auto} empty="Nothing is inside automatic authority." />
        <Bucket title="Needs me" tone="need" items={approval} empty="No approval-gated actions." planId={plan?.id} />
        <Bucket title="Blocked" tone="bad" items={blocked} empty="No policy blocks in this plan." />
      </section>

      {plan && auto.some((a) => a.id) ? (
        <section className="rounded-[14px] border border-[#EC6025]/40 bg-[#FDE8DC]/50 p-6">
          <h2 className="text-[22px] font-semibold tracking-tight">What can EvoPulse handle?</h2>
          <p className="mt-2 max-w-xl text-[#5C6B73]">
            Execute only AUTO actions. Approval-required and blocked items stay put.
          </p>
          <div className="mt-4">
            <ExecuteSafeButton planId={plan.id!} />
          </div>
        </section>
      ) : null}

      <p className="text-xs text-[#5C6B73]">
        Observed facts, calculated impact, historical evidence, and policy decisions are labeled on each action.
        AI recommendations are never presented as facts.
      </p>
      <Link href="/command" className="text-sm text-[#5C6B73] underline underline-offset-4">
        Back to Command
      </Link>
    </div>
  );
}

function RiskCard({ risk }: { risk: RankedRisk }) {
  return (
    <article className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
      <div className="flex flex-wrap gap-2">
        <Pill>{DOMAIN_LABEL[risk.domain] || risk.domain}</Pill>
        <Pill>{risk.evidence.kind}</Pill>
      </div>
      <p className="mt-3 font-mono text-2xl text-[#EC6025]">{formatMoney(risk.associatedValue, risk.currency)}</p>
      <p className="mt-1 text-sm text-[#5C6B73]">{risk.title}</p>
      <p className="mt-3 text-xs text-[#5C6B73]">#{risk.rank} · {risk.priority.whyFirst}</p>
    </article>
  );
}

function ActionCard({ action, planId }: { action: ClassifiedAction; planId: string }) {
  const selected = action.policyDecision === "APPROVAL_REQUIRED";
  return (
    <li className={`rounded-[14px] border bg-[#F7F8F5] p-4 ${selected ? "border-[#EC6025]/40" : "border-[#D8DDD6]"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-[#5C6B73]">{action.type}</p>
        <div className="flex gap-2">
          <Pill>{action.policyDecision}</Pill>
          <Pill>{action.evidence.kind}</Pill>
        </div>
      </div>
      <h3 className="mt-2 text-base font-semibold">{action.title}</h3>
      <p className="mt-1 text-sm text-[#5C6B73]">{action.reason}</p>
      {action.evidence.path?.length ? (
        <p className="mt-2 font-mono text-[11px] text-[#5C6B73]">{action.evidence.path.join(" → ")}</p>
      ) : null}
      {action.evidence.associatedValue ? (
        <p className="mt-1 text-xs text-[#5C6B73]">
          Associated value {action.evidence.associatedValue.toLocaleString("en-US")} DZD
        </p>
      ) : null}
      <p className="mt-2 text-xs text-[#5C6B73]">Policy · {action.policyReason}</p>
      {action.policyDecision === "APPROVAL_REQUIRED" && action.id && planId ? (
        <div className="mt-3">
          <ApproveActionButton planId={planId} actionId={action.id} />
        </div>
      ) : null}
    </li>
  );
}

function Bucket({
  title,
  tone,
  items,
  empty,
  planId,
}: {
  title: string;
  tone: "ok" | "need" | "bad";
  items: ClassifiedAction[];
  empty: string;
  planId?: string;
}) {
  const toneClass = tone === "ok" ? "text-[#1B7A4A]" : tone === "need" ? "text-[#EC6025]" : "text-[#B42318]";
  return (
    <div className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
      <p className={`font-mono text-[11px] uppercase tracking-[0.18em] ${toneClass}`}>{title}</p>
      {items.length === 0 ? <p className="mt-3 text-sm text-[#5C6B73]">{empty}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id || item.title} className="text-sm text-[#5C6B73]">
            {item.title}
            {tone === "need" && planId && item.id ? (
              <span className="ml-2 inline-block">
                <ApproveActionButton planId={planId} actionId={item.id} />
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  const v = children.toUpperCase();
  const cls = /BLOCK|FAIL|MISS/.test(v)
    ? "bg-[#FDECEC] text-[#B42318]"
    : /APPROVAL|NEED|RISK|OPEN/.test(v)
      ? "bg-[#FDE8DC] text-[#B33A0F]"
      : /AUTO|OK|SAFE|SUCCESS|HANDLED/.test(v)
        ? "bg-[#E4F3EA] text-[#1B7A4A]"
        : /PENDING|WATCH|WARN/.test(v)
          ? "bg-[#F8EFCC] text-[#B45309]"
          : "bg-[#E8F1F4] text-[#0F4C5C]";
  return (
    <span className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold tracking-wide ${cls}`}>
      {children.replaceAll("_", " ")}
    </span>
  );
}
