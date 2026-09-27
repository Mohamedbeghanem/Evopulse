import { PulseBoard } from "@/components/pulse/PulseBoard";
import { getDb, getMeta } from "@/lib/db";
import { pulseSummary } from "@/lib/engine/pulse";
import { toPlain } from "@/lib/plain";

export const dynamic = "force-dynamic";

export default function DemoPulsePage() {
  const db = getDb();
  const pulse = pulseSummary(db, getMeta(db, "demo_now"));
  return <PulseBoard pulse={toPlain({ headline: pulse.headline, attention: pulse.attention })} />;
}
