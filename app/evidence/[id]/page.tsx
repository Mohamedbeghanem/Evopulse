import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { getDb } from "@/lib/db";
import { exceptionDetail } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = exceptionDetail(getDb(), id);
  if (!detail) notFound();
  const { exception, actions, verifications, plan } = detail;
  const rows = [
    { index: "01", kind: "OBSERVED", title: "Source message", fact: exception.evidence.quote },
    { index: "02", kind: "DETECTED", title: exception.kind, fact: exception.evidence.actual || exception.evidence.expected },
    {
      index: "03",
      kind: "IMPACT",
      title: "Associated revenue",
      fact: `${exception.impact.revenueAssociated?.toLocaleString("en-US") || "—"} ${exception.impact.currency} associated — not lost.`,
    },
    { index: "04", kind: "PLAN", title: plan?.id || "No plan yet", fact: plan?.status || "Plan not generated" },
    {
      index: "05",
      kind: "POLICY",
      title: "Policy outcomes",
      fact: actions.map((action) => `${action.type}: ${action.policy_outcome}`).join(" · ") || "No actions",
    },
    {
      index: "06",
      kind: "ACTION",
      title: "Execution",
      fact: actions.map((action) => `${action.type}: ${action.status}`).join(" · ") || "Nothing executed",
    },
    {
      index: "07",
      kind: "VERIFICATION",
      title: "Verification",
      fact: verifications.map((row) => row.status).join(" · ") || "No verification yet",
    },
  ];
  return (
    <Workspace
      mode="focused"
      inspector={
        <InspectorPanel title="Evidence chain">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Evidence chain</p>
          <p className="mt-2 text-[#0D1B24]">OBSERVED → DETECTED → IMPACT → PLAN → POLICY → ACTION → VERIFICATION → OUTCOME.</p>
          <p className="mt-3 text-[#5C6B73]">Executed is not handled.</p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Evidence</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">{exception.title}</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          Software established these facts. The model may explain them. It does not author them.
        </p>
        <section className="mt-8 space-y-2">
          {rows.map((row) => (
            <article key={row.index} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-3.5">
              <h3 className="text-[15px] font-semibold">
                {row.index} {row.kind} · {row.title}
              </h3>
              <p className="mt-1 text-[13px] text-[#5C6B73]">{row.fact}</p>
            </article>
          ))}
        </section>
        <Link
          href={`/verification/${id}`}
          className="mt-8 inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white"
        >
          Open verification
        </Link>
      </div>
    </Workspace>
  );
}
