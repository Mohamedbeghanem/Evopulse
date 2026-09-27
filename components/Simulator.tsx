"use client";

import { useEffect, useState } from "react";
import type { EntityChange, ProjectionMetrics, SimulationResult } from "@/lib/simulation/types";
import { Button } from "@/components/ui/primitives";
import { ErrorState, LoadingState, PageHeader, SectionHeader } from "@/components/ui/chrome";

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
  autoRun = false,
}: {
  shipments: Shipment[];
  source: string;
  initialFingerprint: string;
  autoRun?: boolean;
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

  const target = shipments.find((s) => s.id === targetId);

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

  useEffect(() => {
    if (autoRun && targetId && !result && !busy) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, targetId]);

  async function exit() {
    const fingerprintBefore = result?.isolation.fingerprintBefore ?? initialFingerprint;
    setResult(null);
    setWhy(null);
    try {
      const res = await fetch("/api/simulations");
      const data = (await res.json()) as { fingerprint: string; shipments: Shipment[] };
      const real = data.shipments.find((s) => s.id === targetId);
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
      <PageHeader kicker="Simulation chamber · NOT LIVE" title="What if?">
        <p>Clone a graph slice. Change one lever. Compare LIVE, SIMULATION, and DELTA. Reality is never written.</p>
      </PageHeader>

      <section className="border border-dashed border-ice/40 bg-ice/5 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ice">SIMULATION · NOT LIVE BUSINESS STATE</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Shipment</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              disabled={Boolean(result)}
              className="mt-1 rounded-md border border-white/15 bg-ink-900 px-3 py-2 text-paper"
            >
              {shipments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.supplier ? `${s.supplier} · ` : ""}
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Additional delay</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              disabled={Boolean(result)}
              className="mt-1 rounded-md border border-white/15 bg-ink-900 px-3 py-2 text-paper"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  +{d} day{d === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          {result ? (
            <Button variant="ghost" onClick={exit}>
              EXIT SIMULATION
            </Button>
          ) : (
            <Button variant="attention" onClick={() => void run()} disabled={busy || !targetId}>
              {busy ? "Simulating…" : "RUN SIMULATION"}
            </Button>
          )}
        </div>
        {target ? (
          <p className="mt-4 text-sm text-sand">
            Live arrival {day(target.expectedAt)}
            {target.originalExpectedAt && target.originalExpectedAt !== target.expectedAt
              ? ` · originally ${day(target.originalExpectedAt)}`
              : ""}
            <span className="ml-2 font-mono text-[11px] text-mute">source {source}</span>
          </p>
        ) : null}
        {busy ? <div className="mt-3"><LoadingState label="Cloning the downstream slice. Evidence is closed." /></div> : null}
        {error ? <div className="mt-3"><ErrorState title="Simulation did not run." body={error} /></div> : null}
      </section>

      {exitCheck ? (
        <section className={`border p-5 text-sm ${exitCheck.unchanged ? "border-ok/40 bg-ok/5" : "border-miss/40 bg-miss/5"}`}>
          <p className={`font-mono text-xs ${exitCheck.unchanged ? "text-ok" : "text-miss"}`}>
            {exitCheck.unchanged ? "SIMULATION DISCARDED · REALITY UNCHANGED" : "WARNING · REAL STATE CHANGED"}
          </p>
          <p className="mt-2 text-sand">
            {target?.label} is still expected <span className="text-paper">{day(exitCheck.expectedAt)}</span>. Fingerprint{" "}
            <span className="font-mono">{exitCheck.fingerprint}</span>
            {exitCheck.unchanged ? " matches the pre-simulation snapshot." : " differs from the pre-simulation snapshot."}
          </p>
        </section>
      ) : null}

      {result ? <Results result={result} why={why} setWhy={setWhy} /> : null}
    </div>
  );
}

function Results({
  result,
  why,
  setWhy,
}: {
  result: SimulationResult;
  why: string | null;
  setWhy: (id: string | null) => void;
}) {
  const { baseline, simulated, delta } = result;
  return (
    <div className="space-y-8">
      <p className={`font-mono text-[11px] ${result.isolation.unchanged ? "text-ok" : "text-miss"}`}>
        Isolation {result.isolation.unchanged ? "verified" : "FAILED"} · twin fingerprint unchanged · {result.isolation.tablesChecked} tables
      </p>
      <section className="grid gap-4 xl:grid-cols-3">
        <World title="LIVE" word="REALITY" metrics={baseline} tone="live" />
        <World title="SIMULATION" word="NOT REAL" metrics={simulated} tone="sim" />
        <div className="border border-need/40 bg-need/10 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-need">DELTA · IF THIS RUNS</p>
          <ul className="mt-4 space-y-2 font-serif text-2xl">
            {delta.headline.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-sand">
            {delta.cash.movedToNextPeriod.toLocaleString("en-US")} DZD cash moves into next period
            {delta.cash.invoicesMoved[0] ? ` · ${delta.cash.invoicesMoved[0].label}` : ""}. Not lost revenue. Not 540K.
          </p>
        </div>
      </section>

      <section>
        <SectionHeader title="Compare WHY paths" />
        <div className="mt-3 divide-y divide-white/5 border border-white/10">
          {result.changes.map((change) => (
            <ChangeRow key={change.id} change={change} open={why === change.id} toggle={setWhy} />
          ))}
        </div>
      </section>
    </div>
  );
}

function World({
  title,
  word,
  metrics,
  tone,
}: {
  title: string;
  word: string;
  metrics: ProjectionMetrics;
  tone: "live" | "sim";
}) {
  const money = (n: number) => `${n.toLocaleString("en-US")} ${metrics.currency}`;
  return (
    <div className={tone === "sim" ? "border border-dashed border-ice/50 bg-ice/5 p-5" : "border border-white/10 bg-ink-900 p-5"}>
      <p className={`font-mono text-[11px] uppercase tracking-[0.16em] ${tone === "sim" ? "text-ice" : "text-mute"}`}>
        {title} · {word}
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        <Metric k="Shipment arrives" v={day(metrics.shipmentArrival)} />
        <Metric k="Commitments missed" v={String(metrics.commitmentsMissed.length)} list={metrics.commitmentsMissed} />
        <Metric k="Orders late" v={String(metrics.ordersLate.length)} list={metrics.ordersLate} />
        <Metric k="Customer deadlines" v={String(metrics.customersAffected.length)} list={metrics.customersAffected} />
        <Metric k="Revenue on late orders" v={money(metrics.revenueAtRisk)} />
        <Metric k="Cash this period" v={money(metrics.cashInPeriod)} />
        <Metric k="Cash next period" v={money(metrics.cashNextPeriod)} />
      </dl>
    </div>
  );
}

function Metric({ k, v, list }: { k: string; v: string; list?: { id: string; label: string }[] }) {
  return (
    <div>
      <div className="flex justify-between gap-4">
        <dt className="text-mute">{k}</dt>
        <dd className="font-mono text-paper">{v}</dd>
      </div>
      {list?.length ? <p className="mt-0.5 text-xs text-sand">{list.map((x) => x.label).join(" · ")}</p> : null}
    </div>
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
        <button
          onClick={() => toggle(open ? null : change.id)}
          className="rounded-full border border-white/15 px-3 py-1 font-mono text-[11px] text-sand hover:border-paper hover:text-paper"
        >
          {open ? "HIDE" : "WHY"}
        </button>
      </div>
      {open ? (
        <ol className="mt-4 space-y-2 border-l border-ice/40 pl-4 text-sm">
          {change.why.steps.map((step) => (
            <li key={step.nodeId}>
              {step.relationship ? <span className="font-mono text-[11px] text-ice">—{step.relationship}→ </span> : null}
              <span className="text-paper">{step.label}</span>
              {step.baselineAt || step.simulatedAt ? (
                <span className="ml-2 text-xs text-mute">
                  {step.baselineAt === step.simulatedAt
                    ? day(step.simulatedAt)
                    : `${day(step.baselineAt)} → ${day(step.simulatedAt)}`}
                </span>
              ) : null}
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
