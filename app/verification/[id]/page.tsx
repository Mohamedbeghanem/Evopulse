import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { VerificationBadge } from "@/components/ui/badges";
import { getDb } from "@/lib/db";
import { exceptionDetail } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function VerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = exceptionDetail(getDb(), id);
  if (!detail) notFound();
  const pending = detail.verifications.find((row) => row.status === "PENDING");
  const last = detail.verifications[detail.verifications.length - 1];
  const handled = detail.exception.attention === "HANDLED";
  return (
    <Workspace
      mode="focused"
      inspector={
        <InspectorPanel title="Resolution">
          <p>EXECUTED → VERIFYING → VERIFIED → HANDLED.</p>
          <p className="mt-3">Executed is not handled. Only successful verification resolves the situation.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Verification" title={detail.exception.title}>
        <div className="mt-3 flex flex-wrap gap-3">
          <VerificationBadge status={last?.status || "NONE"} />
          <VerificationBadge status={handled ? "HANDLED" : detail.exception.attention} />
        </div>
      </PageHeader>
      <section className="mt-8 space-y-3 text-sand">
        {detail.verifications.map((row) => (
          <article key={row.id} className="rounded-md border border-hairline p-4">
            <VerificationBadge status={row.status} />
            <p className="mt-2 text-paper">{row.success_condition}</p>
            <p className="mt-1 text-sm">{row.evidence || row.expected_event_type}</p>
          </article>
        ))}
        {pending ? <p>Executed. Now verifying. Not handled yet.</p> : null}
        {handled ? <p className="text-ice">Verified. The situation is handled. Nothing falls through.</p> : null}
      </section>
      <Link href={`/learning`} className="mt-8 inline-flex text-sm text-need">
        Open learning
      </Link>
    </Workspace>
  );
}
