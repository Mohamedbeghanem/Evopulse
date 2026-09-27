import { EntryWorkspace } from "@/components/company/EntryWorkspace";
import { PulseBoard } from "@/components/pulse/PulseBoard";
import { workspaceMode } from "@/lib/company";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";

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
  return (
    <PulseBoard
      pulse={JSON.parse(JSON.stringify(board))}
      companyName={getMeta(db, "company_name", "Atlas Medical Distribution")}
    />
  );
}
