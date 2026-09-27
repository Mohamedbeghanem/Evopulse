import Link from "next/link";
import { notFound } from "next/navigation";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
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
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Resolution</p>
          <p className="mt-2 text-[#0D1B24]">EXECUTED → VERIFYING → VERIFIED → HANDLED.</p>
          <p className="mt-3 text-[#5C6B73]">Executed is not handled. Only successful verification resolves the situation.</p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Verification</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">{detail.exception.title}</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          EXECUTED → VERIFYING → VERIFIED → HANDLED. Executed is not handled.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill status={last?.status || "NONE"} />
          <Pill status={handled ? "HANDLED" : detail.exception.attention} />
        </div>
        <section className="mt-8 space-y-2 text-[#5C6B73]">
          {detail.verifications.map((row) => (
            <article
              key={row.id}
              className={`rounded-[14px] border bg-[#FFFEFB] px-3.5 py-3.5 ${
                row.status === "PENDING" ? "border-[#EC6025]/40" : "border-[#D8DDD6]"
              }`}
            >
              <Pill status={row.status} />
              <p className="mt-2 font-semibold text-[#0D1B24]">{row.success_condition}</p>
              <p className="mt-1 text-sm">{row.evidence || row.expected_event_type}</p>
            </article>
          ))}
          {pending ? <p>Executed. Now verifying. Not handled yet.</p> : null}
          {handled ? <p className="text-[#1B7A4A]">Verified. The situation is handled. Nothing falls through.</p> : null}
        </section>
        <Link
          href={`/learning`}
          className="mt-8 inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white"
        >
          Open learning
        </Link>
      </div>
    </Workspace>
  );
}

function Pill({ status }: { status: string }) {
  const v = status.toUpperCase();
  const cls = /FAIL|MISS|BLOCK/.test(v)
    ? "bg-[#FDECEC] text-[#B42318]"
    : /PENDING|NONE/.test(v)
      ? "bg-[#F8EFCC] text-[#B45309]"
      : /HANDLED|VERIFIED|SUCCESS|OK/.test(v)
        ? "bg-[#E4F3EA] text-[#1B7A4A]"
        : "bg-[#E8F1F4] text-[#0F4C5C]";
  return (
    <span className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold tracking-wide ${cls}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}
