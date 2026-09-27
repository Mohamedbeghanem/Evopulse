import Link from "next/link";
import { PulseAvatar } from "@/components/pulse-avatar/PulseAvatar";

export function LandingPage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">EvoPulse</p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] text-paper sm:text-6xl">
            Your business is running.
            <span className="block text-need">EvoPulse makes sure nothing falls through.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-sand">
            Pulse understands what should happen, watches what actually happens, and helps you act when reality
            changes — without giving up control.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-md bg-need px-5 py-3 text-sm font-medium text-ink-950">
              Start with EvoPulse
            </Link>
            <Link href="/how-it-works" className="rounded-md border border-hairline px-5 py-3 text-sm text-paper">
              See how it works
            </Link>
          </div>
        </div>
        <ProductVisual />
      </section>

      <Section kicker="The problem" title="Things slip between tools.">
        <p className="max-w-2xl text-sand">
          A late supplier, a missed follow-up, a payment that did not arrive. Each lives in a different place. By the
          time someone notices, the week has already moved.
        </p>
      </Section>

      <Section kicker="How EvoPulse works" title="Expected versus actual. Then the next safe step.">
        <ol className="grid gap-4 md:grid-cols-5">
          {[
            ["Understand", "What should happen."],
            ["Watch", "What actually happens."],
            ["Notice", "When something changes."],
            ["Connect", "What the change affects."],
            ["Help fix it", "With evidence, policy, and you in control."],
          ].map(([title, body], index) => (
            <li key={title} className="rounded-md border border-hairline bg-ink-800 p-4">
              <p className="font-mono text-[11px] text-mute">0{index + 1}</p>
              <p className="mt-2 text-paper">{title}</p>
              <p className="mt-2 text-sm text-sand">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section kicker="Business connections" title="Connect the work you already have.">
        <p className="max-w-2xl text-sand">
          CRM, accounting, email, commerce, payments, and files — when a connector is actually supported. Until then,
          Pulse starts from your business profile. We do not pretend a pipe is live.
        </p>
      </Section>

      <Section kicker="Pulse" title="One place for what needs you.">
        <div className="grid gap-6 lg:grid-cols-2">
          <VisualFrame title="Pulse">
            <p className="text-2xl text-paper">2 things need you</p>
            <p className="mt-2 text-sm text-sand">3 monitored · 1 handled</p>
            <div className="mt-4 space-y-2">
              <div className="rounded-md border border-need/40 bg-need/5 px-3 py-2 text-sm">Supplier delay · review</div>
              <div className="rounded-md border border-hairline px-3 py-2 text-sm text-sand">Cash timing · watching</div>
            </div>
          </VisualFrame>
          <div>
            <p className="text-sand">
              Pulse is not a dashboard of charts. It is the attention layer: what needs you, what is being watched,
              and what was already handled.
            </p>
          </div>
        </div>
      </Section>

      <Section kicker="Your agent" title="Meet Pulse.">
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <PulseAvatar size="hero" state="IDLE" />
          <div className="max-w-xl">
            <p className="text-sand">
              Pulse is the living representation of your EvoPulse agent. It sits next to Command. It never hides
              reasoning as magic. Every consequential recommendation still shows why, evidence, policy, and impact.
            </p>
            <p className="mt-4 text-sm text-mute">
              “I’ll handle what I’m allowed to handle. I’ll ask you when a decision needs your authority.”
            </p>
          </div>
        </div>
      </Section>

      <Section kicker="Governed actions" title="You stay in control.">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Approvals", "External messages and money still need you."],
            ["Simulation", "See impact before anything is real."],
            ["Verification", "Done is not claimed until reality confirms it."],
          ].map(([title, body]) => (
            <article key={title} className="rounded-md border border-hairline bg-ink-800 p-4">
              <p className="text-paper">{title}</p>
              <p className="mt-2 text-sm text-sand">{body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section kicker="Security / control" title="Policy is not optional.">
        <p className="max-w-2xl text-sand">
          Pulse cannot approve itself, disable verification, or rewrite policy. Workspaces are isolated. Your
          business is not mixed with the Atlas demo.
        </p>
        <Link href="/security" className="mt-4 inline-block text-sm text-need">
          How control works
        </Link>
      </Section>

      <section className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="font-serif text-4xl text-paper">Ready when you are.</h2>
          <p className="mt-3 max-w-xl text-sand">Create a workspace. Meet Pulse. Connect your business when you can.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-md bg-need px-5 py-3 text-sm font-medium text-ink-950">
              Start with EvoPulse
            </Link>
            <Link href="/demo" className="rounded-md border border-hairline px-5 py-3 text-sm">
              Explore demo workspace
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{kicker}</p>
        <h2 className="mt-3 font-serif text-3xl text-paper sm:text-4xl">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function ProductVisual() {
  return (
    <div className="rounded-md border border-hairline bg-ink-900 p-4">
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <PulseAvatar size={32} state="MONITORING" />
          <p className="text-sm">Pulse</p>
        </div>
        <p className="font-mono text-[10px] uppercase text-ok">Live</p>
      </div>
      <p className="mt-4 text-2xl text-paper">Your business is running.</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat n="1" label="Needs you" />
        <Stat n="3" label="Monitoring" />
        <Stat n="2" label="Handled" />
      </div>
      <div className="mt-4 rounded-md border border-hairline px-3 py-3 text-sm text-sand">
        Ask Pulse anything about your business…
      </div>
    </div>
  );
}

function VisualFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-hairline bg-ink-900 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-md border border-hairline px-2 py-2">
      <p className="text-xl text-paper">{n}</p>
      <p className="font-mono text-[10px] uppercase text-mute">{label}</p>
    </div>
  );
}
