"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EventRow } from "@/components/ui/rows";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader } from "@/components/ui/chrome";
import { Tabs } from "@/components/ui/primitives";
import { Workspace } from "@/components/shell/Workspace";
import { InspectorField } from "@/components/shell/Inspector";
import { formatDay } from "@/lib/clock";
import { IDS } from "@/lib/ids";
import { tapeKindForEvent } from "@/lib/ui/event-kind";

type TimelinePayload = {
  past: Spot[];
  nowLane: Spot[];
  future: Spot[];
};

type Spot = {
  id: string;
  at: string;
  title: string;
  detail: string;
  amount?: number;
};

type EventItem = {
  id: string;
  type: string;
  occurred_at: string;
  source: string;
  entity_type?: string | null;
  entity_id?: string | null;
};

export default function TimelinePage() {
  const [data, setData] = useState<{ timeline: TimelinePayload; events: EventItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [selected, setSelected] = useState<EventItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetch("/api/timeline"), fetch("/api/events?limit=80")])
      .then(async ([timelineRes, eventsRes]) => {
        const timeline = await timelineRes.json();
        const events = await eventsRes.json();
        if (!timelineRes.ok) throw new Error(timeline.error || "Timeline could not be read.");
        if (!cancelled) {
          setData({
            timeline: timeline.past ? timeline : timeline.timeline || timeline,
            events: events.events || events,
          });
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Timeline could not be read.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const events = useMemo(() => {
    const list = Array.isArray(data?.events) ? data!.events : [];
    if (filter === "ALL") return list;
    return list.filter((event) => tapeKindForEvent(event.type) === filter);
  }, [data, filter]);

  if (error) {
    return (
      <div className="px-6 py-8">
        <ErrorState title="Timeline could not be read." body={error} />
        <Link href="/" className="mt-4 inline-block text-need underline underline-offset-4">
          Pulse remains reachable
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="px-6 py-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Past</p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Now</p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Expected future</p>
        <div className="mt-6">
          <LoadingState label="Reading the tape…" />
        </div>
      </div>
    );
  }

  const timeline = data.timeline;

  return (
    <Workspace
      inspectorTitle="Mark"
      inspectorOpen={Boolean(selected)}
      onInspectorClose={() => setSelected(null)}
      inspector={
        selected ? (
          <>
            <InspectorField label="Kind" value={tapeKindForEvent(selected.type)} />
            <InspectorField label="Clock" value={formatDay(selected.occurred_at)} />
            <InspectorField label="Type" value={selected.type} />
            <InspectorField label="Source" value={selected.source} />
            <InspectorField label="Object" value={selected.entity_id || "—"} />
          </>
        ) : (
          <p className="text-sm text-sand">Select a mark on the tape.</p>
        )
      }
    >
      <PageHeader kicker="Business Time Machine" title="Past · Now · Expected future.">
        <p>Not an activity feed. What was supposed to happen against what did, with one attention object at NOW.</p>
      </PageHeader>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Lane title="Past" spots={timeline.past || []} />
        <Lane title="Now" spots={timeline.nowLane || []} featured href={`/situations/${IDS.excMissed}`} />
        <Lane title="Expected future" spots={timeline.future || []} />
      </div>

      <div className="mt-10">
        <SectionHeader title="Tape" />
        <div className="mt-4">
          <Tabs
            value={filter}
            onChange={setFilter}
            tabs={["ALL", "EXPECTED", "OBSERVED", "DETECTED", "PLANNED", "EXECUTED", "VERIFIED"].map((id) => ({
              id,
              label: id,
            }))}
          />
        </div>
        {events.length === 0 ? (
          <EmptyState title="Nothing on the tape for this scope." body="Show me what changed today." />
        ) : (
          <ol className="mt-4">
            {events.map((event) => (
              <button key={event.id} type="button" className="block w-full text-left" onClick={() => setSelected(event)}>
                <EventRow
                  kind={tapeKindForEvent(event.type)}
                  at={formatDay(event.occurred_at)}
                  title={event.type}
                  detail={`${event.source}${event.entity_type ? ` · ${event.entity_type}` : ""}`}
                />
              </button>
            ))}
          </ol>
        )}
      </div>
    </Workspace>
  );
}

function Lane({
  title,
  spots,
  featured,
  href,
}: {
  title: string;
  spots: Spot[];
  featured?: boolean;
  href?: string;
}) {
  return (
    <section className={`border p-5 ${featured ? "border-need/50 bg-need/5" : "border-white/10"}`}>
      <h2 className="font-serif text-3xl">{title}</h2>
      <ol className="mt-4 space-y-3">
        {spots.length === 0 ? <li className="text-sm text-mute">Quiet.</li> : null}
        {spots.map((spot) => (
          <li key={spot.id}>
            <p className="font-mono text-[11px] text-mute">{formatDay(spot.at)}</p>
            <p className="mt-1 text-paper">{spot.title}</p>
            <p className="text-sm text-sand">{spot.detail}</p>
          </li>
        ))}
      </ol>
      {href ? (
        <Link href={href} className="mt-4 inline-block text-sm text-need underline underline-offset-4">
          Review recovery
        </Link>
      ) : null}
    </section>
  );
}
