"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/Badge";
import { InspectorField } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader, SectionHeader } from "@/components/ui/chrome";
import { formatMoney } from "@/lib/clock";
import type { TwinDomain } from "@/lib/engine/twin";
import type { GraphImpact } from "@/lib/types";

type Selectable = {
  kind: string;
  id: string;
  label: string;
  status?: string;
  detail?: string;
};

export function TwinCanvas({
  delayed,
  domains,
  impact,
  nodes,
  edges,
  situations,
  commitments,
  expectations,
  events,
}: {
  delayed: boolean;
  domains: TwinDomain[];
  impact: GraphImpact | null;
  nodes: { id: string; kind: string; label: string; status?: string }[];
  edges: { from: string; to: string; label: string }[];
  situations: { id: string; title: string; projection: string }[];
  commitments: { id: string; label: string; status: string }[];
  expectations: { id: string; label: string; status: string }[];
  events: { id: string; type: string; source: string }[];
}) {
  const initial = nodes.find((n) => n.id === "ent_ship_204") || nodes[0];
  const [selected, setSelected] = useState<Selectable | null>(
    initial ? { kind: initial.kind, id: initial.id, label: initial.label, status: initial.status } : null,
  );

  return (
    <Workspace
      inspectorTitle="Object"
      inspector={
        selected ? (
          <>
            <InspectorField label="Kind" value={selected.kind} />
            <InspectorField label="Object" value={selected.label} />
            <InspectorField label="Status" value={selected.status || "—"} />
            <InspectorField label="Id" value={selected.id} />
            {selected.detail ? <InspectorField label="Reading" value={selected.detail} /> : null}
            <p className="text-xs text-mute">Source · evidence · expected vs actual live on Situation / Evidence.</p>
          </>
        ) : (
          <p className="text-sm text-sand">Select a domain or object. Primary action is inspect.</p>
        )
      }
    >
      <PageHeader kicker="LIVE TWIN · not a simulation" title="What EvoPulse already understands.">
        <p>
          Companies, customers, suppliers, orders, shipments, invoices, commitments, expectations, goals, events,
          situations, and named relationships. Not a CRM contact database.
          {delayed && impact
            ? ` ${formatMoney(impact.associated_revenue, impact.currency)} associated revenue. ${formatMoney(impact.affected_expected_cash, impact.currency)} expected cash timing.`
            : " Trigger Supplier Delay to attach 850K / 540K cascade sums."}
        </p>
      </PageHeader>

      <section className="mt-8">
        <SectionHeader title="Domains" />
        <div className="mt-4 flex flex-wrap gap-2 lg:grid lg:grid-cols-5">
          {domains.map((domain) => (
            <button
              key={domain.id}
              type="button"
              onClick={() =>
                setSelected({
                  kind: "domain",
                  id: domain.id,
                  label: domain.id,
                  status: domain.status,
                  detail: domain.headline,
                })
              }
              className="min-w-[9rem] flex-1 border border-white/10 p-3 text-left hover:border-need/40"
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{domain.id}</p>
              <Badge>{domain.status}</Badge>
              <p className="mt-2 text-sm text-sand">{domain.headline}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-10 hidden md:block">
        <SectionHeader title="Cascade" />
        <p className="mt-3 text-sm text-sand">
          Atlas Supply → SH-204 → RK-7 → Orders A/B/C → customers → invoices → cash week. Visual may simplify at 1024.
        </p>
      </section>

      <section className="mt-10">
        <SectionHeader title="Textual reading" />
        <ol id="graph-reading" className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 text-sm text-sand">
          {edges.slice(0, 16).map((edge) => (
            <li key={`${edge.from}-${edge.to}-${edge.label}`}>
              {labelOf(nodes, edge.from)} <span className="text-mute">{edge.label}</span> {labelOf(nodes, edge.to)}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeader title="Commitments" count={commitments.length} />
          <ul className="mt-3 space-y-2 text-sm">
            {commitments.map((item) => (
              <li key={item.id}>
                <button type="button" className="text-left" onClick={() => setSelected({ kind: "commitment", ...item })}>
                  <Badge>{item.status}</Badge> <span className="text-sand">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <SectionHeader title="Expectations" count={expectations.length} />
          <ul className="mt-3 space-y-2 text-sm">
            {expectations.map((item) => (
              <li key={item.id}>
                <button type="button" className="text-left" onClick={() => setSelected({ kind: "expectation", ...item })}>
                  <Badge>{item.status}</Badge> <span className="text-sand">{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-10">
        <SectionHeader title="Situations" />
        <ul className="mt-3 space-y-2">
          {situations.map((item) => (
            <li key={item.id}>
              <Link href={`/situations/${item.id}`} className="text-sm text-need underline underline-offset-4">
                {item.projection.replaceAll("_", " ")} · {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <SectionHeader title="Recent events" />
        <ul className="mt-3 space-y-1 font-mono text-xs text-mute">
          {events.map((event) => (
            <li key={event.id}>
              {event.type} · {event.source}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <Link href="/graph" className="underline underline-offset-4">
            Stored graph
          </Link>
          <Link href="/" className="underline underline-offset-4">
            Pulse
          </Link>
        </div>
      </section>
    </Workspace>
  );
}

function labelOf(nodes: { id: string; label: string }[], id: string) {
  return nodes.find((n) => n.id === id)?.label || id;
}
