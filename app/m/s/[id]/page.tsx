import Link from "next/link";
import { notFound } from "next/navigation";
import { MobileApprove, MobileReject } from "@/components/mobile/MobileDecision";
import { StateChip } from "@/components/mobile/StateChip";
import { withPageContext } from "@/lib/auth/page";
import { mobileSituation } from "@/lib/mobile/view";

export const dynamic = "force-dynamic";

export default async function MobileSituationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const situation = await withPageContext((ctx) => mobileSituation(ctx.db, decodeURIComponent(id)));
  if (!situation) notFound();
  const { item, actions } = situation;
  const approvable = actions.filter((action) => action.canApprove);
  const blocked = actions.filter((action) => action.blocked);
  // Engine layers, minus raw state/reason codes (e.g. "NEEDS_YOU · HIGH_IMPACT_HUMAN_JUDGMENT").
  const readableLayers = situation.layers
    .map((layer) => layer.label)
    .filter((label) => !/^[A-Z_\s·]+$/.test(label));
  const offerProtect =
    item.classification === "NEEDS_YOU" && !approvable.length && !blocked.length && !situation.executedNotHandled;

  return (
    <article className="space-y-7">
      <header className="pt-2">
        <Link href="/m" className="text-sm text-sand">
          ← What needs me
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StateChip value={item.classification} />
          {situation.executedNotHandled ? <StateChip value="PENDING" /> : null}
        </div>
        <h1 className="mt-2 font-serif text-[28px] leading-tight">{item.title}</h1>
        <p className="mt-2 text-sm text-sand">{item.summary}</p>
      </header>

      <section aria-labelledby="m-why" className="rounded-xl border border-hairline bg-ink-800 p-4">
        <h2 id="m-why" className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
          Why
        </h2>
        <ul className="mt-2 space-y-1 text-paper" data-testid="m-why">
          {item.why.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        {situation.evidenceQuote ? (
          <blockquote className="mt-3 border-l-2 border-hairline pl-3 text-sm text-sand">
            “{situation.evidenceQuote}”
            {situation.evidenceSource ? <span className="block text-xs text-mute">— {situation.evidenceSource}</span> : null}
          </blockquote>
        ) : null}
        {readableLayers.length ? <p className="mt-3 text-xs text-mute">{readableLayers.join(" · ")}</p> : null}
      </section>

      <section aria-labelledby="m-needs-from-you" className="space-y-3">
        <h2 id="m-needs-from-you" className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
          What it needs from you
        </h2>
        <p className="text-paper">{item.needsFromYou}</p>

        {blocked.map((action) => (
          <div
            key={action.id}
            data-testid="m-blocked"
            className="rounded-xl border border-need/50 p-4"
            aria-label={`${action.title} is blocked by policy`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-paper">{action.title}</p>
              <StateChip value="BLOCKED" />
            </div>
            <p className="mt-2 text-sm text-sand">{action.policyReason}</p>
            <p className="mt-2 text-sm text-need" role="status">
              BLOCKED by discount_max {situation.discountMax}%. There is no approve control. AI cannot approve itself.
            </p>
          </div>
        ))}

        {approvable.map((action) => (
          <div key={action.id} data-testid="m-approval" className="rounded-xl border border-watch/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-paper">{action.title}</p>
              <StateChip value="APPROVAL_REQUIRED" />
            </div>
            <p className="mt-2 text-sm text-sand">{action.description}</p>
            <p className="mt-1 text-xs text-mute">{action.policyReason} Policy is rechecked before execution.</p>
            {action.planId ? <MobileApprove planId={action.planId} actionId={action.id} title={action.title} /> : null}
          </div>
        ))}

        {situation.canReject && item.decisionId ? <MobileReject decisionId={item.decisionId} /> : null}

        {offerProtect ? (
          <Link
            href={`/m/ask?q=${encodeURIComponent("Protect everything at risk this week.")}`}
            className="flex min-h-[48px] items-center justify-center rounded-lg border border-hairline text-paper"
          >
            Protect this week
          </Link>
        ) : null}
      </section>

      {actions.some((action) => action.status === "executed") || situation.verifications.length ? (
        <section aria-labelledby="m-verify" className="space-y-2">
          <h2 id="m-verify" className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
            Verification
          </h2>
          {situation.handled ? (
            <p className="text-ok">Verified. HANDLED.</p>
          ) : (
            <p className="text-sand" data-testid="m-not-handled">
              Executed is not handled. HANDLED only after verification succeeds.
            </p>
          )}
          <ul className="space-y-1">
            {situation.verifications.map((row) => (
              <li key={row.id} className="flex items-center justify-between text-sm">
                <span className="text-sand">{actions.find((a) => a.id === row.actionId)?.title || row.actionId}</span>
                <StateChip value={row.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="m-plan" className="space-y-2">
        <h2 id="m-plan" className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">
          Full plan
        </h2>
        <ul className="divide-y divide-hairline rounded-xl border border-hairline">
          {actions.map((action) => (
            <li key={action.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="min-w-0 truncate text-paper">{action.title}</span>
              <StateChip value={action.status === "executed" ? "EXECUTED" : action.policyOutcome} />
            </li>
          ))}
          {!actions.length ? <li className="p-3 text-sm text-sand">No plan yet.</li> : null}
        </ul>
      </section>
    </article>
  );
}
