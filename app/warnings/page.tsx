import Link from "next/link";
import { Badge } from "@/components/Badge";
import { getDb } from "@/lib/db";
import { EarlyWarningEngine, formatHours } from "@/lib/warnings";

export const dynamic = "force-dynamic";

export default function WarningsPage() {
  const engine = EarlyWarningEngine.for(getDb());
  const rank = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
  const rows = engine.list().map((row) => engine.summarize(row));
  const byUrgency = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
    (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || a.shortfall_minutes - b.shortfall_minutes;
  const active = rows.filter((row) => row.status === "ACTIVE").sort(byUrgency);
  const monitoring = rows.filter((row) => row.status === "MONITORING").sort(byUrgency);
  const resolved = rows.filter((row) => row.status === "RESOLVED" || row.status === "ESCALATED");

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Early warning</p>
        <h1 className="mt-2 font-serif text-5xl">Warnings</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Failure has not occurred yet. These are timing risks under current assumptions — not missed
          exceptions.
        </p>
      </div>

      <Section title="Active" items={active} />
      <Section title="Monitoring" items={monitoring} />
      <Section title="Resolved" items={resolved} />
    </div>
  );
}

function Section({
  title,
  items,
}: {
  title: string;
  items: ReturnType<EarlyWarningEngine["summarize"]>[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-3xl">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-mute">None.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
              <div className="flex flex-wrap gap-2">
                <Badge>{item.status}</Badge>
                <Badge>{item.buffer_state}</Badge>
                <Badge>{item.severity}</Badge>
              </div>
              <h3 className="mt-3 font-serif text-2xl">{item.title}</h3>
              <p className="mt-1 text-sm text-sand">
                {formatHours(item.available_buffer_minutes)} available ·{" "}
                {formatHours(item.required_buffer_minutes)} required · shortfall{" "}
                {formatHours(Math.abs(item.shortfall_minutes))}
              </p>
              <Link href={`/warnings/${item.id}`} className="mt-3 inline-block text-sm underline underline-offset-4">
                Open explanation
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
