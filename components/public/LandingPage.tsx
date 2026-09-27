import Link from "next/link";
import { PulseAvatar } from "@/components/pulse-avatar/PulseAvatar";

/**
 * Public product landing (/welcome). Home `/` stays the Control OS entry (Create a company / Open demo company).
 * No testimonials, customer logos, or invented metrics. The Atlas numbers are the canonical demo graph facts;
 * tests/landing.test.ts recomputes them from the engines so this copy cannot drift.
 */

export const LANDING_CTAS = [
  { href: "/", label: "Try the live demo", primary: true },
  { href: "/?create=1", label: "Create a company", primary: false },
  { href: "/signup", label: "Sign up", primary: false },
] as const;

export const ATLAS_COPY = {
  associated: "850,000 DZD associated revenue",
  cash: "540,000 DZD expected cash timing",
  simulation: "+3 days moves 160,000 DZD (Invoice C)",
} as const;

export type ConnectorState = "Live" | "Coming" | "Configure";

/** Honest status for this build. Only move an item to Live when a working adapter ships. */
export const LANDING_CONNECTORS: { name: string; state: ConnectorState; body: string }[] = [
  { name: "Business profile & notes", state: "Live", body: "Tell Pulse your customers, suppliers and promises. Governed notes, not a spreadsheet." },
  { name: "Email", state: "Configure", body: "Paste a customer or supplier message today; commitments are extracted with evidence. Inbox sync is coming." },
  { name: "CSV / Excel", state: "Coming", body: "Import orders, shipments and invoices from the exports you already have." },
  { name: "WhatsApp", state: "Coming", body: "Where distributors actually make promises. Messages will arrive as data, never as instructions." },
  { name: "MCP plugins", state: "Coming", body: "Let other tools read Pulse and propose actions — still under the same policy and approvals." },
];

const STEPS = [
  ["Detect", "Expected versus actual on orders, shipments, invoices and promises — early warning before a deadline is missed."],
  ["Explain", "Walk the business graph and put it in money: associated revenue and cash timing. Never a fake loss number."],
  ["Simulate", "Ask what if it slips again. Consequences are recalculated in a sandbox; reality is never touched."],
  ["Act with approval", "Safe steps run automatically. Anything external or financial waits for a human. Policy is rechecked right before execution."],
  ["Verify", "Executed is not handled. A situation is HANDLED only when reality confirms it — for example, the same customer replies."],
] as const;

const PILLARS = [
  ["Detect risk early", "A late shipment is flagged while there is still time to act, not after the customer calls."],
  ["Explain it in money", "Every situation says what is at stake in DZD and why — with the evidence it came from."],
  ["Act under policy", "Discount ceilings, approval rules and limits are enforced by software. AI cannot approve itself."],
  ["Verify before HANDLED", "Nothing is marked done until the outcome is confirmed. No false comfort."],
] as const;

const STATE_TONE: Record<ConnectorState, string> = {
  Live: "border-ok/60 text-ok",
  Configure: "border-watch/60 text-watch",
  Coming: "border-hairline text-mute",
};

