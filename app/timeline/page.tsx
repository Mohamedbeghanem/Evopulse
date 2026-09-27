import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatDay } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { buildTimeline } from "@/lib/engine/timeline";
import { IDS } from "@/lib/ids";

export const dynamic = "force-dynamic";

export default function TimelinePage() {
  const timeline = buildTimeline(getDb());

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Business Time Machine</p>
        <h1 className="mt-2 font-serif text-5xl">Past · Now · Future</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Not a calendar. A record of what was supposed to happen against what did. The 320K spot is the
          Thursday send that never occurred.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Lane title="Past" caption="What happened" spots={timeline.past} />
        <Lane title="Now" caption="What requires attention" spots={timeline.nowLane} featured />
        <Lane title="Future" caption="What is expected" spots={timeline.future} />
      </div>

      <Link
        href={`/exceptions/${IDS.excMissed}`}
        className="inline-flex rounded-full bg-need px-5 py-2.5 text-sm font-medium text-ink-950"
      >
        Open the 320K exception
      </Link>
    </div>
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
      className={`rounded-2xl border p-5 ${featured ? "border-need/50 bg-need/5" : "border-white/10 bg-ink-800/40"}`}
    >
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{caption}</p>
      <h2 className="mt-1 font-serif text-3xl">{title}</h2>
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
