import Link from "next/link";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PolicyBadge } from "@/components/ui/badges";
import { ActionBar, ImpactMetric, PageHeader } from "@/components/ui/chrome";
import { getDb } from "@/lib/db";
import { latestActions, policies } from "@/lib/read";

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

export default function PolicyPage() {
  const db = getDb();
  const rules = policies(db);
  const actions = latestActions(db);
  const discount = rules.find((rule) => rule.key === "discount_max");
  const ceiling = discount?.value || "5";
  const blocked10 = actions.find((action) => {
    const payload = asPayload(action.payload);
    return action.policy_outcome === "BLOCKED" && action.type === "apply_discount" && Number(payload.percent) === 10;
  });
  const offer5 = actions.find((action) => {
    const payload = asPayload(action.payload);
    return action.type === "apply_discount" && Number(payload.percent) === 5;
  });
  const offerTerms = actions.find((action) => action.type === "offer_alternative");
  const approvalHref = `/exceptions/${offer5?.exception_id || offerTerms?.exception_id || blocked10?.exception_id || "exc_proposal_missed"}/plan`;

  return (
    <Workspace
      mode="focused"
      inspector={
        <InspectorPanel title="Fired rule">
          <p className="text-paper">discount_max</p>
          <p className="mt-3">
            Outcome: BLOCKED. Requested 10%. Ceiling {ceiling}%. Event policy.blocked. Action apply 10% cannot execute.
          </p>
          <p className="mt-3">AI cannot approve itself. Policy is rechecked immediately before execution.</p>
          <p className="mt-3">Canonical: discount_max = 5%. A 10% request is BLOCKED. Safe alternative may be 5% + Net-14.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Policies · Control" title="What software refuses">
        <div className="mt-3 flex flex-wrap gap-3">
          <PolicyBadge outcome="BLOCKED" />
          <PolicyBadge outcome="POLICY" />
        </div>
        <p className="mt-4">
          10% is outside authorization. BLOCKED is governed autonomy — not an application error. Alternatives still need a human.
        </p>
      </PageHeader>

      <p className="mt-8 rounded-md border border-hairline bg-ink-800 px-4 py-3 text-sm text-sand" role="status">
        Policy discount_max={ceiling}% blocks a 10% discount. There is no approve control for a 10% action.
        {blocked10 ? " Live action is already BLOCKED." : " The rule is in force even before a 10% action is proposed."}
      </p>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Refused action</p>
        <p className="mt-3 text-xl text-paper">Apply 10% discount.</p>
        <p className="mt-2 text-sm text-sand">
          Customer asked for 10% to sign today. AI proposed it. Software refused. Outcome is BLOCKED — not failed, not pending, not a toast.
        </p>
        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4" aria-label="Requested versus allowed">
          <ImpactMetric label="Requested" value="10%" caption="Customer concession · 320,000 DZD" />
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">discount_max</p>
          <ImpactMetric label="Allowed ceiling" value={`${ceiling}%`} caption="Software law. Not negotiable by the model." />
        </div>
        <p className="mt-4 font-mono text-xs text-mute">
          apply_discount · 10% · Policy discount_max={ceiling}% blocks a 10% discount.
        </p>
      </section>

      <section className="mt-10 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Inside policy — still human-gated</p>
        <p className="text-xl text-paper">5% and/or Net-14.</p>
        <p className="text-sm text-sand">
          Canonical recovery. Both are financial commitments. Both are APPROVAL_REQUIRED. Neither is AUTO. 10% stays BLOCKED.
        </p>
        <article className="grid grid-cols-1 gap-3 border-b border-hairline py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div>
            <p className="text-paper">Alternative — offer 5% (policy max)</p>
            <p className="mt-1 text-sm text-sand">320,000 → 304,000 DZD. Stays inside discount_max={ceiling}%.</p>
          </div>
          <PolicyBadge outcome={offer5?.policy_outcome || "APPROVAL_REQUIRED"} />
        </article>
        <article className="grid grid-cols-1 gap-3 border-b border-hairline py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div>
            <p className="text-paper">Alternative — Net-14 + priority slot</p>
            <p className="mt-1 text-sm text-sand">Keep list 320,000 DZD, pull delivery forward one week, invoice Net-14.</p>
          </div>
          <PolicyBadge outcome={offerTerms?.policy_outcome || "APPROVAL_REQUIRED"} />
        </article>
        <article className="grid grid-cols-1 gap-3 border-b border-hairline py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div>
            <p className="text-paper">Draft policy-safe reply</p>
            <p className="mt-1 text-sm text-sand">
              10% is outside authorization. I can do 5% (304,000 DZD) immediately, or keep 320,000 and pull the install slot forward a week with Net-14.
            </p>
          </div>
          <PolicyBadge outcome="APPROVAL_REQUIRED" />
        </article>
      </section>

      <section className="mt-10 space-y-0">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Policy ledger</p>
        {rules.map((rule) => {
          const fired = rule.key === "discount_max";
          return (
            <article key={rule.id} className="grid grid-cols-1 gap-2 border-b border-hairline py-4 sm:grid-cols-[minmax(12rem,1fr)_4.5rem_minmax(0,1.4fr)_auto] sm:items-baseline">
              <p className="font-mono text-sm text-paper">{rule.key}</p>
              <p className={`font-mono text-sm ${fired ? "text-paper" : "text-ice"}`}>{rule.value}</p>
              <p className="text-sm text-sand">{rule.description}</p>
              <PolicyBadge outcome={fired ? "BLOCKED" : "POLICY"} />
            </article>
          );
        })}
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Impact</p>
        <p className="mt-3 text-sm text-sand">
          Associated opportunity remains 320,000 DZD. Unauthorized 10% is not priced as revenue saved. The 5% path is 304,000 DZD only if a human approves it.
        </p>
      </section>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Evidence</p>
        <blockquote className="mt-3 text-lg text-paper">“I&apos;ll sign today if you give me 10%.”</blockquote>
        <p className="mt-2 font-mono text-[11px] text-mute">
          Customer conversation · Amine Khelifi · Sun 27 Sep 11:05 · expected concession ≤ discount_max={ceiling}%
        </p>
      </section>

      <p className="mt-10 rounded-md border border-hairline bg-ink-800 px-4 py-3 text-sm text-sand" role="status">
        <strong className="text-paper">BLOCKED is the system working.</strong> Policy sits between AI and execution. EvoPulse cannot override discount_max. A human may take 5% or Net-14 to approval. AI cannot approve itself.
      </p>

      <div className="mt-8">
        <ActionBar>
          <span className="inline-flex min-h-8 items-center rounded-md border border-hairline px-4 py-2 text-sm text-mute">
            Cannot approve 10% — BLOCKED
          </span>
          <Link href={approvalHref} className="inline-flex min-h-8 items-center rounded-md bg-need px-4 py-2 text-sm font-medium text-ink-950">
            Take 5% or Net-14 to approval
          </Link>
          <Link href="/autopilot" className="inline-flex min-h-8 items-center rounded-md border border-white/15 px-4 py-2 text-sm text-paper">
            Open autopilot
          </Link>
        </ActionBar>
      </div>
    </Workspace>
  );
}
