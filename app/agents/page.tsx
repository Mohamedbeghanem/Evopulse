import { AgentList } from "@/components/agents/AgentList";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { withPageContext } from "@/lib/auth/page";
import { agentRoster, businessOverview } from "@/lib/business";
import { getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";
import { pulseCounts } from "@/lib/ui/pulse-counts";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const { agents, company } = await withPageContext((ctx) => {
    const pulse = pulseSummary(ctx.db, getMeta(ctx.db, "demo_now"));
    const overview = businessOverview(ctx.db);
    return { agents: agentRoster(ctx.db, pulseCounts(pulse.attention.summary), overview), company: overview.company.name };
  });
  return (
    <Workspace
      mode="operational"
      inspector={
        <InspectorPanel title="How agents work">
          <p>Agents investigate and propose. Policy decides permission. Nothing executes without the governed path.</p>
          <p className="mt-3">Activity is read from your business events, graph and plans — nothing is invented.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker={`${company} · Agents`} title="Your agents are watching.">
        <p>Each agent covers one part of the business. Recent activity reflects the current state.</p>
      </PageHeader>
      <div className="mt-8">
        <AgentList agents={agents} />
      </div>
    </Workspace>
  );
}
