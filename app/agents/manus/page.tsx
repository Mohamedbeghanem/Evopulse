import { ManusConsole } from "@/components/agents/ManusConsole";
import { InspectorPanel } from "@/components/shell/InspectorPanel";
import { Workspace } from "@/components/shell/Workspace";
import { PageHeader } from "@/components/ui/chrome";
import { describeManusTools, listManusRuns, loadManusRun, type ManusRunView } from "@/lib/agents/manus";
import { resolveOpenRouterConfig } from "@/lib/agent/openrouter";
import { withPageContext } from "@/lib/auth/page";
import { businessOverview } from "@/lib/business";

export const dynamic = "force-dynamic";

export default async function ManusAgentRunsPage({ searchParams }: { searchParams?: Promise<{ run?: string }> }) {
  const params = (await searchParams) || {};
  const data = await withPageContext((ctx) => {
    const runs = listManusRuns(ctx.db, 8);
    let current: ManusRunView | null = null;
    const pick = params.run || runs[0]?.id;
    if (pick) {
      try {
        current = loadManusRun(ctx.db, pick);
      } catch {
        current = null;
      }
    }
    return { company: businessOverview(ctx.db).company.name, runs, current, tools: describeManusTools(ctx.db) };
  });
  const configured = Boolean((process.env.OPENROUTER_API_KEY || "").trim());
  const model = configured ? resolveOpenRouterConfig().model : null;
  return (
    <Workspace
      mode="operational"
      inspector={
        <InspectorPanel title="How agent runs work">
          <p>Manus splits your goal into a plan and works through it step by step with EvoPulse tools.</p>
          <p className="mt-3">Read tools run directly. Anything consequential becomes an action that Policy checks and you approve. The agent cannot approve its own work, and executed is not handled until a reply verifies it.</p>
          <p className="mt-3">Tool output and business messages are treated as data, never as instructions.</p>
          <p className="mt-3 text-mute">Ported from OpenManus (MIT). No code execution, shell, file editing or browser.</p>
        </InspectorPanel>
      }
    >
      <PageHeader kicker={`${data.company} · Agents`} title="Agent runs">
        <p>Give Manus a goal. You see the plan, each step, what it thought, which tool it called, and what is waiting for you.</p>
      </PageHeader>
      <div className="mt-8">
        <ManusConsole initialRun={data.current} runs={data.runs} tools={data.tools} llm={{ configured, model }} />
      </div>
    </Workspace>
  );
}
