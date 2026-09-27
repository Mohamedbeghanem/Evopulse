import Link from "next/link";
import { Badge } from "@/components/Badge";
import { ExceptionAutopilotService } from "@/lib/autopilot";
import { getDb, getMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

const ATTENTION = ["BLOCKED", "NEEDS_YOU", "NEEDS_APPROVAL", "MONITORING", "AUTO_HANDLED", "HANDLED"] as const;

export default function AutopilotPage() {
  const db = getDb();
  const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(getMeta(db, "demo_now"));
  const cards = snapshot.cards.filter((card) => ATTENTION.includes(card.classification as (typeof ATTENTION)[number]));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Exception Autopilot</p>
        <h1 className="mt-2 font-serif text-5xl">Control loop</h1>
        <p className="mt-3 max-w-2xl text-sand">
          {snapshot.summary.needsYou} need you · {snapshot.summary.needsApproval} need approval ·{" "}
          {snapshot.summary.blocked} blocked · {snapshot.summary.monitoring} monitoring. Execution is not resolution.
        </p>
      </div>
      <div className="space-y-3">
        {cards.length ? (
          cards.map((card) => (
            <article key={card.id} className="rounded-2xl border border-white/10 bg-ink-800/40 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>{card.classification}</Badge>
                <Badge>{card.reasonCode}</Badge>
              </div>
              <h2 className="mt-3 font-serif text-2xl">{card.title}</h2>
              <p className="mt-2 text-sm text-sand">{card.whyItMatters}</p>
              <p className="mt-2 text-sm text-paper">{card.needsFromYou}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={card.href} className="rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink-950">
                  Review
                </Link>
                <Link href={`/autopilot/${card.id}`} className="text-sm underline underline-offset-4">
                  Why?
                </Link>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-2xl border border-white/10 p-5 text-sand">No situation needs attention.</p>
        )}
      </div>
    </div>
  );
}
