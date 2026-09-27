/**
 * One place that decides which colour a status gets. Tags, dots, meters and
 * domain rows all read from here so the same word is never two colours.
 *
 * risk    orange  needs a human, or is at risk
 * watch   amber   worth watching, not yet at risk
 * ok      green   handled, automatic, succeeded (decision D1: stays green)
 * ice     blue    monitoring, planned, pending, simulation
 * blocked red     refused by policy, missed, failed
 * neutral grey    normal, routine, unknown
 */
export type Tone = "risk" | "watch" | "ok" | "ice" | "blocked" | "neutral";

export const TONE_CLASSES: Record<
  Tone,
  { chip: string; tag: string; text: string; dot: string; bar: string; border: string }
> = {
  risk: {
    chip: "bg-risk/15 text-risk-fg",
    tag: "bg-risk/15 text-risk-fg border border-risk/45",
    text: "text-risk-fg",
    dot: "bg-risk",
    bar: "bg-risk",
    border: "border-risk/45",
  },
  watch: {
    chip: "bg-watch/15 text-watch",
    tag: "bg-watch/15 text-watch border border-watch/40",
    text: "text-watch",
    dot: "bg-watch",
    bar: "bg-watch",
    border: "border-watch/40",
  },
  ok: {
    chip: "bg-ok/15 text-ok",
    tag: "bg-ok/15 text-ok border border-ok/35",
    text: "text-ok",
    dot: "bg-ok",
    bar: "bg-ok",
    border: "border-ok/35",
  },
  ice: {
    chip: "bg-ice/15 text-ice",
    tag: "bg-ice/15 text-ice border border-ice/30",
    text: "text-ice",
    dot: "bg-ice",
    bar: "bg-ice",
    border: "border-ice/30",
  },
  blocked: {
    chip: "bg-miss/15 text-miss",
    tag: "bg-miss/15 text-miss border border-miss/40",
    text: "text-miss",
    dot: "bg-miss",
    bar: "bg-miss",
    border: "border-miss/40",
  },
  neutral: {
    chip: "bg-os-raise text-fg-3",
    tag: "bg-os-raise text-fg-3 border border-os-line-2",
    text: "text-fg-3",
    dot: "bg-calm",
    bar: "bg-fg",
    border: "border-os-line",
  },
};

const STATUS_TONES: Record<string, Tone> = {
  // attention
  NEEDS_YOU: "risk",
  NEEDS_APPROVAL: "risk",
  APPROVAL_REQUIRED: "risk",
  AT_RISK: "risk",
  OPEN: "risk",
  ROOT: "risk",
  TRIGGER: "risk",
  // watch
  WATCH: "watch",
  ATTENTION: "watch",
  SIGNAL: "watch",
  // handled
  HANDLED: "ok",
  AUTO_HANDLED: "ok",
  AUTO: "ok",
  EXECUTED: "ok",
  FULFILLED: "ok",
  RESOLVED: "ok",
  SUCCESS: "ok",
  DONE: "ok",
  RELIABLE_PATTERN: "ok",
  // monitoring / in flight
  MONITORING: "ice",
  SIMULATION: "ice",
  PLANNED: "ice",
  APPROVED: "ice",
  PENDING: "ice",
  AWAITING_VERIFICATION: "ice",
  EMERGING_PATTERN: "ice",
  // refused / failed
  BLOCKED: "blocked",
  MISSED: "blocked",
  FAILED: "blocked",
  DECLINED: "blocked",
  // routine
  NORMAL: "neutral",
  HEALTHY: "neutral",
  STABLE: "neutral",
  PROPOSED: "neutral",
  CANCELLED: "neutral",
  INSUFFICIENT_DATA: "neutral",
};

/** "needs you", "NEEDS_YOU" and "needs-you" are the same status. */
export function normalizeStatus(label: string): string {
  return label.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

/** Human form of a status key: NEEDS_YOU → "NEEDS YOU". */
export function statusLabel(label: string): string {
  return normalizeStatus(label).replaceAll("_", " ");
}

export function toneFor(label: string): Tone {
  return STATUS_TONES[normalizeStatus(label)] ?? "neutral";
}

/**
 * Business Twin domain status (lib/engine/twin.ts) → the design's three-word
 * vocabulary: NORMAL / WATCH / AT RISK.
 */
export function domainStatus(status: string): { label: "NORMAL" | "WATCH" | "AT RISK"; tone: Tone } {
  switch (normalizeStatus(status)) {
    case "AT_RISK":
      return { label: "AT RISK", tone: "risk" };
    case "ATTENTION":
    case "MONITORING":
      return { label: "WATCH", tone: "watch" };
    default:
      return { label: "NORMAL", tone: "neutral" };
  }
}
