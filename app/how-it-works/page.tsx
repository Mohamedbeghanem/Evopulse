import Link from "next/link";

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">How it works</p>
      <h1 className="mt-3 font-serif text-5xl text-paper">Five things. Then it repeats.</h1>
      <ol className="mt-8 space-y-6">
        {[
          ["Understand", "Pulse learns what your business expects: orders, invoices, commitments, goals."],
          ["Watch", "Reality arrives as events. Pulse compares them to what should have happened."],
          ["Notice", "When something changes, Pulse opens one situation — not five alerts."],
          ["Act", "Safe work can proceed. Anything that leaves the building waits for you."],
          ["Verify", "A result is not finished until Pulse checks that it actually happened."],
        ].map(([title, body], index) => (
          <li key={title}>
            <p className="font-mono text-[11px] text-mute">0{index + 1}</p>
            <p className="mt-1 text-xl text-paper">{title}</p>
            <p className="mt-2 text-sand">{body}</p>
          </li>
        ))}
      </ol>
      <Link href="/signup" className="mt-10 inline-flex rounded-md bg-need px-5 py-3 text-sm font-medium text-ink-950">
        Start with EvoPulse
      </Link>
    </div>
  );
}
