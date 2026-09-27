import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { EvidenceRow } from "@/components/ui/rows";
import { getDb } from "@/lib/db";
import { exceptionDetail } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = exceptionDetail(getDb(), id);
  if (!detail) notFound();
  const { exception, actions, verifications, plan } = detail;
  return (
    <Workspace
      mode="focused"
      inspector={
        <InspectorPanel title="Evidence chain">
          <p>OBSERVED → DETECTED → IMPACT → PLAN → POLICY → ACTION → VERIFICATION → OUTCOME.</p>
          <p className="mt-3">Executed is not handled.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Evidence" title={exception.title}>
        <p>Software established these facts. The model may explain them. It does not author them.</p>
      </PageHeader>
      <section className="mt-8 space-y-2">
        <EvidenceRow index="01" kind="OBSERVED" title="Source message" fact={exception.evidence.quote} />
        <EvidenceRow index="02" kind="DETECTED" title={exception.kind} fact={exception.evidence.actual || exception.evidence.expected} />
        <EvidenceRow
          index="03"
          kind="IMPACT"
          title="Associated revenue"
          fact={`${exception.impact.revenueAssociated?.toLocaleString("en-US") || "—"} ${exception.impact.currency} associated — not lost.`}
        />
        <EvidenceRow index="04" kind="PLAN" title={plan?.id || "No plan yet"} fact={plan?.status || "Plan not generated"} />
        <EvidenceRow
          index="05"
          kind="POLICY"
          title="Policy outcomes"
          fact={actions.map((action) => `${action.type}: ${action.policy_outcome}`).join(" · ") || "No actions"}
        />
        <EvidenceRow
          index="06"
          kind="ACTION"
          title="Execution"
          fact={actions.map((action) => `${action.type}: ${action.status}`).join(" · ") || "Nothing executed"}
        />
        <EvidenceRow
          index="07"
          kind="VERIFICATION"
          title="Verification"
          fact={verifications.map((row) => row.status).join(" · ") || "No verification yet"}
        />
      </section>
      <Link href={`/verification/${id}`} className="mt-8 inline-flex text-sm text-need">
        Open verification
      </Link>
    </Workspace>
  );
}
