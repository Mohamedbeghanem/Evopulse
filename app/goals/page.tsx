import Link from "next/link";
import { Badge } from "@/components/Badge";
import { getDb } from "@/lib/db";
import { listGoalSummaries } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default function GoalsIndexPage() {
  const goals = listGoalSummaries(getDb()).filter((goal) => goal.goal_type);
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Outcomes</p>
        <h1 className="mt-2 font-serif text-5xl">Goals</h1>
        <p className="mt-3 max-w-2xl text-sand">
          What are we trying to achieve? Command creates a real goal and a structured plan — not a chat reply.
        </p>
      </div>
      {goals.length === 0 ? (
        <p className="text-sand">
          No outcome goals yet. From Command, enter{" "}
          <Link href="/command" className="underline underline-offset-4">
            Protect everything at risk this week.
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Link
                href={`/goals/${goal.id}`}
                className="block rounded-2xl border border-white/10 bg-ink-800/40 p-5 hover:border-need/50"
              >
                <div className="flex flex-wrap gap-2">
                  <Badge>{goal.status}</Badge>
                  <Badge>{goal.goal_type}</Badge>
                </div>
                <h2 className="mt-3 font-serif text-2xl">{goal.objective || goal.name}</h2>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
