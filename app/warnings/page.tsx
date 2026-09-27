import Link from "next/link";
import { PageTitle, Pill, rowCard, Screen, SectionTitle } from "@/components/pulse/attend";
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
    <Screen>
      <div className="max-w-[920px] px-4 py-6 lg:px-8">
        <PageTitle title="Warnings">
          <p>
            Failure has not occurred yet. These are timing risks under current assumptions — not missed
            exceptions.
          </p>
        </PageTitle>
        <p className="mt-3">
          <Link href="/" className="text-sm text-[#0F4C5C] underline underline-offset-4">
            Pulse
          </Link>
        </p>

        <div className="mt-8 space-y-8">
          <Section title="Active" items={active} />
          <Section title="Monitoring" items={monitoring} />
          <Section title="Resolved" items={resolved} />
        </div>
      </div>
    </Screen>
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
    <section>
      <SectionTitle title={title} />
      {items.length === 0 ? (
        <p className="text-sm text-[#5C6B73]">None.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className={rowCard(false)}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap gap-2">
                  <Pill>{item.status}</Pill>
                  <Pill>{item.buffer_state}</Pill>
                  <Pill>{item.severity}</Pill>
                </div>
                <h3 className="mt-2 text-[15px] font-semibold text-[#0D1B24]">{item.title}</h3>
                <p className="mt-1 text-[13px] text-[#5C6B73]">
                  {formatHours(item.available_buffer_minutes)} available ·{" "}
                  {formatHours(item.required_buffer_minutes)} required · shortfall{" "}
                  {formatHours(Math.abs(item.shortfall_minutes))}
                </p>
                <Link href={`/warnings/${item.id}`} className="mt-3 inline-block text-sm text-[#0F4C5C] underline underline-offset-4">
                  Open explanation
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
