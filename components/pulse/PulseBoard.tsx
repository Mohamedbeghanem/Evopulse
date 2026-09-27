"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { InspectorField } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { Button } from "@/components/ui/primitives";
import { EmptyState, PageHeader, SectionHeader } from "@/components/ui/chrome";
import { SituationRow } from "@/components/ui/rows";
import { formatMoney } from "@/lib/clock";
import type { Situation } from "@/lib/ui/attention";

export function PulseBoard({
  nowLabel,
  counts,
  needs,
  monitoring,
  handled,
}: {
  nowLabel: string;
  counts: { needsYou: number; monitoring: number; handled: number };
  needs: Situation[];
  monitoring: Situation[];
  handled: Situation[];
}) {
  const all = useMemo(() => [...needs, ...monitoring, ...handled], [needs, monitoring, handled]);
  const [selectedId, setSelectedId] = useState(all[0]?.id ?? "");
  const [ask, setAsk] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const selected = all.find((item) => item.id === selectedId) ?? all[0];

  async function askAbout() {
    if (!selected) return;
    setAsking(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: selected.id.includes("delay") ? "Why is 850K at risk?" : "What requires my attention?",
        }),
      });
      const data = await res.json();
      setAsk(data.answer || data.error || "Could not ground that.");
    } catch {
      setAsk("Ask failed. Deterministic Pulse still holds the situation.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <Workspace
      inspectorTitle="Situation"
      inspectorOpen={Boolean(selected)}
      inspector={
        selected ? (
          <>
            <h2 className="font-serif text-3xl leading-tight">{selected.title}</h2>
            <InspectorField label="Source" value={selected.source} />
            <InspectorField label="Evidence" value={`“${selected.quote}”`} />
            <InspectorField label="Expected" value={selected.expected} />
            <InspectorField label="Actual" value={selected.actual} />
            <InspectorField label="Confidence" value={`${Math.round(selected.confidence * 100)}%`} />
            {selected.money ? (
              <InspectorField
                label="Value"
                value={`${formatMoney(selected.money.amount, selected.money.currency)} · ${selected.money.caption}`}
              />
            ) : null}
            {selected.cashTiming ? (
              <InspectorField
                label="Expected cash timing"
                value={`${formatMoney(selected.cashTiming.amount, selected.cashTiming.currency)} — timing, not lost`}
              />
            ) : null}
            <div className="flex flex-col gap-2">
              <Link href={selected.primaryHref} className="inline-flex min-h-10 items-center justify-center rounded-full bg-need px-4 text-sm font-medium text-ink-950">
                {selected.primaryLabel}
              </Link>
              <Link href={`/situations/${selected.id}`} className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/15 px-4 text-sm">
                Why?
              </Link>
            </div>
            <Button variant="quiet" type="button" onClick={() => void askAbout()}>
              {asking ? "Reading state…" : "Ask EvoPulse about this…"}
            </Button>
            {ask ? <p className="text-sm text-sand">{ask}</p> : null}
          </>
        ) : null
      }
    >
      <PageHeader kicker={`${nowLabel} · Business Pulse`} title="Your business is running.">
        <p>What needs a human. One situation is one attention object.</p>
      </PageHeader>
      <ul className="mt-8 space-y-2 text-xl text-sand">
        <li>
          <b className="mr-3 font-mono text-need">{counts.needsYou}</b> need you
        </li>
        <li>
          <b className="mr-3 font-mono text-ice">{counts.monitoring}</b> monitoring
        </li>
        <li>
          <b className="mr-3 font-mono text-ok">{counts.handled}</b> handled
        </li>
      </ul>

      <div className="mt-12 space-y-10">
        <BoardSection title="Needs you" count={needs.length} items={needs} selectedId={selectedId} onSelect={setSelectedId} empty="Nothing needs you." />
        <BoardSection title="Monitoring" count={monitoring.length} items={monitoring} selectedId={selectedId} onSelect={setSelectedId} empty="Nothing is being watched." />
        <BoardSection title="Handled" count={handled.length} items={handled} selectedId={selectedId} onSelect={setSelectedId} empty="Nothing handled automatically." />
      </div>
    </Workspace>
  );
}

function BoardSection({
  title,
  count,
  items,
  selectedId,
  onSelect,
  empty,
}: {
  title: string;
  count: number;
  items: Situation[];
  selectedId: string;
  onSelect: (id: string) => void;
  empty: string;
}) {
  return (
    <section>
      <SectionHeader title={title} count={count} />
      {items.length === 0 ? (
        <EmptyState title={empty} body="Pulse is quiet in this lane." />
      ) : (
        <div>
          {items.map((item) => (
            <SituationRow key={item.id} situation={item} selected={item.id === selectedId} onSelect={() => onSelect(item.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

