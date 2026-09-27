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
  return <PulseBoard pulse={pulse} companyName={getMeta(db, "company_name", "Atlas Medical Distribution")} />;
}
