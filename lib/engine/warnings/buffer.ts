/** Hours of slack that still count as tight. At or above this, the buffer is safe. */
export const TIGHT_BUFFER_HOURS = 6;

export type BufferState = "AT_RISK" | "TIGHT" | "SAFE";

export type BufferAssessment = {
  state: BufferState;
  /** Hours still missing. Zero when the buffer is not negative. */
  shortfallHours: number;
  /** available − required. Negative when the work does not fit. */
  bufferHours: number;
  /** True only when failure is approaching, not when the buffer is merely thin. */
  highRisk: boolean;
};

export function hoursBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return (to - from) / 36e5;
}

function roundHours(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Compare time still available with time required.
 * A negative buffer is AT_RISK. A thin non-negative buffer is TIGHT.
 * TIGHT is not a high-risk warning on its own.
 */
export function assessBuffer(availableHours: number, requiredHours: number): BufferAssessment {
  const bufferHours = roundHours(availableHours - requiredHours);
  const shortfallHours = bufferHours < 0 ? roundHours(-bufferHours) : 0;
  const state: BufferState =
    bufferHours < 0 ? "AT_RISK" : bufferHours < TIGHT_BUFFER_HOURS ? "TIGHT" : "SAFE";
  return {
    state,
    shortfallHours,
    bufferHours,
    highRisk: state === "AT_RISK",
  };
}

export function formatHours(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}h`;
}
