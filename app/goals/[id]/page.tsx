import Link from "next/link";
import { notFound } from "next/navigation";
import { ApproveActionButton } from "@/components/ApproveActionButton";
import { Badge } from "@/components/Badge";
import { ExecuteSafeButton } from "@/components/ExecuteSafeButton";
import { formatMoney } from "@/lib/clock";
import { withPageContext } from "@/lib/auth/page";
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
  const bundle = await withPageContext((ctx) => getGoalBundle(ctx.db, id));
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
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Goal</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl">{goal.objective || goal.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{goal.status}</Badge>
          <Badge>{goal.goal_type}</Badge>
          <Badge>{goal.scope}</Badge>
        </div>
        <p className="mt-4 max-w-2xl text-sand">
          {context.risks.length} business risk{context.risks.length === 1 ? "" : "s"} threaten this outcome.
          Plan generated ≠ goal achieved.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-serif text-3xl">What threatens it?</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {context.risks.map((risk) => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      </section>

      {plan ? (
        <section className="space-y-6">
          <div>
            <h2 className="font-serif text-3xl">What should happen next?</h2>
            <p className="mt-2 text-sm text-sand">{plan.summary}</p>
            <p className="mt-2 font-mono text-xs text-mute">
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
              <div key={domain} className="rounded-2xl border border-white/10 bg-ink-800/40 p-5">
                <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{DOMAIN_LABEL[domain] || domain}</p>
                <p className="mt-2 font-serif text-2xl">
                  {risk
                    ? `${formatMoney(risk.associatedValue, risk.currency)} requires attention`
                    : DOMAIN_LABEL[domain]}
                </p>
                {risk ? <p className="mt-1 text-sm text-sand">{risk.title}</p> : null}
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
        <Bucket title="Blocked" tone="miss" items={blocked} empty="No policy blocks in this plan." />
      </section>

      {plan && auto.some((a) => a.id) ? (
        <section className="rounded-2xl border border-need/30 bg-need/5 p-6">
          <h2 className="font-serif text-3xl">What can EvoPulse handle?</h2>
          <p className="mt-2 max-w-xl text-sand">
            Execute only AUTO actions. Approval-required and blocked items stay put.
          </p>
          <div className="mt-4">
            <ExecuteSafeButton planId={plan.id!} />
          </div>
        </section>
      ) : null}

      <p className="text-xs text-mute">
        Observed facts, calculated impact, historical evidence, and policy decisions are labeled on each action.
        AI recommendations are never presented as facts.
      </p>
      <Link href="/command" className="text-sm text-sand underline underline-offset-4">
        Back to Command
      </Link>
    </div>
  );
}

function RiskCard({ risk }: { risk: RankedRisk }) {
  return (
    <article className="rounded-2xl border border-white/10 p-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{DOMAIN_LABEL[risk.domain] || risk.domain}</Badge>
        <Badge>{risk.evidence.kind}</Badge>
      </div>
      <p className="mt-3 font-mono text-2xl text-need">{formatMoney(risk.associatedValue, risk.currency)}</p>
      <p className="mt-1 text-sm text-sand">{risk.title}</p>
      <p className="mt-3 text-xs text-mute">#{risk.rank} · {risk.priority.whyFirst}</p>
    </article>
  );
}

function ActionCard({ action, planId }: { action: ClassifiedAction; planId: string }) {
  return (
    <li className="rounded-xl border border-white/10 bg-ink-900/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[11px] text-mute">{action.type}</p>
        <div className="flex gap-2">
          <Badge>{action.policyDecision}</Badge>
          <Badge>{action.evidence.kind}</Badge>
        </div>
      </div>
      <h3 className="mt-2 font-serif text-xl">{action.title}</h3>
      <p className="mt-1 text-sm text-sand">{action.reason}</p>
      {action.evidence.path?.length ? (
        <p className="mt-2 font-mono text-[11px] text-mute">{action.evidence.path.join(" → ")}</p>
      ) : null}
      {action.evidence.associatedValue ? (
        <p className="mt-1 text-xs text-mute">
          Associated value {action.evidence.associatedValue.toLocaleString("en-US")} DZD
        </p>
      ) : null}
      <p className="mt-2 text-xs text-mute">Policy · {action.policyReason}</p>
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
  tone: "ok" | "need" | "miss";
  items: ClassifiedAction[];
  empty: string;
  planId?: string;
}) {
  const toneClass = tone === "ok" ? "text-ok" : tone === "need" ? "text-need" : "text-miss";
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className={`text-[11px] uppercase tracking-[0.18em] ${toneClass}`}>{title}</p>
      {items.length === 0 ? <p className="mt-3 text-sm text-mute">{empty}</p> : null}
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id || item.title} className="text-sm text-sand">
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
