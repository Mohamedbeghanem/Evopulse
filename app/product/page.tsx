import Link from "next/link";

export default function ProductPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Product</p>
      <h1 className="mt-3 font-serif text-5xl text-paper">A control system for the business you already run.</h1>
      <p className="mt-5 text-sand">
        EvoPulse is not a CRM, an ERP, a dashboard, or a chatbot. It keeps a live model of what your business expects,
        detects when reality diverges, and coordinates the next safe action.
      </p>
      <ul className="mt-8 space-y-3 text-sand">
        <li>Pulse — what needs you, what is watched, what was handled.</li>
        <li>Command — ask about your business in ordinary language.</li>
        <li>Situations — evidence, policy, impact, and approval in one place.</li>
      </ul>
      <Link href="/signup" className="mt-8 inline-flex rounded-md bg-need px-5 py-3 text-sm font-medium text-ink-950">
        Start with EvoPulse
      </Link>
    </div>
  );
}
