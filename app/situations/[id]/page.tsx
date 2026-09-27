import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { ActionBar, ImpactMetric, PageHeader } from "@/components/ui/chrome";
import { EvidenceRow } from "@/components/ui/rows";
import { PolicyBadge, StatusBadge } from "@/components/ui/badges";
import { Button } from "@/components/ui/primitives";
import { attentionById, projectAttention } from "@/lib/attention";
import { formatMoney } from "@/lib/clock";
import { getDb, getMeta } from "@/lib/db";
import { buildCausalExplorer } from "@/lib/engine/causal";
import { calculateGraphImpact } from "@/lib/engine/impact";
import { IDS } from "@/lib/ids";
import { exceptionDetail } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function SituationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const detail = exceptionDetail(db, id);
  const attention = attentionById(projectAttention(db, now).items, id);
  if (!detail && !attention) notFound();

  const cascade = id === IDS.excDelay || attention?.sourceExceptionId === IDS.excDelay;
  const impact = cascade ? calculateGraphImpact(db, IDS.shipment) : null;
  const causal = cascade ? buildCausalExplorer(db) : null;
  const exception = detail?.exception;
  const title = attention?.title || exception?.title || "Situation";
  const status = attention?.classification || exception?.attention || "NEEDS_YOU";

  return (
    <Workspace
      mode="focused"
      inspector={
        <InspectorPanel title="Why this matters">
          <p>One situation. Warning, exception, impact, and autopilot collapse here.</p>
          {cascade ? (
            <p className="mt-3">
              Atlas Supply → SH-204 → RK-7 → 3 orders → 3 customers. Associated revenue is not a loss.
            </p>
          ) : null}
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Situation · Why" title={title}>
        <div className="mt-3 flex flex-wrap gap-3">
          <StatusBadge value={status} />
          {exception?.status ? <PolicyBadge outcome={exception.status} /> : null}
        </div>
        <p className="mt-4">{attention?.summary || exception?.evidence.actual || exception?.evidence.expected}</p>
      </PageHeader>

      {cascade && impact ? (
        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <ImpactMetric
            label="Associated revenue"
            value={formatMoney(impact.associated_revenue, "DZD")}
            caption={`${impact.affected_orders.length} orders · ${impact.affected_customers.length} customers. Not a loss.`}
          />
          <ImpactMetric
            label="Expected cash timing"
            value={formatMoney(impact.affected_expected_cash, "DZD")}
            caption="Timing at risk if Atlas stays late."
          />
        </section>
      ) : exception?.impact.revenueAssociated ? (
        <section className="mt-8">
          <ImpactMetric
            label="Associated revenue"
            value={formatMoney(exception.impact.revenueAssociated, exception.impact.currency)}
            caption="Needs approval before it leaves the building."
          />
        </section>
      ) : null}

      {causal ? (
        <section className="mt-10 space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Causal path</p>
          <p className="text-paper">Atlas Supply → Shipment SH-204 → RK-7 → 3 orders → 3 customers</p>
          <p className="text-sm text-sand">{causal.subhead}</p>
        </section>
      ) : null}

      <section className="mt-10 space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Evidence</p>
        {exception ? (
          <EvidenceRow
            index="01"
            kind="OBSERVED"
            title={exception.evidence.source || "Observed message"}
            fact={exception.evidence.quote}
          />
        ) : null}
        {attention?.layers.map((layer, index) => (
          <EvidenceRow
            key={`${layer.kind}-${layer.id || index}`}
            index={String(index + 2).padStart(2, "0")}
            kind={layer.kind}
            title={layer.label}
            fact="Canonical engine layer — not a second situation."
          />
        ))}
      </section>

      <div className="mt-8">
        <ActionBar>
          <Link href={`/explore?from=${id}`}>
            <Button variant="ghost">Causal</Button>
          </Link>
          <Link href={`/simulate?from=${id}`}>
            <Button variant="ghost">Simulate</Button>
          </Link>
          <Link href={detail?.plan ? `/exceptions/${id}/plan` : `/goals`}>
            <Button variant="attention">Act</Button>
          </Link>
          <Link href={`/evidence/${id}`}>
            <Button variant="quiet">Evidence</Button>
          </Link>
        </ActionBar>
      </div>
    </Workspace>
  );
}
