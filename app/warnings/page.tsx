import Link from "next/link";
import { Badge } from "@/components/Badge";
import { getDb, getMeta } from "@/lib/db";
import {
  businessTwin,
  evaluateEarlyWarnings,
  formatHours,
  groupActiveWarnings,
  type WarningView,
} from "@/lib/engine/warnings";

export const dynamic = "force-dynamic";

const GROUP_ORDER = ["CRITICAL", "HIGH", "MONITORING"] as const;

export default function WarningsPage() {
  const db = getDb();
  const now = getMeta(db, "demo_now");
  const warnings = evaluateEarlyWarnings(db, now);
  const groups = groupActiveWarnings(warnings);
  const twin = businessTwin(warnings);
  const activeCount = GROUP_ORDER.reduce((sum, key) => sum + groups[key].length, 0);

  return (
    <div className="space-y-10">
      <header>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Before failure</p>
        <h1 className="mt-2 font-serif text-5xl">Early Warnings</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Problems EvoPulse sees forming before they become exceptions.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <Domain name="Operations" status={twin.operations.status} line={twin.operations.line} />
        <Domain name="Customers" status={twin.customers.status} line={twin.customers.line} />
        <Domain name="Cash" status={twin.cash.status} line={twin.cash.line} />
      </section>

      {activeCount === 0 ? (
        <p className="rounded-2xl border border-white/10 p-5 text-sand">
          No early warnings. Nothing is approaching a failure.
        </p>
      ) : (
        GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => (
          <section key={key} className="space-y-3">
            <h2 className="font-serif text-3xl capitalize">{key.toLowerCase()}</h2>
            <div className="space-y-3">
              {groups[key].map((warning) => (
                <WarningCard key={warning.id} warning={warning} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function Domain({ name, status, line }: { name: string; status: string; line: string }) {
  const tone = status === "AT RISK" ? "text-miss" : status === "MONITORING" ? "text-need" : "text-ok";
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">{name}</p>
      <p className={`mt-2 font-mono text-sm ${tone}`}>{status}</p>
      <p className="mt-2 text-sm text-sand">{line}</p>
    </div>
  );
}

function WarningCard({ warning }: { warning: WarningView }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge>{warning.severity}</Badge>
            <Badge>{warning.bufferState}</Badge>
          </div>
          <h3 className="mt-3 font-serif text-2xl">{warning.headline}</h3>
          <p className="mt-1 text-sm text-sand">{warning.summary}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xl text-need">{warning.valueLabel}</p>
          <p className="text-sm text-sand">{warning.timeLabel}</p>
        </div>
      </div>
      {warning.children.length ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {warning.children.map((child) => (
            <li key={child.entityId} className="rounded-xl bg-ink-900/80 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm">{child.label}</span>
                <Badge>{child.state}</Badge>
              </div>
              <p className="mt-1 font-mono text-[11px] text-mute">
                {child.state === "AT_RISK"
                  ? `${formatHours(child.shortfallHours)} short`
                  : `${formatHours(child.bufferHours)} buffer`}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <Link href={`/warnings/${warning.id}`} className="text-ice">
          Why?
        </Link>
        <span className="text-mute">
          {warning.entityLabel} · {Math.round(warning.confidence * 100)}% · {warning.source}
        </span>
      </div>
    </article>
  );
}
