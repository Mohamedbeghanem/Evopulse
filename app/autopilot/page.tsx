import Link from "next/link";
import { Badge } from "@/components/Badge";
import { projectAttention } from "@/lib/attention";
import { getDb, getMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function AutopilotPage() {
  const db = getDb();
  const attention = projectAttention(db, getMeta(db, "demo_now"));
  const cards = [...attention.needsMe, ...attention.watching, ...attention.handled];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Exception Autopilot</p>
        <h1 className="mt-2 font-serif text-5xl">Control loop</h1>
        <p className="mt-3 max-w-2xl text-sand">
          {attention.summary.needsYou} need you · {attention.summary.needsApproval} need approval ·{" "}
          {attention.summary.blocked} blocked · {attention.summary.monitoring} monitoring. One situation, one
          classification.
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
              <p className="mt-2 text-sm text-sand">{card.summary}</p>
              <p className="mt-2 text-sm text-paper">{card.needsFromYou}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={card.href} className="rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink-950">
                  Review
                </Link>
                {card.autopilotDecisionId ? (
                  <Link href={`/autopilot/${card.autopilotDecisionId}`} className="text-sm underline underline-offset-4">
                    Why?
                  </Link>
                ) : null}
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
