/** Local clock helpers — keep out of lib/clock.ts to avoid the parallel graph lane. */

export function addHours(iso: string, hours: number): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid ISO timestamp: ${iso}`);
  return new Date(ms + hours * 60 * 60 * 1000).toISOString();
}

export function secondsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 1000));
}

export function isAtOrAfter(nowIso: string, deadlineIso: string): boolean {
  return Date.parse(nowIso) >= Date.parse(deadlineIso);
}
