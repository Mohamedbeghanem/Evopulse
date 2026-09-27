import { EntryWorkspace } from "@/components/company/EntryWorkspace";
import { PulseBoard } from "@/components/pulse/PulseBoard";
import { workspaceMode } from "@/lib/company";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";
import { agentRoster, businessOverview } from "@/lib/business";
import { pulseCounts } from "@/lib/ui/pulse-counts";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams?: Promise<{ create?: string }> }) {
  const params = (await searchParams) || {};
  const db = getDb();
  // `/?create=1` (landing page CTA) shows the Create a company surface without touching state until submit.
  if (workspaceMode(db) !== "running" || params.create === "1") {
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
    />
  );
}
