"use client";

import { useMemo, useState } from "react";
import { presentSimulation, SIMULATION_BANNER } from "@/components/sim/copy";
import { StatusBadge } from "@/components/ui/badges";
import { SectionHeader } from "@/components/ui/chrome";
import { Button } from "@/components/ui/primitives";
import type { EntityChange, SimulationResult } from "@/lib/simulation/types";

type Shipment = {
  id: string;
  label: string;
  supplier: string | null;
  expectedAt: string;
  originalExpectedAt: string | null;
};

const DAY_OPTIONS = [1, 2, 3, 5, 7];

export function Simulator({
  shipments,
  source,
  initialFingerprint,
}: {
  shipments: Shipment[];
  source: string;
  initialFingerprint: string;
}) {
  const [targetId, setTargetId] = useState(shipments[0]?.id ?? "");
  const [days, setDays] = useState(3);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [why, setWhy] = useState<string | null>(null);
  const [exitCheck, setExitCheck] = useState<{ unchanged: boolean; fingerprint: string; expectedAt: string } | null>(
    null,
  );

  const target = shipments.find((shipment) => shipment.id === targetId);
  const view = useMemo(() => (result ? presentSimulation(result) : null), [result]);

  async function run() {
    setBusy(true);
    setError(null);
    setExitCheck(null);
    setWhy(null);
    try {
      const res = await fetch("/api/simulations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "supplier_delay", targetId, days }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Simulation did not run. The twin was not changed.");
      setResult(data as SimulationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation did not run. The twin was not changed.");
    } finally {
      setBusy(false);
    }
  }

  async function exit() {
    const fingerprintBefore = result?.isolation.fingerprintBefore ?? initialFingerprint;
    setResult(null);
    setWhy(null);
    try {
      const res = await fetch("/api/simulations");
      const data = (await res.json()) as { fingerprint: string; shipments: Shipment[] };
      const real = data.shipments.find((shipment) => shipment.id === targetId);
      setExitCheck({
        unchanged: data.fingerprint === fingerprintBefore,
        fingerprint: data.fingerprint,
        expectedAt: real?.expectedAt ?? "",
      });
    } catch {
      setExitCheck(null);
    }
  }

  if (!shipments.length) {
    return <p className="text-sand">No shipment with an expected arrival exists in the Business Graph.</p>;
  }

  return (
    <div className="space-y-8">
      <section className={`rounded-md border p-5 ${result ? "sim-banner" : "border-hairline bg-ink-800/50"}`}>
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-mute">Scenario</span>
            <select disabled className="mt-1 rounded-md border border-hairline bg-ink-900 px-3 py-2 text-paper">
              <option>Supplier delay</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-mute">Shipment</span>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              disabled={Boolean(result)}
              className="mt-1 rounded-md border border-hairline bg-ink-900 px-3 py-2 text-paper"
            >
              {shipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.supplier ? `${shipment.supplier} · ` : ""}
                  {shipment.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-mute">Additional delay</span>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              disabled={Boolean(result)}
              className="mt-1 rounded-md border border-hairline bg-ink-900 px-3 py-2 text-paper"
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  +{option} day{option === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          {result ? (
            <Button type="button" variant="ghost" onClick={exit}>
              EXIT SIMULATION
            </Button>
          ) : (
            <Button type="button" variant="attention" onClick={run} disabled={busy || !targetId}>
              {busy ? "Simulating…" : "RUN SIMULATION"}
            </Button>
          )}
        </div>
        {target ? (
          <p className="mt-4 text-sm text-sand">
            LIVE: {target.label} expected <span className="text-paper">{day(target.expectedAt)}</span>
            {target.originalExpectedAt && target.originalExpectedAt !== target.expectedAt
              ? ` (originally ${day(target.originalExpectedAt)})`
              : ""}
            <span className="ml-2 font-mono text-[11px] text-mute">source: {source}</span>
          </p>
        ) : null}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-mute" aria-live="polite">
          {busy
            ? "Simulating recovery. Twin not written."
            : result
              ? SIMULATION_BANNER
              : "Idle. Twin not cloned. Run the scenario to open LIVE / SIMULATION / DELTA."}
        </p>
        {error ? <p className="mt-3 text-sm text-miss">{error}</p> : null}
      </section>

      {exitCheck ? (
        <section
          className={`rounded-md border p-5 text-sm ${exitCheck.unchanged ? "border-ice/40 bg-ice/5" : "border-miss/40 bg-miss/5"}`}
          aria-live="polite"
        >
          <p className={`font-mono text-xs uppercase tracking-[0.14em] ${exitCheck.unchanged ? "text-ice" : "text-miss"}`}>
            {exitCheck.unchanged ? "SIMULATION DISCARDED · REALITY UNCHANGED" : "WARNING · REAL STATE CHANGED"}
          </p>
          <p className="mt-2 text-sand">
            {target?.label} is still expected <span className="text-paper">{day(exitCheck.expectedAt)}</span>. State
            fingerprint <span className="font-mono text-paper">{exitCheck.fingerprint}</span>
            {exitCheck.unchanged ? " matches the pre-simulation snapshot." : " differs from the pre-simulation snapshot."}
          </p>
        </section>
      ) : null}

      {result && view ? <Results result={result} view={view} why={why} setWhy={setWhy} /> : null}
    </div>
  );
}

function Results({
  result,
  view,
  why,
  setWhy,
}: {
  result: SimulationResult;
  view: ReturnType<typeof presentSimulation>;
  why: string | null;
  setWhy: (id: string | null) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value="SIMULATION" />
        <span className="text-sm text-sand">
          {result.scope.origin.label} +{result.scenario.days} days · {result.scope.nodes} entities ·{" "}
          {result.scope.edges} dependencies cloned
        </span>
      </div>

      <section className="rounded-md border border-watch/40 bg-watch/10 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-watch">DELTA · if this runs</p>
        <ul className="mt-3 space-y-1 text-2xl text-paper">
          {view.headlines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-sand">{view.cashTiming.note}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Live versus simulation versus delta">
        {view.worlds.map((world) => (
          <WorldColumn key={world.kind} world={world} />
        ))}
      </section>

      <p
        className={`font-mono text-[11px] ${result.isolation.unchanged ? "text-ice" : "text-miss"}`}
        aria-live="polite"
      >
        {view.isolationLine}
      </p>

      <section className="space-y-3">
        <SectionHeader title="What changes" count={`${result.changes.length} objects`} />
        <div className="divide-y divide-hairline rounded-md border border-hairline">
          {result.changes.map((change) => (
            <ChangeRow key={change.id} change={change} open={why === change.id} toggle={setWhy} />
          ))}
        </div>
      </section>
    </div>
  );
}

function WorldColumn({ world }: { world: ReturnType<typeof presentSimulation>["worlds"][number] }) {
  const surface =
    world.kind === "LIVE"
      ? "border-hairline bg-[#0a0d11]"
      : world.kind === "SIMULATION"
        ? "border-dashed border-ice/50 bg-ice/[0.08]"
        : "border-watch/50 bg-watch/10";

  return (
    <article className={`min-w-0 rounded-md border p-5 ${surface}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <StatusBadge value={world.kind} />
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">{world.word}</p>
      </div>
      <h2 className="mt-3 text-2xl text-paper">{world.title}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        {world.facts.map((fact) => (
          <div key={fact.label}>
            <div className="flex justify-between gap-4">
              <dt className="text-mute">{fact.label}</dt>
              <dd className="font-mono text-paper">{fact.value}</dd>
            </div>
            {fact.detail ? <p className="mt-0.5 text-xs text-sand">{fact.detail}</p> : null}
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-sand">{world.note}</p>
    </article>
  );
}

function ChangeRow({
  change,
  open,
  toggle,
}: {
  change: EntityChange;
  open: boolean;
  toggle: (id: string | null) => void;
}) {
  const worsened = change.simulated.late && !change.baseline.late;
  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 font-mono text-[10px] uppercase tracking-wider text-mute">{change.type}</span>
        <div className="min-w-0 flex-1">
          <p className="text-paper">{change.label}</p>
          <p className={`text-sm ${worsened ? "text-need" : "text-sand"}`}>{change.consequence}</p>
        </div>
        <Button type="button" variant="quiet" onClick={() => toggle(open ? null : change.id)}>
          {open ? "HIDE" : "WHY"}
        </Button>
      </div>
      {open ? (
        <ol className="mt-4 space-y-2 border-l border-ice/40 pl-4 text-sm">
          {change.why.steps.map((step) => (
            <li key={step.nodeId}>
              {step.relationship ? (
                <span className="font-mono text-[11px] text-ice">—{step.relationship}→ </span>
              ) : null}
              <span className="text-paper">{step.label}</span>
              {step.baselineAt || step.simulatedAt ? (
                <span className="ml-2 text-xs text-mute">
                  {step.baselineAt === step.simulatedAt
                    ? day(step.simulatedAt)
                    : `${day(step.baselineAt)} → ${day(step.simulatedAt)}`}
                </span>
              ) : null}
              {step.edgeId ? <span className="ml-2 font-mono text-[10px] text-mute">{step.edgeId}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function day(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });
}
