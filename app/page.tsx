import { PulseBoard } from "@/components/pulse/PulseBoard";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";

export const dynamic = "force-dynamic";

export default function PulsePage() {
  const db = getDb();
  const pulse = pulseSummary(db, getMeta(db, "demo_now"));
  return <PulseBoard pulse={pulse} />;
}
