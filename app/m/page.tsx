import Link from "next/link";
import { StateChip } from "@/components/mobile/StateChip";
import { withPageContext } from "@/lib/auth/page";
import { mobileHome, type MobileCard } from "@/lib/mobile/view";

export const dynamic = "force-dynamic";

function SituationCard({ card }: { card: MobileCard }) {
  return (
    <Link
      href={card.href}
      data-testid="m-card"
      data-state={card.classification}
      className="block rounded-xl border border-hairline bg-ink-800 p-4 active:bg-ink-700"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-medium text-paper">{card.title}</p>
        <StateChip value={card.classification} />
      </div>
      {card.why.length ? (
        <ul className="mt-2 space-y-0.5 text-sm text-sand">
          {card.why.slice(0, 2).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-sand">{card.summary}</p>
      )}
      <p className="mt-3 text-sm text-paper/90">{card.needsFromYou}</p>
    </Link>
  );
}

export default async function MobileHomePage() {
  const home = await withPageContext((ctx) => mobileHome(ctx.db));
  const { counts } = home;
  return (
    <div className="space-y-8">
      <header className="pt-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">EvoPulse</p>
        <h1 className="mt-1 font-serif text-[32px] leading-tight">What needs me?</h1>
        <p className="mt-2 text-sm text-sand" data-testid="m-headline">
          {home.headline}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center" data-testid="m-counts">
          <div className="rounded-lg border border-hairline py-2">
            <dt className="text-[11px] uppercase tracking-wide text-mute">Needs me</dt>
            <dd className="text-xl text-need" data-testid="m-count-needs">
              {counts.needsMe}
            </dd>
          </div>
          <div className="rounded-lg border border-hairline py-2">
            <dt className="text-[11px] uppercase tracking-wide text-mute">Watching</dt>
            <dd className="text-xl text-ice" data-testid="m-count-watching">
              {counts.watching}
            </dd>
          </div>
          <div className="rounded-lg border border-hairline py-2">
            <dt className="text-[11px] uppercase tracking-wide text-mute">Handled</dt>
            <dd className="text-xl text-ok" data-testid="m-count-handled">
              {counts.handled}
            </dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="m-needs" className="space-y-3">
        <h2 id="m-needs" className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
          Needs you · {counts.needsMe}
        </h2>
        {home.needsMe.length ? (
          home.needsMe.map((card) => <SituationCard key={card.id} card={card} />)
        ) : (
          <p className="rounded-xl border border-hairline p-4 text-sand">Nothing needs you right now.</p>
        )}
      </section>

      {home.watching.length ? (
        <section aria-labelledby="m-watching" className="space-y-3">
          <h2 id="m-watching" className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
            Watching · executed is not handled
          </h2>
          {home.watching.map((card) => (
            <SituationCard key={card.id} card={card} />
          ))}
        </section>
      ) : null}

      <section id="done" aria-labelledby="m-done" className="space-y-3 scroll-mt-4">
        <h2 id="m-done" className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
          Recent verification & handled
        </h2>
        {home.handled.map((card) => (
          <SituationCard key={card.id} card={card} />
        ))}
        {home.verifications.length ? (
          <ul className="divide-y divide-hairline rounded-xl border border-hairline">
            {home.verifications.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 p-3" data-testid="m-verification">
                <div className="min-w-0">
                  <p className="truncate text-sm text-paper">{row.actionTitle}</p>
                  <p className="text-xs text-mute">
                    {row.status === "SUCCESS"
                      ? "Verified — situation HANDLED."
                      : row.status === "PENDING"
                        ? "Executed — waiting for verification. Not handled yet."
                        : `Verification ${row.status.toLowerCase()}.`}
                  </p>
                </div>
                <StateChip value={row.status} />
              </li>
            ))}
          </ul>
        ) : home.handled.length ? null : (
          <p className="rounded-xl border border-hairline p-4 text-sm text-sand">
            Nothing verified yet. HANDLED only appears after verification succeeds.
          </p>
        )}
      </section>
    </div>
  );
}