export function LandingPage() {
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-mute">
            Governed business control for distributors
          </p>
          <h1 className="mt-4 font-serif text-[40px] leading-[1.05] text-paper sm:text-6xl">
            Catch the slip
            <span className="block text-need">before it costs you.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-sand">
            EvoPulse watches your orders, shipments, invoices and promises. It detects risk early, explains it in
            money, acts only inside your policy — and never calls anything handled until reality confirms it.
          </p>
          <Ctas className="mt-8" />
        </div>
        <AtlasCard />
      </section>

      <Section id="value" kicker="Why EvoPulse" title="Control, not another dashboard.">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(([title, body]) => (
            <li key={title} className="rounded-md border border-hairline bg-ink-800 p-5">
              <p className="text-paper">{title}</p>
              <p className="mt-2 text-sm text-sand">{body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how" kicker="How it works" title="Detect. Explain. Simulate. Act with approval. Verify.">
        <ol className="grid gap-4 md:grid-cols-5">
          {STEPS.map(([title, body], index) => (
            <li key={title} className="rounded-md border border-hairline bg-ink-800 p-4" data-testid="landing-step">
              <p className="font-mono text-[11px] text-mute">0{index + 1}</p>
              <p className="mt-2 text-paper">{title}</p>
              <p className="mt-2 text-sm text-sand">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="atlas" kicker="A real example from the live demo" title="Atlas Supply is two days late.">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4 text-sand">
            <p>
              <span className="text-paper">“Your shipment will arrive Wednesday instead of Monday.”</span> One supplier
              message. EvoPulse records it, moves shipment SH-204 by two days and walks the graph: SH-204 → racking kit
              RK-7 → 3 customer orders → 3 customers.
            </p>
            <p>
              That is <strong className="font-medium text-paper">{ATLAS_COPY.associated}</strong> and{" "}
              <strong className="font-medium text-paper">{ATLAS_COPY.cash}</strong>. Associated, not lost — graph facts,
              not a scare number.
            </p>
            <p>
              What if it slips again? In simulation, <strong className="font-medium text-paper">{ATLAS_COPY.simulation}</strong>{" "}
              into next period. Exit the simulation and nothing in the real business has changed.
            </p>
            <p>
              The customer then asks for 10%. Policy says <span className="font-mono text-paper">discount_max = 5%</span>,
              so the 10% is <span className="text-need">BLOCKED</span> — there is no approve button for it. The 5% and
              Net-14 alternatives wait for your approval.
            </p>
            <p>
              You approve the follow-up. It is executed, then watched. It becomes HANDLED only when that same customer
              replies.
            </p>
          </div>
          <dl className="grid content-start gap-3 sm:grid-cols-2">
            <Metric label="Associated revenue" value="850,000 DZD" caption="3 orders · 3 customers · not a loss" />
            <Metric label="Expected cash timing" value="540,000 DZD" caption="Invoices due this period" />
            <Metric label="Simulation · +3 days" value="160,000 DZD" caption="Invoice C moves to next period — reality unchanged" />
            <Metric label="10% discount" value="BLOCKED" caption="discount_max 5% · AI cannot approve itself" tone="text-need" />
          </dl>
        </div>
      </Section>

      <Section id="connectors" kicker="Connectors & plugins" title="Start from what you have. We never pretend a pipe is live.">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LANDING_CONNECTORS.map((connector) => (
            <li key={connector.name} className="rounded-md border border-hairline bg-ink-800 p-4" data-testid="landing-connector">
              <div className="flex items-start justify-between gap-2">
                <p className="text-paper">{connector.name}</p>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STATE_TONE[connector.state]}`}
                >
                  {connector.state}
                </span>
              </div>
              <p className="mt-2 text-sm text-sand">{connector.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-mute">
          Every inbound message is treated as data. Text like “ignore policy” is recorded as evidence, never obeyed.
        </p>
      </Section>

      <Section id="mobile" kicker="On your phone" title="What needs me — in your pocket.">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-2xl space-y-3 text-sand">
            <p>
              Open <span className="font-mono text-paper">/m</span> on your phone and add it to your home screen. See what
              needs you, read the why in money terms, approve or reject with one tap, and ask a question — through the
              same engines and the same human approval routes as the desktop.
            </p>
            <p className="text-sm text-mute">Blocked actions show no approve control on mobile either.</p>
          </div>
          <Link href="/m" className="inline-flex rounded-md border border-hairline px-5 py-3 text-sm text-paper hover:border-sand">
            Open the mobile view
          </Link>
        </div>
      </Section>

      <Section id="control" kicker="Control" title="Policy is not optional.">
        <ul className="grid gap-4 md:grid-cols-3">
          {[
            ["Humans approve", "External messages and money wait for a person. AI cannot approve itself."],
            ["Policy rechecked", "Rules are evaluated again immediately before anything executes."],
            ["Workspaces isolated", "Your company never mixes with the Atlas demo or anyone else."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-md border border-hairline bg-ink-800 p-4">
              <p className="text-paper">{title}</p>
              <p className="mt-2 text-sm text-sand">{body}</p>
            </li>
          ))}
        </ul>
        <Link href="/security" className="mt-4 inline-block text-sm text-need">
          How control works
        </Link>
      </Section>

      <section className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-16 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <PulseAvatar size={40} state="MONITORING" />
            <div>
              <h2 className="font-serif text-4xl text-paper">See it on the Atlas demo.</h2>
              <p className="mt-3 max-w-xl text-sand">No setup, no key. Then create your own company when you are ready.</p>
            </div>
          </div>
          <Ctas />
        </div>
      </section>
    </div>
  );
}

function Ctas({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      {LANDING_CTAS.map((cta) => (
        <Link
          key={cta.href}
          href={cta.href}
          className={
            cta.primary
              ? "rounded-md bg-need px-5 py-3 text-sm font-medium text-ink-950"
              : "rounded-md border border-hairline px-5 py-3 text-sm text-paper hover:border-sand"
          }
        >
          {cta.label}
        </Link>
      ))}
    </div>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-4 border-t border-hairline">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{kicker}</p>
        <h2 className="mt-3 font-serif text-3xl text-paper sm:text-4xl">{title}</h2>
        <div className="mt-6">{children}</div>
      </div>
    </section>
  );
}

function Metric({ label, value, caption, tone = "text-paper" }: { label: string; value: string; caption: string; tone?: string }) {
  return (
    <div className="rounded-md border border-hairline bg-ink-900 p-4">
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{label}</dt>
      <dd className={`mt-2 text-2xl ${tone}`}>{value}</dd>
      <dd className="mt-1 text-xs text-sand">{caption}</dd>
    </div>
  );
}

function AtlasCard() {
  return (
    <div className="rounded-md border border-hairline bg-ink-900 p-5" aria-label="Atlas demo situation">
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <PulseAvatar size={28} state="MONITORING" />
          <p className="text-sm">Pulse · Atlas demo</p>
        </div>
        <span className="rounded-full border border-need/60 px-2 py-0.5 font-mono text-[10px] uppercase text-need">Needs you</span>
      </div>
      <p className="mt-4 text-xl text-paper">Supplier cascade — SH-204 two days late</p>
      <ul className="mt-3 space-y-1 text-sm text-sand">
        <li>{ATLAS_COPY.associated} — not a loss.</li>
        <li>{ATLAS_COPY.cash}.</li>
        <li>Simulation: {ATLAS_COPY.simulation}.</li>
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md border border-need/40 px-3 py-2">
          <p className="text-paper">10% discount</p>
          <p className="font-mono text-[10px] uppercase text-need">Blocked · no approve</p>
        </div>
        <div className="rounded-md border border-watch/40 px-3 py-2">
          <p className="text-paper">5% alternative</p>
          <p className="font-mono text-[10px] uppercase text-watch">Needs your approval</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-mute">Executed is not handled. HANDLED only after verification.</p>
    </div>
  );
}
