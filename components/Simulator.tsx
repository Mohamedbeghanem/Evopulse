"use client";

import { useMemo, useState } from "react";
import { presentSimulation, SIMULATION_BANNER } from "@/components/sim/copy";
import type { EntityChange, SimulationResult } from "@/lib/simulation/types";

type Shipment = {
  id: string;
  label: string;
  supplier: string | null;
  expectedAt: string;
  originalExpectedAt: string | null;
};

const DAY_OPTIONS = [1, 2, 3, 5, 7];

const selectClass =
  "mt-1 rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 py-2 text-[#0D1B24]";

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
    return <p className="text-[#5C6B73]">No shipment with an expected arrival exists in the Business Graph.</p>;
  }

  return (
    <div className="space-y-8 font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
      <section
        className={`rounded-[14px] border p-5 ${
          result ? "border-[#0F4C5C]/30 bg-[#E8F1F4]" : "border-[#D8DDD6] bg-[#FFFEFB]"
        }`}
      >
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-[#5C6B73]">Scenario</span>
            <select disabled className={selectClass}>
              <option>Supplier delay</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-[#5C6B73]">Shipment</span>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              disabled={Boolean(result)}
              className={selectClass}
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
            <span className="block font-mono text-[11px] uppercase tracking-[0.18em] text-[#5C6B73]">Additional delay</span>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              disabled={Boolean(result)}
              className={selectClass}
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  +{option} day{option === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          {result ? (
            <button
              type="button"
              onClick={exit}
              className="inline-flex min-h-[34px] items-center rounded-lg border border-[#D8DDD6] bg-[#FFFEFB] px-3 text-sm text-[#0D1B24]"
            >
              EXIT SIMULATION
            </button>
          ) : (
            <button
              type="button"
              onClick={run}
              disabled={busy || !targetId}
              className="inline-flex min-h-[34px] items-center rounded-lg bg-[#0D1B24] px-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? "Simulating…" : "RUN SIMULATION"}
            </button>
          )}
        </div>
        {target ? (
          <p className="mt-4 text-sm text-[#5C6B73]">
            LIVE: {target.label} expected <span className="text-[#0D1B24]">{day(target.expectedAt)}</span>
            {target.originalExpectedAt && target.originalExpectedAt !== target.expectedAt
              ? ` (originally ${day(target.originalExpectedAt)})`
              : ""}
            <span className="ml-2 font-mono text-[11px] text-[#5C6B73]">source: {source}</span>
          </p>
        ) : null}
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-[#5C6B73]" aria-live="polite">
          {busy
            ? "Simulating recovery. Twin not written."
            : result
              ? SIMULATION_BANNER
              : "Idle. Twin not cloned. Run the scenario to open LIVE / SIMULATION / DELTA."}
        </p>
        {error ? <p className="mt-3 text-sm text-[#B42318]">{error}</p> : null}
      </section>

      {exitCheck ? (
        <section
          className={`rounded-[14px] border p-5 text-sm ${
            exitCheck.unchanged ? "border-[#1B7A4A]/40 bg-[#E4F3EA]" : "border-[#B42318]/40 bg-[#FDECEC]"
          }`}
          aria-live="polite"
        >
          <p className={`font-mono text-xs uppercase tracking-[0.14em] ${exitCheck.unchanged ? "text-[#1B7A4A]" : "text-[#B42318]"}`}>
            {exitCheck.unchanged ? "SIMULATION DISCARDED · REALITY UNCHANGED" : "WARNING · REAL STATE CHANGED"}
          </p>
          <p className="mt-2 text-[#5C6B73]">
            {target?.label} is still expected <span className="text-[#0D1B24]">{day(exitCheck.expectedAt)}</span>. State
            fingerprint <span className="font-mono text-[#0D1B24]">{exitCheck.fingerprint}</span>
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
        <Pill tone="teal">SIMULATION</Pill>
        <span className="text-sm text-[#5C6B73]">
          {result.scope.origin.label} +{result.scenario.days} days · {result.scope.nodes} entities ·{" "}
          {result.scope.edges} dependencies cloned
        </span>
      </div>

      <section className="rounded-[14px] border border-[#B45309]/40 bg-[#F8EFCC] p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#B45309]">DELTA · if this runs</p>
        <ul className="mt-3 space-y-1 text-[22px] font-semibold tracking-tight">
          {view.headlines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-[#5C6B73]">{view.cashTiming.note}</p>
      </section>

      <section className="grid gap-4 xl:grid-cols-3" aria-label="Live versus simulation versus delta">
        {view.worlds.map((world) => (
          <WorldColumn key={world.kind} world={world} />
        ))}
      </section>

      <p
        className={`font-mono text-[11px] ${result.isolation.unchanged ? "text-[#1B7A4A]" : "text-[#B42318]"}`}
        aria-live="polite"
      >
        {view.isolationLine}
      </p>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b border-[#D8DDD6] pb-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">What changes</h2>
          <p className="font-mono text-[11px] text-[#5C6B73]">{result.changes.length} objects</p>
        </div>
        <div className="divide-y divide-[#D8DDD6] rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB]">
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
      ? "border-[#D8DDD6] bg-[#FFFEFB]"
      : world.kind === "SIMULATION"
        ? "border-dashed border-[#0F4C5C] bg-[#E8F1F4]"
        : "border-[#B45309] bg-[#F8EFCC]";

  return (
    <article className={`min-w-0 rounded-[14px] border p-5 ${surface}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Pill tone={world.kind === "DELTA" ? "warn" : world.kind === "SIMULATION" ? "teal" : "ink"}>{world.kind}</Pill>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#5C6B73]">{world.word}</p>
      </div>
      <h2 className="mt-3 text-[22px] font-semibold tracking-tight">{world.title}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        {world.facts.map((fact) => (
          <div key={fact.label}>
            <div className="flex justify-between gap-4">
              <dt className="text-[#5C6B73]">{fact.label}</dt>
              <dd className="font-mono text-[#0D1B24]">{fact.value}</dd>
            </div>
            {fact.detail ? <p className="mt-0.5 text-xs text-[#5C6B73]">{fact.detail}</p> : null}
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-[#5C6B73]">{world.note}</p>
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
        <span className="w-24 font-mono text-[10px] uppercase tracking-wider text-[#5C6B73]">{change.type}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[#0D1B24]">{change.label}</p>
          <p className={`text-sm ${worsened ? "text-[#EC6025]" : "text-[#5C6B73]"}`}>{change.consequence}</p>
        </div>
        <button
          type="button"
          onClick={() => toggle(open ? null : change.id)}
          className="inline-flex min-h-8 items-center rounded-lg px-3 text-sm text-[#5C6B73]"
        >
          {open ? "HIDE" : "WHY"}
        </button>
      </div>
      {open ? (
        <ol className="mt-4 space-y-2 border-l border-[#0F4C5C]/40 pl-4 text-sm">
          {change.why.steps.map((step) => (
            <li key={step.nodeId}>
              {step.relationship ? (
                <span className="font-mono text-[11px] text-[#0F4C5C]">—{step.relationship}→ </span>
              ) : null}
              <span className="text-[#0D1B24]">{step.label}</span>
              {step.baselineAt || step.simulatedAt ? (
                <span className="ml-2 text-xs text-[#5C6B73]">
                  {step.baselineAt === step.simulatedAt
                    ? day(step.simulatedAt)
                    : `${day(step.baselineAt)} → ${day(step.simulatedAt)}`}
                </span>
              ) : null}
              {step.edgeId ? <span className="ml-2 font-mono text-[10px] text-[#5C6B73]">{step.edgeId}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function Pill({ children, tone }: { children: string; tone: "teal" | "warn" | "ink" }) {
  const cls =
    tone === "warn"
      ? "bg-[#F8EFCC] text-[#B45309]"
      : tone === "teal"
        ? "bg-[#E8F1F4] text-[#0F4C5C]"
        : "bg-[#F7F8F5] text-[#0D1B24]";
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${cls}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {children.replaceAll("_", " ")}
    </span>
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
