"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PulseAvatar } from "@/components/pulse-avatar/PulseAvatar";
import { Button, Input } from "@/components/ui/primitives";
import { PULSE_INTRO } from "@/lib/pulse-avatar/states";
import { PROTECTION_OPTIONS } from "@/lib/onboarding/types";
import type { ConnectorView } from "@/lib/integrations/service";
import type { ConnectorView as RegistryConnectorView } from "@/lib/connectors/types";
import { ImportPanel } from "@/components/connectors/ImportPanel";
import type { DiscoveryFact } from "@/lib/discovery/service";

async function post(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string; next?: string };
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

export function WelcomeStep() {
  const router = useRouter();
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Welcome</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">Welcome to EvoPulse.</h1>
      <p className="mt-4 max-w-xl text-sand">
        Your business is already running. In a few minutes Pulse will know what to watch, and you will have a first
        Pulse — not an empty dashboard.
      </p>
      <Button className="mt-8" onClick={() => router.push("/onboarding/business")}>
        What’s your business?
      </Button>
    </div>
  );
}

export function BusinessStep(props: { name: string; industry: string; teamSize: string; country: string; currency: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(form: FormData) {
    setBusy(true);
    try {
      const data = await post("/api/onboarding", {
        step: "business",
        name: form.get("name"),
        industry: form.get("industry"),
        teamSize: form.get("teamSize"),
        country: form.get("country"),
        currency: form.get("currency"),
      });
      router.push(data.next || "/onboarding/protect");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={(form) => void onSubmit(form)} className="space-y-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Business</p>
      <h1 className="font-serif text-4xl text-paper">What’s your business?</h1>
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Business name</span>
        <Input name="name" defaultValue={props.name} required />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm text-sand">Industry</span>
        <Input name="industry" defaultValue={props.industry} placeholder="Retail, services, manufacturing…" />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-sm text-sand">Team size</span>
          <Input name="teamSize" defaultValue={props.teamSize} placeholder="12" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-sand">Country</span>
          <Input name="country" defaultValue={props.country} placeholder="Algeria" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-sand">Currency</span>
          <Input name="currency" defaultValue={props.currency || "DZD"} />
        </label>
      </div>
      {error ? <p className="text-sm text-miss">{error}</p> : null}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Continue"}
      </Button>
    </form>
  );
}

export function ProtectStep({ selected }: { selected: string[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>(selected);
  const [error, setError] = useState<string | null>(null);

  async function continueNext() {
    try {
      const data = await post("/api/onboarding", { step: "protect", protections: picked });
      router.push(data.next || "/onboarding/meet");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pick at least one.");
    }
  }

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Protect</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">What should Pulse protect?</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {PROTECTION_OPTIONS.map((option) => {
          const on = picked.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() =>
                setPicked((current) => (current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id]))
              }
              className={`rounded-md border px-4 py-2 text-sm ${on ? "border-need bg-need/10 text-paper" : "border-hairline text-sand"}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-4 text-sm text-miss">{error}</p> : null}
      <Button className="mt-8" onClick={() => void continueNext()}>
        Meet Pulse
      </Button>
    </div>
  );
}

export function MeetStep() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <PulseAvatar size="hero" state="IDLE" />
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Pulse</p>
        <h1 className="mt-3 font-serif text-4xl text-paper">I’m Pulse.</h1>
        <p className="mt-4 max-w-xl text-sand">{PULSE_INTRO}</p>
        <Button className="mt-8" onClick={() => router.push("/onboarding/connect")}>
          Connect your business
        </Button>
      </div>
    </div>
  );
}

export function ConnectStep({ connectors, registry = [] }: { connectors: ConnectorView[]; registry?: RegistryConnectorView[] }) {
  const router = useRouter();
  const [items, setItems] = useState(connectors);
  const [busy, setBusy] = useState<string | null>(null);
  const [imported, setImported] = useState(0);

  async function connect(id: string) {
    setBusy(id);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectorId: id }),
    });
    const data = (await res.json()) as { connectors?: ConnectorView[]; error?: string };
    setBusy(null);
    if (data.connectors) setItems(data.connectors);
  }

  function next() {
    void post("/api/onboarding", { step: "connect" }).then((data) => {
      router.push(data.next || "/onboarding/discovery");
      router.refresh();
    });
  }

  const others = registry.filter((item) => item.connectorId !== "csv-import");
  const manual = items.filter((item) => item.status !== "COMING_SOON");
  const soon = items.filter((item) => item.status === "COMING_SOON");

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Connect</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">Connect your data.</h1>
      <p className="mt-3 text-sand">
        Start with a spreadsheet. Import customers, orders and invoices; Pulse watches their deadlines with the same engines as everything else.
        Nothing here is faked, and you can skip.
      </p>

      <section className="mt-6 rounded-lg border border-hairline p-4" aria-labelledby="import-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="import-heading" className="text-paper">
            CSV / Excel import
          </h2>
          <span className={`font-mono text-[10px] uppercase ${imported ? "text-ok" : "text-mute"}`}>
            {imported ? `${imported} rows imported` : "Ready"}
          </span>
        </div>
        <div className="mt-3">
          <ImportPanel onImported={(result) => setImported((n) => n + result.imported)} />
        </div>
      </section>

      <ul className="mt-6 space-y-2">
        {others.map((item) => (
          <li key={item.installId} className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-3" data-connector={item.connectorId}>
            <div>
              <p className="text-paper">{item.label}</p>
              <p className="text-sm text-sand">{item.summary}</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`font-mono text-[10px] uppercase ${item.state === "connected" ? "text-ok" : item.state === "error" ? "text-miss" : "text-mute"}`}>
                {item.state === "not_configured" ? "Not configured" : item.state === "disabled" ? "Ready" : item.state}
              </span>
              <a href="/connectors" target="_blank" rel="noreferrer" className="text-sm text-need hover:text-paper">
                Configure
              </a>
            </div>
          </li>
        ))}
        {manual.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-hairline px-3 py-3">
            <div>
              <p className="text-paper">{item.name}</p>
              <p className="text-sm text-sand">
                {item.category} · {item.summary}
              </p>
            </div>
            {item.connected ? (
              <span className="font-mono text-[10px] uppercase text-ok">Connected</span>
            ) : (
              <Button variant="ghost" disabled={busy === item.id} onClick={() => void connect(item.id)}>
                Connect
              </Button>
            )}
          </li>
        ))}
      </ul>
      {soon.length ? (
        <p className="mt-4 text-xs text-mute">Coming soon, not faked: {soon.map((item) => item.name).join(", ")}.</p>
      ) : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={next}>{imported ? "Discover what Pulse can see" : "Continue"}</Button>
        <Button variant="quiet" onClick={next}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

export function DiscoveryStep() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const data = await post("/api/onboarding", { step: "discovery" });
    router.push(data.next || "/onboarding/review");
    router.refresh();
  }

  return (
    <div>
      <PulseAvatar size={96} state={busy ? "INVESTIGATING" : "THINKING"} />
      <h1 className="mt-6 font-serif text-4xl text-paper">I’m learning how your business works.</h1>
      <p className="mt-3 text-sand">
        Pulse looks for customers, suppliers, orders, invoices, commitments, and goals. If a number is missing, that
        is honest — not a guess dressed as certainty.
      </p>
      <Button className="mt-8" disabled={busy} onClick={() => void run()}>
        {busy ? "Discovering…" : "Show me what you found"}
      </Button>
    </div>
  );
}

export function ReviewStep({ facts }: { facts: DiscoveryFact[] }) {
  const router = useRouter();

  async function save(form: FormData) {
    const corrections = facts.map((fact) => ({
      kind: fact.kind,
      count: Number(form.get(fact.kind) || fact.count),
    }));
    const data = await post("/api/onboarding", { step: "review", corrections });
    router.push(data.next || "/onboarding/goal");
    router.refresh();
  }

  return (
    <form action={(form) => void save(form)}>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Review</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">This is what Pulse believes.</h1>
      <p className="mt-3 text-sand">Correct anything that is wrong. Corrections become governed input — not silent edits.</p>
      <ul className="mt-6 space-y-3">
        {facts.map((fact) => (
          <li key={fact.kind} className="grid grid-cols-[1fr_6rem] items-center gap-3">
            <div>
              <p className="text-paper">{fact.label}</p>
              <p className="text-xs text-mute">
                {fact.confidence} · {fact.notes}
              </p>
            </div>
            <Input name={fact.kind} type="number" min={0} defaultValue={fact.count} />
          </li>
        ))}
      </ul>
      <Button type="submit" className="mt-8">
        Looks right
      </Button>
    </form>
  );
}

export function GoalStep({ protections }: { protections: string[] }) {
  const router = useRouter();
  const first = protections[0] || "operations";

  async function choose(protection: string) {
    const data = await post("/api/onboarding", { step: "goal", protection });
    router.push(data.next || "/onboarding/first-pulse");
    router.refresh();
  }

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">First goal</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">Set the first thing Pulse protects.</h1>
      <div className="mt-6 flex flex-wrap gap-2">
        {(protections.length ? protections : ["operations"]).map((id) => (
          <Button key={id} variant={id === first ? "attention" : "ghost"} onClick={() => void choose(id)}>
            {id}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function FirstPulseStep({
  empty,
  needsYou,
  monitoring,
  opportunity,
}: {
  empty: boolean;
  needsYou: number;
  monitoring: number;
  opportunity: number;
}) {
  const router = useRouter();

  async function enter() {
    await post("/api/onboarding", { step: "finish" });
    router.push("/pulse");
    router.refresh();
  }

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">First Pulse</p>
      <h1 className="mt-3 font-serif text-4xl text-paper">Your business is connected.</h1>
      {empty ? (
        <p className="mt-4 text-sand">Connect your business to create your first Pulse. Pulse is already watching the goal you set.</p>
      ) : (
        <p className="mt-4 text-sand">
          Pulse found {needsYou} things that need attention, {monitoring} things being monitored, and {opportunity}{" "}
          opportunity to automate.
        </p>
      )}
      <div className="mt-6 grid max-w-md grid-cols-3 gap-3">
        <Census label="Needs you" value={needsYou} />
        <Census label="Monitoring" value={monitoring} />
        <Census label="Automate" value={opportunity} />
      </div>
      <Button className="mt-8" onClick={() => void enter()}>
        Enter Pulse
      </Button>
    </div>
  );
}

function Census({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-hairline px-3 py-3">
      <p className="font-mono text-[10px] uppercase text-mute">{label}</p>
      <p className="mt-1 text-2xl">{value}</p>
    </div>
  );
}
