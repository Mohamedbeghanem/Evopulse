import Link from "next/link";
import { Badge } from "@/components/Badge";
import { EmptyState, PageHeader } from "@/components/ui/chrome";
import { getDb } from "@/lib/db";
import { listGoalSummaries } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default function GoalsIndexPage() {
  const goals = listGoalSummaries(getDb()).filter((goal) => goal.goal_type);
  return (
    <div className="px-6 py-8 lg:px-10">
      <PageHeader kicker="Outcomes" title="What are we protecting?">
        <p>Command creates a real goal and a structured plan — not a chat reply. Plan generated ≠ goal achieved.</p>
      </PageHeader>
      {goals.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No outcome goals yet."
            body="From Command: Protect everything at risk this week."
          />
          <Link href="/command" className="mt-3 inline-block text-need underline underline-offset-4">
            Open Command
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Link href={`/goals/${goal.id}`} className="block border border-white/10 p-5 hover:border-need/50">
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
