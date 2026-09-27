import { notFound } from "next/navigation";
import { EvidenceCanvas } from "@/components/trust/EvidenceCanvas";
import { formatDay, formatMoney } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";
import { exceptionDetail, policies } from "@/lib/read";

export const dynamic = "force-dynamic";

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const detail = exceptionDetail(db, id);
  if (!detail) notFound();
  const { exception, commitments, plan, actions, historicalEvidence } = detail;
  const rules = policies(db);
  const sources = [
    {
      id: "observed",
      kind: "OBSERVED",
      title: "Customer message",
      fact: exception.evidence.quote,
      extra: `${exception.evidence.source} · ${Math.round(exception.confidence * 100)}%`,
    },
    ...commitments.map((row) => ({
      id: row.id,
      kind: "DETECTED",
      title: row.actor === "company" ? "Our commitment" : "Customer commitment",
      fact: `${row.description} · ${row.status} · ${formatDay(row.deadline)}`,
    })),
    {
      id: "impact",
      kind: "IMPACT",
      title: "Stored impact",
      fact: `${formatMoney(exception.impact.revenueAssociated, exception.impact.currency)} associated · ${exception.impact.notes}`,
    },
    ...(plan
      ? [
          {
            id: plan.id,
            kind: "PLAN",
            title: plan.title,
            fact: `${plan.summary} · ${plan.status}`,
          },
        ]
      : []),
    {
      id: "policy",
      kind: "POLICY",
      title: "Policies",
      fact: rules.map((r) => `${r.key}=${r.value}`).join(" · "),
    },
    ...(actions[0]
      ? [
          {
            id: actions[0].id,
            kind: "ACTION",
            title: actions[0].title,
            fact: `${actions[0].status} · ${actions[0].policy_outcome}`,
          },
        ]
      : []),
    ...(historicalEvidence?.strategies.length
      ? [
          {
            id: "learning",
            kind: "OUTCOME",
            title: "Historical outcomes (synthetic seed)",
            fact: historicalEvidence.strategies.map((s) => `${s.label} ${s.successes}/${s.observations}`).join(" · "),
            extra: "Not this case. Not a prediction. Not silent model retraining.",
          },
        ]
      : []),
  ];

  return (
    <EvidenceCanvas
      id={id}
      quote={exception.evidence.quote}
      hideCascadeNote={id === IDS.excMissed}
      sources={sources}
    />
  );
}
