import Link from "next/link";
import { formatDay, formatMoney } from "@/lib/clock";
import type { PulseOutcome } from "@/lib/demo-loop/outcomes";

/** Before/after outcome, computed from engine state. Associated revenue and cash timing stay separate. */
export function OutcomePanel({ outcome }: { outcome: PulseOutcome }) {
  if (!outcome.exposure.length) return null;
  const { currency } = outcome;
  const safe = outcome.protected;
  return (
    <section id="outcome" className="mt-10 space-y-4" aria-label="Outcome" data-testid="outcome-panel">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Outcome · before → after</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-hairline p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">Before · exposure detected</p>
          <ul className="mt-3 space-y-3">
            {outcome.exposure.map((item) => (
              <li key={item.exceptionId} className="text-sm" data-testid={`exposure-${item.exceptionId}`}>
                <Link href={`/situations/${item.exceptionId}`} className="text-paper hover:text-need">
                  {item.title}
                </Link>
                <p className="mt-1 font-mono text-xs text-sand">
                  {formatMoney(item.associatedRevenue, currency)} associated revenue
                  {item.expectedCashTiming !== null ? ` · ${formatMoney(item.expectedCashTiming, currency)} expected cash timing` : ""}
                </p>
                <p className="mt-1 text-xs text-mute">
                  Detected {formatDay(item.detectedAt)}
                  {item.wouldSurfaceAt ? ` · ${item.surfaceBasis} ${formatDay(item.wouldSurfaceAt)}` : ""}
                  {item.leadMinutes !== null ? ` · ${leadLabel(item.leadMinutes)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-hairline p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">After · value protected (verified only)</p>
          <p className="mt-3 font-mono text-xl text-paper" data-testid="protected-revenue">
            {formatMoney(safe.associatedRevenue, currency)}
          </p>
          <p className="text-xs text-mute">associated revenue on situations HANDLED through verification</p>
          <p className="mt-3 font-mono text-base text-paper" data-testid="protected-cash">
            {formatMoney(safe.expectedCashTiming, currency)}
          </p>
          <p className="text-xs text-mute">expected cash timing protected</p>
          <p className="mt-3 text-xs text-sand">
            {safe.verifiedSituations} verified · {safe.pendingVerification} awaiting a reply. Executed actions count only after
            the reply verifies them.
          </p>
        </div>
      </div>
    </section>
  );
}

function leadLabel(minutes: number) {
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const text = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${abs % 60}m`;
  return minutes >= 0 ? `${text} before it would surface` : `detected ${text} after it was due`;
}
