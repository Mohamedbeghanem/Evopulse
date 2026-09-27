import type { TemporalState, Tone } from "@/app/timeline/model";

/**
 * Each temporal state carries three independent signals: a drawn silhouette, the
 * state word in type, and colour. Colour is the reinforcement, never the carrier —
 * the shapes stay legible in greyscale and to a colour-blind reader.
 */
const SHAPES: Record<TemporalState, React.ReactNode> = {
  // Filled disc — it happened.
  OBSERVED: <circle cx="8" cy="8" r="4" fill="currentColor" stroke="none" />,
  // Dashed ring — anticipated, not yet real.
  EXPECTED: <circle cx="8" cy="8" r="4" strokeDasharray="2.4 1.8" />,
  // Diamond with a centre dot — the engine inferred this.
  DETECTED: (
    <>
      <path d="M8 3.4 12.6 8 8 12.6 3.4 8Z" />
      <circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // Open square — a slot we intend to fill.
  PLANNED: <rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1" />,
  // Filled square with a check — done, by us.
  EXECUTED: (
    <>
      <rect x="4.2" y="4.2" width="7.6" height="7.6" rx="1" fill="currentColor" />
      <path d="m5.9 8.2 1.7 1.7 2.6-3.1" stroke="var(--mark-knockout)" strokeWidth="1.6" />
    </>
  ),
  // Concentric rings — confirmed by evidence outside ourselves.
  VERIFIED: (
    <>
      <circle cx="8" cy="8" r="5.4" />
      <circle cx="8" cy="8" r="2.1" fill="currentColor" stroke="none" />
    </>
  ),
};

export const TONE_TEXT: Record<Tone, string> = {
  paper: "text-paper",
  sand: "text-sand",
  ice: "text-ice",
  need: "text-need",
  miss: "text-miss",
  ok: "text-ok",
  mute: "text-mute",
};

export const TONE_BORDER: Record<Tone, string> = {
  paper: "border-paper/40",
  sand: "border-sand/40",
  ice: "border-ice/40",
  need: "border-need/45",
  miss: "border-miss/45",
  ok: "border-ok/40",
  mute: "border-white/15",
};

export function StateMark({
  state,
  tone,
  size = 16,
}: {
  state: TemporalState;
  tone: Tone;
  size?: number;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      className={`${TONE_TEXT[tone]} shrink-0 [--mark-knockout:#080a0d]`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SHAPES[state]}
    </svg>
  );
}

/** Glyph + the state word. The word is the accessible name; the glyph reinforces. */
export function StateChip({ state, tone }: { state: TemporalState; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-b pb-px font-mono text-[10px] uppercase tracking-[0.14em] ${TONE_TEXT[tone]} ${TONE_BORDER[tone]}`}
    >
      <StateMark state={state} tone={tone} size={11} />
      {state}
    </span>
  );
}
