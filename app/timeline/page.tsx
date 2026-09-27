import Link from "next/link";
import { Badge } from "@/components/Badge";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { EventRow } from "@/components/ui/rows";
import { PageHeader } from "@/components/ui/chrome";
import { formatDay } from "@/lib/clock";
import { withPageContext } from "@/lib/auth/page";
import { eventsFor } from "@/lib/events";
import { buildTimeline } from "@/lib/engine/timeline";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default async function TimelinePage() {
  const { timeline, stream } = await withPageContext((ctx) => ({
    timeline: buildTimeline(ctx.db),
    stream: eventsFor(ctx.db).list({ limit: 80 }),
  }));

  return (
    <Workspace
      inspector={
        <InspectorPanel title="Time machine">
          <p>PAST → NOW → EXPECTED FUTURE.</p>
          <p className="mt-3">Distinguish EXPECTED, OBSERVED, DETECTED, PLANNED, EXECUTED, VERIFIED.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker="Timeline · Time machine" title="Past · Now · Expected future">
        <p>What was supposed to happen against what did. Expected is not observed.</p>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Lane title="Past" caption="What happened" spots={timeline.past} />
        <Lane title="Now" caption="What requires attention" spots={timeline.nowLane} featured />
        <Lane title="Future" caption="What is expected" spots={timeline.future} />
      </div>

      <Link href={`/situations/${IDS.excMissed}`} className="mt-6 inline-flex text-sm text-need">
        Open the 320K situation
      </Link>

      <section className="mt-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Unified event stream</p>
        <div className="mt-3">
          {stream.map((event) => (
            <EventRow
              key={event.id}
              time={formatDay(event.occurred_at)}
              kind={event.type}
              statement={`${event.source}${event.entity_type ? ` · ${event.entity_type}` : ""}${event.entity_id ? `/${event.entity_id}` : ""}`}
            />
          ))}
        </div>
      </section>
    </Workspace>
  );
}

function Lane({
  title,
  caption,
  spots,
  featured,
}: {
  title: string;
  caption: string;
  featured?: boolean;
  spots: ReturnType<typeof buildTimeline>["past"];
}) {
  return (
    <section className={`rounded-md border p-5 ${featured ? "border-need/40 bg-need/[0.06]" : "border-hairline bg-ink-800"}`}>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{caption}</p>
      <h2 className="mt-1 text-2xl text-paper">{title}</h2>
      <ol className="mt-5 space-y-4">
        {spots.length === 0 ? <li className="text-sm text-mute">Quiet.</li> : null}
        {spots.map((spot) => (
          <li key={spot.id} className="border-l border-white/10 pl-3">
            <p className="font-mono text-[11px] text-mute">{formatDay(spot.at)}</p>
            <p className="mt-1 text-paper">{spot.title}</p>
            <p className="text-sm text-sand">{spot.detail}</p>
            {spot.amount ? <Badge>320000 DZD</Badge> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
