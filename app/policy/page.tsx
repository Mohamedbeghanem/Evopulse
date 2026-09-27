import Link from "next/link";
import { Badge } from "@/components/Badge";
import { InspectorField } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader, SectionHeader } from "@/components/ui/chrome";
import { PolicyBadge } from "@/components/ui/badges";
import { formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { exceptionDetail, policies } from "@/lib/read";
import { IDS } from "@/lib/ids";
import { getSituation } from "@/lib/ui/attention";

export const dynamic = "force-dynamic";

export default function PolicyPage() {
  const db = getDb();
  const rules = policies(db);
  const discount = getSituation(db, IDS.excDiscount);
  const detail = discount ? exceptionDetail(db, IDS.excDiscount) : null;
  const actions = detail?.actions || [];
  const blocked = actions.find((a) => a.policy_outcome === "BLOCKED");
  const alternatives = actions.filter((a) => a.policy_outcome !== "BLOCKED");

  return (
    <Workspace
      inspectorTitle="Fired rule"
      inspector={
        <>
          <InspectorField label="Rule" value="discount_max = 5" />
          <InspectorField label="Requested" value="10% on 320,000 DZD" />
          <InspectorField label="Decision" value="BLOCKED" />
          <InspectorField
            label="Evidence"
            value={discount?.quote || "I'll sign today if you give me 10%."}
          />
          <p className="text-sm text-sand">The model cannot approve itself. Policy is rechecked at execution.</p>
        </>
      }
    >
      <PageHeader kicker="Policies / Control · BLOCKED" title="What software already refused.">
        <p>
          BLOCKED is governed autonomy, not an application error. AI may propose. Software refuses. Humans still
          govern anything that is allowed.
        </p>
      </PageHeader>

      {discount ? (
        <section className="mt-10">
          <SectionHeader title="Refused" />
          <div className="mt-4 border border-white/10 p-5">
            <PolicyBadge outcome="BLOCKED" />
            <h2 className="mt-3 font-serif text-3xl">{blocked?.title || "Apply 10% discount"}</h2>
            <p className="mt-2 text-sand">
              {blocked?.policy_reason || "Policy discount_max=5% blocks a 10% discount."}
            </p>
            <p className="mt-3 font-mono text-sm text-mute">{formatMoney(320000)} list · 10% is not revenue saved</p>
          </div>
        </section>
      ) : (
        <section className="mt-10">
          <SectionHeader title="No live refusal" />
          <p className="mt-4 text-sand">
            Seed the 10% customer message from the demo bar to see discount_max fire. Until then the ledger still
            governs.
          </p>
        </section>
      )}

      {discount ? (
        <section className="mt-8">
          <SectionHeader title="Inside policy" />
          <ul className="mt-4 divide-y divide-white/10 border-y border-white/10">
            {alternatives.map((action) => (
              <li key={action.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-serif text-xl">{action.title}</p>
                  <PolicyBadge outcome={action.policy_outcome} />
                </div>
                <p className="mt-1 text-sm text-sand">{action.description}</p>
                <p className="mt-1 text-xs text-mute">{action.policy_reason}</p>
              </li>
            ))}
          </ul>
          {detail?.plan ? (
            <Link
              href={`/exceptions/${IDS.excDiscount}/plan`}
              className="mt-4 inline-flex min-h-10 items-center rounded-full bg-need px-4 text-sm font-medium text-ink-950"
            >
              Take a policy-safe alternative to approval
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className="mt-10">
        <SectionHeader title="Ledger" />
        <ul className="mt-4 space-y-2 font-mono text-sm text-sand">
          {rules.map((rule) => (
            <li key={rule.id} className="flex flex-wrap justify-between gap-3 border-b border-white/10 py-2">
              <span>{rule.key}</span>
              <span className="text-paper">{rule.value}</span>
            </li>
          ))}
        </ul>
      </section>
    </Workspace>
  );
}
