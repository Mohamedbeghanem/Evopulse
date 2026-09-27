import type { Metadata } from "next";
import { TimeMachine } from "@/components/timeline/TimeMachine";
import { getDb } from "@/lib/db";
import { buildTimeMachine } from "./model";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Time Machine — EvoPulse",
  description:
    "What happened, what is true now, and what is still only expected — expected against observed, on one line of time.",
};

export default function TimelinePage() {
  const model = buildTimeMachine(getDb());

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <h1 className="font-serif text-4xl leading-[1.08] text-paper sm:text-5xl">
          What changed, what is true, and what comes next
        </h1>
        <p className="mt-4 text-sand">
          Not an activity feed. One continuous line: what was observed, what was expected,
          where the two diverged, and what is still only expected. The line runs solid
          behind now and dashed ahead of it — nothing ahead of now has happened yet.
        </p>
      </header>

      <TimeMachine model={model} />
    </div>
  );
}
