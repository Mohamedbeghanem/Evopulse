"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  Lens,
  TemporalState,
  TimeMachine as TimeMachineModel,
  TimelineRow,
  Zone,
} from "@/app/timeline/model";
import { StateChip, StateMark, TONE_TEXT } from "./StateMark";

const ZONES: { key: Zone; label: string; question: string }[] = [
  { key: "PAST", label: "Past", question: "What happened" },
  { key: "NOW", label: "Now", question: "What is true" },
  { key: "FUTURE", label: "Future", question: "What is expected" },
];

const LENSES: { key: Lens; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "CHANGES", label: "Changes" },
  { key: "EXPECTATIONS", label: "Expectations" },
  { key: "ACTIONS", label: "Actions" },
  { key: "VERIFICATIONS", label: "Verifications" },
];

/**
 * One grid for every element on the spine — time, line, content. Sharing it is
 * what keeps the vertical line unbroken through headings, cuts and empty states
 * instead of restarting at each section.
 */
const SPINE_GRID =
  "grid grid-cols-[3.75rem_1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[6.5rem_1.5rem_minmax(0,1fr)] sm:gap-x-4";

function lineClass(dashed: boolean): string {
  return dashed
    ? "w-0 border-l border-dashed border-white/20"
    : "w-0 border-l border-white/12";
}

/** A length of spine with nothing on it, so the line survives the gaps. */
function SpineStub({ dashed, className }: { dashed: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className="flex justify-center self-stretch">
      <span className={`${lineClass(dashed)} ${className ?? "h-full"}`} />
    </span>
  );
}

/** Future rows say what kind of future they are, so none can read as a fact. */
const STANCE_COPY: Record<string, string> = {
  EXPECTED: "Expected",
  AT_RISK: "At risk",
  PLANNED: "Planned",
  SIMULATED: "Simulated",
  MOVED: "Moved",
};

