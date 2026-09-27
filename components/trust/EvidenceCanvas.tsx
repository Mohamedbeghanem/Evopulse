"use client";

import Link from "next/link";
import { useState } from "react";
import { EvidenceRow } from "@/components/ui/rows";
import { PageHeader, SectionHeader } from "@/components/ui/chrome";
import { Workspace } from "@/components/shell/Workspace";
import { InspectorField } from "@/components/shell/Inspector";

export function EvidenceCanvas({
  id,
  quote,
  hideCascadeNote,
  sources,
}: {
  id: string;
  quote: string;
  hideCascadeNote: boolean;
  sources: { id: string; kind: string; title: string; fact: string; extra?: string }[];
}) {
  const [current, setCurrent] = useState(sources[0]?.id ?? "");
  const selected = sources.find((s) => s.id === current) ?? sources[0];

  return (
    <Workspace
      inspectorTitle="Source"
      inspector={
        selected ? (
          <>
            <InspectorField label="Kind" value={selected.kind} />
            <InspectorField label="Object" value={selected.title} />
            <InspectorField label="Fact" value={selected.fact} />
            {selected.extra ? <InspectorField label="Note" value={selected.extra} /> : null}
          </>
        ) : null
      }
    >
      <PageHeader kicker="Evidence · Why should I trust this?" title="Grounded chain. No hidden reasoning.">
        <p>
          OBSERVED → DETECTED → IMPACT → PLAN → POLICY → ACTION → VERIFICATION → OUTCOME. Verification stays queued
          until a verifiable action executes. EXECUTED is not HANDLED.
        </p>
      </PageHeader>
      <ol className="mt-8 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
        {["OBSERVED", "DETECTED", "IMPACT", "PLAN", "POLICY", "ACTION", "VERIFICATION", "OUTCOME"].map((step, index) => (
          <li key={step} className={index < 6 ? "text-paper" : undefined}>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <SectionHeader title="Brief" />
          <blockquote className="mt-4 font-serif text-2xl leading-snug">“{quote}”</blockquote>
          {hideCascadeNote ? (
            <p className="mt-4 text-sm text-mute">
              Not this claim: SH-204 / 850K / 540K is a second demo path after Trigger Supplier Delay.
            </p>
          ) : null}
        </div>
        <div>
          <SectionHeader title="Sources" count={sources.length} />
          {sources.map((source, index) => (
            <EvidenceRow
              key={source.id}
              index={String(index + 1).padStart(2, "0")}
              kind={source.kind}
              title={source.title}
              fact={source.fact}
              current={source.id === current}
              onSelect={() => setCurrent(source.id)}
            />
          ))}
        </div>
      </div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href={`/verification/${id}`} className="text-need underline underline-offset-4">
          Open verification
        </Link>
        <Link href={`/situations/${id}`} className="underline underline-offset-4">
          Situation
        </Link>
      </div>
    </Workspace>
  );
}
