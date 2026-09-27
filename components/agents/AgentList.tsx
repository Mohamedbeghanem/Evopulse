import { StatusBadge } from "@/components/ui/badges";
import type { AgentCard } from "@/lib/business/agents";

export function AgentList({ agents, compact = false }: { agents: AgentCard[]; compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-3 md:grid-cols-2"}>
      {agents.map((agent) => (
        <article key={agent.id} className="rounded-md border border-hairline bg-ink-800 p-4" data-agent={agent.id}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-paper">{agent.name}</p>
            <StatusBadge value={agent.status === "ATTENTION" ? "ATTENTION" : "MONITORING"} />
          </div>
          <p className="mt-1 text-xs text-mute">{agent.scope}</p>
          <ul className="mt-3 space-y-1 text-sm text-sand">
            {(compact ? agent.activity.slice(0, 3) : agent.activity).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