export function TimeMachine({ model }: { model: TimeMachineModel }) {
  const [zone, setZone] = useState<Zone>("NOW");
  const [lens, setLens] = useState<Lens>("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const zoneRefs = useRef<Record<Zone, HTMLElement | null>>({
    PAST: null,
    NOW: null,
    FUTURE: null,
  });

  const rows = useMemo(
    () => model.rows.filter((row) => row.lenses.includes(lens)),
    [model.rows, lens],
  );

  const selected = useMemo(
    () => model.rows.find((row) => row.id === selectedId) ?? null,
    [model.rows, selectedId],
  );

  const goToZone = useCallback((next: Zone) => {
    setZone(next);
    zoneRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const byZone = (key: Zone) => rows.filter((row) => row.zone === key);

  return (
    <div className="selection:bg-need/25 selection:text-paper">
      {/* ------------------------------------------------ controls */}
      <div className="flex flex-col gap-5 border-y border-white/10 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <nav aria-label="Time Machine" className="flex items-center gap-1">
            <span aria-hidden="true" className="pr-1 font-mono text-xs text-mute">
              ←
            </span>
            {ZONES.map((item) => {
              const active = zone === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => goToZone(item.key)}
                  aria-current={active ? "true" : undefined}
                  className={`rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-need/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${
                    active
                      ? "bg-paper text-ink-950"
                      : "text-sand hover:bg-white/5 hover:text-paper"
                  }`}
                >
                  {item.label}
                  {item.key === "NOW" ? (
                    <span className="ml-1.5 tabular-nums">{model.nowClock}</span>
                  ) : null}
                </button>
              );
            })}
            <span aria-hidden="true" className="pl-1 font-mono text-xs text-mute">
              →
            </span>
          </nav>

          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute tabular-nums">
            {model.windowLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
            Show
          </span>
          {LENSES.map((item) => {
            const active = lens === item.key;
            const count = model.rows.filter((r) => r.lenses.includes(item.key)).length;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setLens(item.key)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-need/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${
                  active
                    ? "border-need/60 bg-need/10 text-paper"
                    : "border-white/15 text-sand hover:border-white/30 hover:text-paper"
                }`}
              >
                {item.label}
                <span className="ml-1.5 font-mono text-[10px] text-mute tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <StateLegend summary={model.summary} />
      </div>

      {/* ------------------------------------------------ spine + inspector */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <div>
          {ZONES.map((item) => {
            const zoneRows = byZone(item.key);
            return (
              <section
                key={item.key}
                ref={(el) => {
                  zoneRefs.current[item.key] = el;
                }}
                aria-label={`${item.label} — ${item.question}`}
                className="scroll-mt-6"
              >
                <ZoneHeading
                  label={item.label}
                  question={item.question}
                  count={zoneRows.length}
                  active={zone === item.key}
                  dashed={item.key === "FUTURE"}
                />

                {item.key === "NOW" ? (
                  <NowCut day={model.nowDay} clock={model.nowClock} />
                ) : null}

                {item.key === "FUTURE" && zoneRows.length > 0 ? (
                  <div className={`${SPINE_GRID} pb-1`}>
                    <span />
                    <SpineStub dashed className="min-h-5" />
                    <p className="text-xs leading-relaxed text-mute">
                      None of this has happened. The dashed line marks what is only
                      expected.
                    </p>
                  </div>
                ) : null}

                {zoneRows.length === 0 ? (
                  <div className={`${SPINE_GRID} py-4`}>
                    <span />
                    <SpineStub dashed={item.key === "FUTURE"} className="min-h-6" />
                    <p className="text-sm text-mute">
                      Nothing in this zone under the {lensLabel(lens)} lens.
                    </p>
                  </div>
                ) : (
                  <ol className="pb-4">
                    {zoneRows.map((row) => (
                      <SpineRow
                        key={row.id}
                        row={row}
                        selected={row.id === selectedId}
                        onSelect={() =>
                          setSelectedId((current) => (current === row.id ? null : row.id))
                        }
                      />
                    ))}
                  </ol>
                )}
              </section>
            );
          })}
        </div>

        <Inspector row={selected} onClose={() => setSelectedId(null)} />
      </div>
    </div>
  );
}

function lensLabel(lens: Lens): string {
  return LENSES.find((l) => l.key === lens)?.label.toLowerCase() ?? "current";
}

/** Teaches the six-state vocabulary, and says plainly when a state is legitimately empty. */
function StateLegend({ summary }: { summary: TimeMachineModel["summary"] }) {
  const absent = summary.filter((s) => s.absentNote);
  return (
    <div className="flex flex-col gap-2.5">
      <dl className="flex flex-wrap gap-x-5 gap-y-2">
        {summary.map((item) => (
          <div key={item.state} className="flex items-center gap-1.5">
            <StateMark state={item.state} tone={toneForState(item.state)} size={11} />
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-sand">
              {item.state}
            </dt>
            <dd
              className={`font-mono text-[10px] tabular-nums ${
                item.count === 0 ? "text-mute" : "text-paper"
              }`}
            >
              {item.count}
            </dd>
          </div>
        ))}
      </dl>
      {absent.map((item) => (
        <p key={item.state} className="max-w-2xl text-xs text-mute">
          <span className="font-mono uppercase tracking-[0.14em] text-sand">
            {item.state}
          </span>{" "}
          — {item.absentNote}
        </p>
      ))}
    </div>
  );
}

function toneForState(state: TemporalState) {
  switch (state) {
    case "OBSERVED":
      return "sand" as const;
    case "EXPECTED":
      return "ice" as const;
    case "DETECTED":
      return "need" as const;
    case "PLANNED":
      return "ice" as const;
    case "EXECUTED":
      return "ok" as const;
    default:
      return "ok" as const;
  }
}

function ZoneHeading({
  label,
  question,
  count,
  active,
  dashed,
}: {
  label: string;
  question: string;
  count: number;
  active: boolean;
  dashed: boolean;
}) {
  return (
    <div className={`${SPINE_GRID} sticky top-0 z-10 bg-ink-950/90 py-3 backdrop-blur-sm`}>
      <span />
      <SpineStub dashed={dashed} />
      <div className="flex items-baseline gap-3">
        <h2
          className={`font-serif text-2xl transition-colors duration-150 ${
            active ? "text-paper" : "text-sand"
          }`}
        >
          {label}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
          {question}
        </p>
        <span className="ml-auto font-mono text-[10px] text-mute tabular-nums">
          {count}
        </span>
      </div>
    </div>
  );
}

/** The single emphatic moment on the page: the cut where solid becomes dashed. */
function NowCut({ day, clock }: { day: string; clock: string }) {
  return (
    <div className={`${SPINE_GRID} items-center py-2`}>
      <p className="text-right font-mono text-[11px] uppercase tracking-[0.1em] text-need tabular-nums">
        {clock}
      </p>
      {/* Solid above, dashed below: the transition happens exactly here. */}
      <span aria-hidden="true" className="flex flex-col items-center self-stretch">
        <span className={`${lineClass(false)} h-1.5 flex-none`} />
        <span className="relative my-0.5 flex h-2.5 w-2.5 flex-none">
          <span className="absolute inset-0 rounded-full bg-need motion-safe:animate-throb" />
        </span>
        <span className={`${lineClass(true)} min-h-1.5 flex-1`} />
      </span>
      <p className="flex items-center gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-need">
          Now · {day}
        </span>
        <span
          aria-hidden="true"
          className="h-px flex-1 bg-gradient-to-r from-need/70 via-need/25 to-transparent"
        />
      </p>
    </div>
  );
}

function SpineRow({
  row,
  selected,
  onSelect,
}: {
  row: TimelineRow;
  selected: boolean;
  onSelect: () => void;
}) {
  // The line itself carries the tense: solid behind us, dashed ahead of us.
  const line = lineClass(row.zone === "FUTURE");

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className={`${SPINE_GRID} w-full rounded-lg py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-need/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${
          selected ? "bg-ink-800/50" : "hover:bg-white/[0.03]"
        }`}
      >
        {/* time */}
        <span className="flex flex-col items-end pt-0.5 font-mono text-[11px] leading-tight tabular-nums">
          <span className={row.superseded ? "text-mute line-through" : "text-sand"}>
            {row.dayLabel}
          </span>
          {row.clockLabel ? <span className="text-mute">{row.clockLabel}</span> : null}
        </span>

        {/* spine — runs edge to edge; the zone headings carry their own stubs */}
        <span aria-hidden="true" className="flex flex-col items-center self-stretch">
          <span className={`${line} h-2 flex-none`} />
          <StateMark state={row.state} tone={row.tone} />
          <span className={`${line} min-h-2 flex-1`} />
        </span>

        {/* content */}
        <span className="min-w-0 pt-px">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <StateChip state={row.state} tone={row.tone} />
            {row.stance ? (
              <span
                className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                  row.stance === "AT_RISK"
                    ? "text-miss"
                    : row.stance === "MOVED"
                      ? "text-mute"
                      : "text-ice"
                }`}
              >
                {STANCE_COPY[row.stance]}
              </span>
            ) : null}
          </span>

          <span
            className={`mt-1.5 block font-serif text-xl leading-snug ${
              row.superseded ? "text-mute line-through" : "text-paper"
            }`}
          >
            {row.title}
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-mute">
            <span className="uppercase tracking-[0.12em]">{row.entityType}</span>
            <span aria-hidden="true">·</span>
            <span className="text-sand">{row.entity}</span>
            {row.change ? (
              <>
                <span aria-hidden="true">·</span>
                <span className={TONE_TEXT[row.tone]}>{row.change}</span>
              </>
            ) : null}
            {row.consequence ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-sand">{row.consequence}</span>
              </>
            ) : null}
          </span>

          {row.evidence ? (
            <span className="mt-2 block max-w-[62ch] border-l border-white/10 pl-3 text-sm italic leading-relaxed text-sand">
              {row.evidence}
            </span>
          ) : null}

          {row.divergence ? <Divergence data={row.divergence} /> : null}
        </span>
      </button>
    </li>
  );
}

