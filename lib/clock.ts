/** Demo clock. Seed scenario is anchored to Tunis, 27 Sep 2026. */

export const DEMO_NOW_ISO = "2026-09-27T08:18:00+01:00";
export const MESSAGE_ONE_ISO = "2026-09-23T16:42:00+01:00";
export const MESSAGE_TWO_ISO = "2026-09-27T11:05:00+01:00";
export const PROPOSAL_DUE_ISO = "2026-09-24T18:00:00+01:00";
export const DECISION_DUE_ISO = "2026-09-25T17:00:00+01:00";
export const CHECKPOINT_ISO = "2026-09-28T10:00:00+01:00";

export function parseIso(iso: string): Date {
  return new Date(iso);
}

export function addDays(iso: string, days: number, hour = 18, minute = 0): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - 1, minute, 0, 0);
  return d.toISOString().replace("Z", "+00:00");
}

export function nextWeekday(fromIso: string, weekday: number, hour = 17): string {
  const d = parseIso(fromIso);
  const current = d.getUTCDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(fromIso, delta, hour, 0);
}

export function formatDay(iso: string): string {
  return parseIso(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });
}

export function formatMoney(amount: number, currency = "DZD"): string {
  return `${amount.toLocaleString("en-US")} ${currency}`;
}
