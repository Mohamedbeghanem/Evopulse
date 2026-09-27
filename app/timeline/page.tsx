import Link from "next/link";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { formatDay } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { eventsFor } from "@/lib/events";
import { buildTimeline } from "@/lib/engine/timeline";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default function TimelinePage() {
  const db = getDb();
  const timeline = buildTimeline(db);
  const stream = eventsFor(db).list({ limit: 80 });

  return (
    <Workspace
      inspector={
        <InspectorPanel title="Time machine">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Clock</p>
          <p className="mt-2 text-[#0D1B24]">PAST → NOW → EXPECTED FUTURE.</p>
          <p className="mt-3 text-[#5C6B73]">Distinguish EXPECTED, OBSERVED, DETECTED, PLANNED, EXECUTED, VERIFIED.</p>
        </InspectorPanel>
      }
    >
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Time Machine</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">Past · Now · Expected future</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          What was supposed to happen against what did. Expected is not observed.
        </p>
        <p className="mt-3 flex flex-wrap gap-4">
          <Link href="/business" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Business
          </Link>
          <Link href="/simulate" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Simulate
          </Link>
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          <Lane title="Past" caption="What happened" spots={timeline.past} />
          <Lane title="Now" caption="What requires attention" spots={timeline.nowLane} featured />
          <Lane title="Future" caption="What is expected" spots={timeline.future} />
        </div>

        <Link
          href={`/situations/${IDS.excMissed}`}
          className="mt-6 inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white"
        >
          Open the 320K situation
        </Link>

        <section className="mt-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Unified event stream</p>
          <div className="mt-3 space-y-2">
            {stream.map((event) => (
              <article key={event.id} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-3">
                <p className="font-mono text-[11px] text-[#5C6B73]">{formatDay(event.occurred_at)}</p>
                <h3 className="mt-1 text-[15px] font-semibold">{event.type}</h3>
                <p className="text-[13px] text-[#5C6B73]">
                  {event.source}
                  {event.entity_type ? ` · ${event.entity_type}` : ""}
                  {event.entity_id ? `/${event.entity_id}` : ""}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
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
    <section
      className={`rounded-[14px] border bg-[#FFFEFB] p-5 ${featured ? "border-[#EC6025]" : "border-[#D8DDD6]"}`}
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5C6B73]">{caption}</p>
      <h2 className="mt-1 text-base font-semibold">{title}</h2>
      <ol className="mt-5 border-l-2 border-[#D8DDD6] pl-4">
        {spots.length === 0 ? <li className="text-sm text-[#5C6B73]">Quiet.</li> : null}
        {spots.map((spot) => (
          <li key={spot.id} className="relative pb-4">
            <span
              className={`absolute -left-[21px] top-1.5 h-2 w-2 rounded-full ${featured ? "bg-[#EC6025]" : "bg-[#5C6B73]"}`}
            />
            <p className="font-mono text-[11px] text-[#5C6B73]">{formatDay(spot.at)}</p>
            <p className="mt-1 font-semibold">{spot.title}</p>
            <p className="text-sm text-[#5C6B73]">{spot.detail}</p>
            {spot.amount ? (
              <span className="mt-2 inline-flex rounded-full bg-[#FDE8DC] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#B33A0F]">
                320000 DZD
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
