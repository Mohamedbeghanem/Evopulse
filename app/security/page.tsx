import Link from "next/link";

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Security / Control</p>
      <h1 className="mt-3 font-serif text-5xl text-paper">You keep authority. Pulse keeps watch.</h1>
      <div className="mt-8 space-y-5 text-sand">
        <p>Each workspace is isolated. Another account cannot read your events, situations, or command history.</p>
        <p>Policy is evaluated at execution time. Pulse cannot approve its own consequential actions.</p>
        <p>Verification decides whether something worked. The interface will not claim success first.</p>
        <p>Cosmetic preferences never change those rules. You can rename Pulse. You cannot turn off control.</p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="rounded-md bg-need px-5 py-3 text-sm font-medium text-ink-950">
          Start with EvoPulse
        </Link>
        <Link href="/demo" className="rounded-md border border-hairline px-5 py-3 text-sm">
          Explore demo workspace
        </Link>
      </div>
    </div>
  );
}
