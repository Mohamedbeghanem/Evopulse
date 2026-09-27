import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { PolicyBadge } from "@/components/ui/badges";
import { getDb } from "@/lib/db";
import { policies } from "@/lib/read";

export const dynamic = "force-dynamic";

export default function PolicyPage() {
  const rules = policies(getDb());
  return (
    <Workspace
      inspector={
        <InspectorPanel title="Authority">
          <p>AI cannot approve itself. Policy is rechecked immediately before execution.</p>
          <p className="mt-3">Canonical: discount_max = 5%. A 10% request is BLOCKED. Safe alternative may be 5% + Net-14.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Policies · Control" title="What AI may safely execute">
        <p>Policy determines permission. Humans govern consequential decisions.</p>
      </PageHeader>
      <div className="mt-8 space-y-3">
        {rules.map((rule) => (
          <article key={rule.id} className="rounded-md border border-hairline bg-ink-800 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-mono text-sm text-paper">{rule.key}</p>
              <PolicyBadge outcome={rule.key === "discount_max" ? "BLOCKED at 10%" : "POLICY"} />
            </div>
            <p className="mt-2 text-xl text-paper">{rule.value}</p>
            <p className="mt-2 text-sm text-sand">{rule.description}</p>
          </article>
        ))}
      </div>
    </Workspace>
  );
}
