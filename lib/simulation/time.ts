/** Simulation time helpers. All output is ISO in the demo offset (+01:00, Africa/Tunis / Algiers). */

const DAY_MS = 86_400_000;
const OFFSET_MS = 3_600_000;

export function ms(iso: string): number {
  return Date.parse(iso);
}

export function toLocalIso(epochMs: number): string {
  return new Date(epochMs + OFFSET_MS).toISOString().replace(/\.000Z$/, "+01:00").replace(/Z$/, "+01:00");
}

export function shiftDays(iso: string, days: number): string {
  return toLocalIso(ms(iso) + days * DAY_MS);
}

export function maxIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return ms(a) >= ms(b) ? a : b;
}

export function isAfter(a: string, b: string): boolean {
  return ms(a) > ms(b);
}

export function daysBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  return Math.round(((ms(to) - ms(from)) / DAY_MS) * 10) / 10;
}

/** Last minute of the local week (Sunday 23:59) containing `iso`. */
export function endOfLocalWeek(iso: string): string {
  const local = new Date(ms(iso) + OFFSET_MS);
  const toSunday = (7 - local.getUTCDay()) % 7;
  local.setUTCDate(local.getUTCDate() + toSunday);
  local.setUTCHours(23, 59, 0, 0);
  return toLocalIso(local.getTime() - OFFSET_MS);
}

export function formatSimDay(iso: string | null): string {
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
