import Link from "next/link";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
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

const ghost =
  "inline-flex min-h-[34px] items-center rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 text-sm text-[#0D1B24]";

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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Fired rule</p>
          <p className="mt-2 text-[#0D1B24]">discount_max</p>
          <p className="mt-3 text-[#5C6B73]">
            Outcome: BLOCKED. Requested 10%. Ceiling {ceiling}%. Event policy.blocked. Action apply 10% cannot execute.
          </p>
          <p className="mt-3 text-[#5C6B73]">AI cannot approve itself. Policy is rechecked immediately before execution.</p>
          <p className="mt-3 text-[#5C6B73]">Canonical: discount_max = 5%. A 10% request is BLOCKED. Safe alternative may be 5% + Net-14.</p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Policies · Control</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">What software refuses</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill>BLOCKED</Pill>
          <Pill>POLICY</Pill>
        </div>
        <p className="mt-4 max-w-[640px] text-[15px] text-[#5C6B73]">
          10% is outside authorization. BLOCKED is governed autonomy — not an application error. Alternatives still need a human.
        </p>
        <p className="mt-3 flex flex-wrap gap-4">
          <Link href="/autopilot" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Autopilot
          </Link>
          <Link href="/control" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Control
          </Link>
        </p>

        <p className="mt-8 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-4 py-3 text-sm text-[#5C6B73]" role="status">
          Policy discount_max={ceiling}% blocks a 10% discount. There is no approve control for a 10% action.
          {blocked10 ? " Live action is already BLOCKED." : " The rule is in force even before a 10% action is proposed."}
        </p>

        <section className="mt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Refused action</p>
          <p className="mt-3 text-xl font-semibold">Apply 10% discount.</p>
          <p className="mt-2 text-sm text-[#5C6B73]">
            Customer asked for 10% to sign today. AI proposed it. Software refused. Outcome is BLOCKED — not failed, not pending, not a toast.
          </p>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4" aria-label="Requested versus allowed">
            <Metric label="Requested" value="10%" caption="Customer concession · 320,000 DZD" />
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#5C6B73]">discount_max</p>
            <Metric label="Allowed ceiling" value={`${ceiling}%`} caption="Software law. Not negotiable by the model." />
          </div>
          <p className="mt-4 font-mono text-xs text-[#5C6B73]">
            apply_discount · 10% · Policy discount_max={ceiling}% blocks a 10% discount.
          </p>
        </section>

        <section className="mt-10 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Inside policy — still human-gated</p>
          <p className="text-xl font-semibold">5% and/or Net-14.</p>
          <p className="text-sm text-[#5C6B73]">
            Canonical recovery. Both are financial commitments. Both are APPROVAL_REQUIRED. Neither is AUTO. 10% stays BLOCKED.
          </p>
          <article className="grid grid-cols-1 gap-3 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div>
              <p>Alternative — offer 5% (policy max)</p>
              <p className="mt-1 text-sm text-[#5C6B73]">320,000 → 304,000 DZD. Stays inside discount_max={ceiling}%.</p>
            </div>
            <Pill>{offer5?.policy_outcome || "APPROVAL_REQUIRED"}</Pill>
          </article>
          <article className="grid grid-cols-1 gap-3 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div>
              <p>Alternative — Net-14 + priority slot</p>
              <p className="mt-1 text-sm text-[#5C6B73]">Keep list 320,000 DZD, pull delivery forward one week, invoice Net-14.</p>
            </div>
            <Pill>{offerTerms?.policy_outcome || "APPROVAL_REQUIRED"}</Pill>
          </article>
          <article className="grid grid-cols-1 gap-3 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div>
              <p>Draft policy-safe reply</p>
              <p className="mt-1 text-sm text-[#5C6B73]">
                10% is outside authorization. I can do 5% (304,000 DZD) immediately, or keep 320,000 and pull the install slot forward a week with Net-14.
              </p>
            </div>
            <Pill>APPROVAL_REQUIRED</Pill>
          </article>
        </section>

        <section className="mt-10">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Policy ledger</p>
          <div className="overflow-x-auto rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB]">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left font-mono text-[11px] uppercase tracking-[0.12em] text-[#5C6B73]">
                  <th className="border-b border-[#D8DDD6] px-3 py-2.5 font-semibold">Key</th>
                  <th className="border-b border-[#D8DDD6] px-3 py-2.5 font-semibold">Value</th>
                  <th className="border-b border-[#D8DDD6] px-3 py-2.5 font-semibold">Note</th>
                  <th className="border-b border-[#D8DDD6] px-3 py-2.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => {
                  const fired = rule.key === "discount_max";
                  return (
                    <tr key={rule.id}>
                      <td className="border-b border-[#D8DDD6] px-3 py-3 font-mono">{rule.key}</td>
                      <td className={`border-b border-[#D8DDD6] px-3 py-3 font-mono ${fired ? "text-[#0D1B24]" : "text-[#0F4C5C]"}`}>
                        {rule.value}
                      </td>
                      <td className="border-b border-[#D8DDD6] px-3 py-3 text-[#5C6B73]">{rule.description}</td>
                      <td className="border-b border-[#D8DDD6] px-3 py-3">
                        <Pill>{fired ? "BLOCKED" : "POLICY"}</Pill>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Impact</p>
          <p className="mt-3 text-sm text-[#5C6B73]">
            Associated opportunity remains 320,000 DZD. Unauthorized 10% is not priced as revenue saved. The 5% path is 304,000 DZD only if a human approves it.
          </p>
        </section>

        <section className="mt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Evidence</p>
          <blockquote className="mt-3 text-lg">“I&apos;ll sign today if you give me 10%.”</blockquote>
          <p className="mt-2 font-mono text-[11px] text-[#5C6B73]">
            Customer conversation · Amine Khelifi · Sun 27 Sep 11:05 · expected concession ≤ discount_max={ceiling}%
          </p>
        </section>

        <p className="mt-10 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-4 py-3 text-sm text-[#5C6B73]" role="status">
          <strong className="text-[#0D1B24]">BLOCKED is the system working.</strong> Policy sits between AI and execution. EvoPulse cannot override discount_max. A human may take 5% or Net-14 to approval. AI cannot approve itself.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <span className="inline-flex min-h-[34px] items-center rounded-lg border border-[#D8DDD6] px-3 text-sm text-[#5C6B73]">
            Cannot approve 10% — BLOCKED
          </span>
          <Link href={approvalHref} className="inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white">
            Take 5% or Net-14 to approval
          </Link>
          <Link href="/autopilot" className={ghost}>
            Open autopilot
          </Link>
        </div>
      </div>
    </Workspace>
  );
}

function Metric({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5C6B73]">{label}</p>
      <p className="mt-1 text-[22px] font-semibold tracking-tight">{value}</p>
      {caption ? <p className="mt-1 text-xs text-[#5C6B73]">{caption}</p> : null}
    </div>
  );
}

function Pill({ children }: { children: string }) {
  const v = children.toUpperCase();
  const cls = /BLOCK|FAIL|MISS/.test(v)
    ? "bg-[#FDECEC] text-[#B42318]"
    : /APPROVAL|NEED/.test(v)
      ? "bg-[#FDE8DC] text-[#B33A0F]"
      : "bg-[#E8F1F4] text-[#0F4C5C]";
  return (
    <span className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold tracking-wide ${cls}`}>
      {children.replaceAll("_", " ")}
    </span>
  );
}