/**
 * Expected / Observed / Delta / Consequence. The reason this screen is not an
 * event log: the divergence is the content, not something to infer from two rows.
 */
function Divergence({ data }: { data: NonNullable<TimelineRow["divergence"]> }) {
  const cells = [
    { label: data.expectedLabel, value: data.expectedAt, tone: "text-sand" },
    { label: data.observedLabel, value: data.observedAt, tone: "text-paper" },
    { label: "Delta", value: data.deltaLabel, tone: "text-miss" },
    {
      label: "Consequence",
      value: data.consequenceLabel,
      detail: data.consequenceDetail,
      tone: "text-need",
    },
  ];
  return (
    <span className="mt-3 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 sm:grid-cols-4">
      {cells.map((cell) => (
        <span key={cell.label} className="block bg-ink-900 px-3 py-2.5">
          <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-mute">
            {cell.label}
          </span>
          <span
            className={`mt-1 block font-mono text-[11px] leading-snug tabular-nums ${cell.tone}`}
          >
            {cell.value}
          </span>
          {cell.detail ? (
            <span className="mt-0.5 block font-mono text-[10px] text-sand tabular-nums">
              {cell.detail}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

/**
 * Follows the Control OS inspector contract — kicker + name, Current state,
 * Impact facts, Evidence sources, one CTA — rendered in the shipped dark tokens.
 */
function Inspector({ row, onClose }: { row: TimelineRow | null; onClose: () => void }) {
  if (!row) {
    return (
      <aside
        aria-label="Inspector"
        className="hidden rounded-2xl border border-dashed border-white/12 p-5 lg:sticky lg:top-6 lg:block"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
          Inspector
        </p>
        <p className="mt-3 text-sm leading-relaxed text-sand">
          Select anything on the spine to see its source, the expectations it touches,
          and the evidence behind it.
        </p>
      </aside>
    );
  }

  const { inspector } = row;

  return (
    <aside
      aria-label="Inspector"
      className="fixed inset-x-0 bottom-0 z-40 max-h-[72vh] overflow-y-auto rounded-t-2xl border-t border-white/15 bg-ink-900 p-5 shadow-[0_-12px_40px_rgba(0,0,0,0.55)] lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-6 lg:max-h-none lg:rounded-2xl lg:border lg:border-white/10 lg:bg-ink-900/60 lg:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
            {inspector.kicker}
          </p>
          <h2 className="mt-1 font-serif text-2xl leading-snug text-paper">
            {inspector.title}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="-mr-1 -mt-1 rounded-full p-1.5 text-mute transition-colors duration-150 hover:bg-white/5 hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-need/70"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="m4 4 8 8M12 4 4 12" />
          </svg>
        </button>
      </div>

      <Section title="Current state">
        <p className="flex items-start gap-2 text-sm leading-relaxed">
          <StateMark state={row.state} tone={inspector.stateTone} size={12} />
          <span className={TONE_TEXT[inspector.stateTone]}>{inspector.stateLine}</span>
        </p>
      </Section>

      {inspector.facts.length ? (
        <Section title="Impact">
          <dl className="space-y-2.5">
            {inspector.facts.map((fact, i) => (
              <div key={`${fact.label}-${i}`}>
                <dt className="font-mono text-sm text-paper tabular-nums">{fact.value}</dt>
                <dd className="text-xs leading-snug text-mute">{fact.label}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {inspector.sources.length ? (
        <Section title="Evidence">
          <ul className="space-y-2.5">
            {inspector.sources.map((source, i) => (
              <li key={`${source.name}-${i}`}>
                <p className="text-sm text-sand">{source.name}</p>
                <p className="mt-0.5 text-xs leading-snug text-mute">{source.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {inspector.href ? (
        <Link
          href={inspector.href}
          className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-paper px-4 py-2.5 text-sm font-medium text-ink-950 transition-colors duration-150 hover:bg-need focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-need/70 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
        >
          {inspector.hrefLabel}
        </Link>
      ) : null}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
        {title}
      </h3>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}
