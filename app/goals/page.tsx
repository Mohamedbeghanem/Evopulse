import Link from "next/link";
import { Workspace } from "@/components/shell/Workspace";
import { getDb } from "@/lib/db";
import { listGoalSummaries } from "@/lib/goals";

export const dynamic = "force-dynamic";

export default function GoalsIndexPage() {
  const goals = listGoalSummaries(getDb()).filter((goal) => goal.goal_type);
  return (
    <Workspace>
      <div className="bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Goals</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">What are we protecting?</h1>
        <p className="mt-2 max-w-[640px] text-[15px] text-[#5C6B73]">
          Command creates a real goal and a structured plan — not a chat reply.
        </p>
        <p className="mt-3">
          <Link href="/command" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Command
          </Link>
        </p>
        {goals.length === 0 ? (
          <div className="mt-8">
            <p className="text-xl font-semibold">No outcome goals yet</p>
            <p className="mt-2 text-sm text-[#5C6B73]">
              From Command, ask EvoPulse to protect everything at risk this week.
            </p>
            <Link
              href="/command"
              className="mt-4 inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white"
            >
              Open Command
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-2">
            {goals.map((goal) => (
              <li key={goal.id}>
                <Link
                  href={`/goals/${goal.id}`}
                  className="flex gap-3.5 rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-3.5 py-3.5 hover:border-[#EC6025]/40"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="text-[15px] font-semibold">{goal.objective || goal.name}</h2>
                    <p className="mt-1 text-[13px] text-[#5C6B73]">
                      {goal.status} · {goal.goal_type}
                    </p>
                  </div>
                  <span className="inline-flex h-[22px] items-center rounded-full bg-[#FDE8DC] px-2 text-[11px] font-semibold tracking-wide text-[#B33A0F]">
                    {goal.status.replaceAll("_", " ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Workspace>
  );
}
