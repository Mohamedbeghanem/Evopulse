import { EntryWorkspace } from "@/components/company/EntryWorkspace";
import { PulseBoard } from "@/components/pulse/PulseBoard";
import { workspaceMode } from "@/lib/company";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";
import { agentRoster, businessOverview } from "@/lib/business";
import { pulseCounts } from "@/lib/ui/pulse-counts";
import { demoPath } from "@/lib/demo-loop/demo-path";
import { pulseOutcome } from "@/lib/demo-loop/outcomes";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const db = getDb();
  if (workspaceMode(db) !== "running") {
    return <EntryWorkspace />;
  }
  const pulse = pulseSummary(db, getMeta(db, "demo_now"));
  const board = {
    headline: pulse.headline,
    attention: {
      needsMe: pulse.attention.needsMe,
      watching: pulse.attention.watching,
      handled: pulse.attention.handled,
      summary: pulse.attention.summary,
    },
  };
  const overview = businessOverview(db);
  const agents = agentRoster(db, pulseCounts(pulse.attention.summary), overview);
  return (
    <PulseBoard
      pulse={JSON.parse(JSON.stringify(board))}
      companyName={overview.company.name || getMeta(db, "company_name")}
      agents={JSON.parse(JSON.stringify(agents))}
      outcome={JSON.parse(JSON.stringify(pulseOutcome(db)))}
      demoPath={JSON.parse(JSON.stringify(demoPath(db)))}
    />
  );
}
