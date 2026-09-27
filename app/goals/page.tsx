import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Workspace } from "@/components/shell/Workspace";
import { EmptyState, PageHeader } from "@/components/ui/chrome";
import { getDb } from "@/lib/db";
import { listGoalSummaries } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default function GoalsIndexPage() {
  const goals = listGoalSummaries(getDb()).filter((goal) => goal.goal_type);
  return (
    <Workspace>
      <PageHeader kicker="Goals · Outcomes" title="What are we protecting?">
        <p>Command creates a real goal and a structured plan — not a chat reply.</p>
      </PageHeader>
      {goals.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No outcome goals yet"
            body="From Command, ask EvoPulse to protect everything at risk this week."
          />
          <Link href="/command" className="mt-4 inline-flex text-sm text-need">
            Open Command
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Link href={`/goals/${goal.id}`} className="block rounded-md border border-hairline bg-ink-800 p-5 hover:border-need/50">
                <div className="flex flex-wrap gap-2">
                  <Badge>{goal.status}</Badge>
                  <Badge>{goal.goal_type}</Badge>
                </div>
                <h2 className="mt-3 text-2xl text-paper">{goal.objective || goal.name}</h2>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Workspace>
  );
}
