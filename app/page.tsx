import { formatDay } from "@/lib/clock";
import { getDb } from "@/lib/db";
import { pulseBoard } from "@/lib/ui/attention";
import { PulseBoard } from "@/components/pulse/PulseBoard";

export const dynamic = "force-dynamic";

export default function PulsePage() {
  const board = pulseBoard(getDb());
  return (
    <PulseBoard
      nowLabel={formatDay(board.now)}
      counts={board.counts}
      needs={board.needs}
      monitoring={board.monitoring}
      handled={board.handled}
    />
  );
}
