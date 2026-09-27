import { formatDay, formatMoney, parseIso } from "../clock";

/** The demo scenario is anchored to one timezone; every UI date uses it. */
export const UI_TIMEZONE = "Africa/Tunis";

export { formatDay, formatMoney };

/** 300000 → "300K", 1250000 → "1.25M", 950 → "950". Sign is kept. */
export function compactAmount(amount: number): string {
  const sign = amount < 0 ? "−" : "";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}K`;
  return `${sign}${abs}`;
}

function trim(value: number): string {
  return Number(value.toFixed(2)).toString();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Top-bar stamp for the demo clock: "SUN 27 SEP · 08:18". Empty input → "". */
export function demoStamp(iso: string): string {
  if (!iso) return "";
  const date = parseIso(iso);
  if (Number.isNaN(date.getTime())) return "";
  // formatToParts keeps the output stable across ICU versions ("Sep" vs "Sept").
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: UI_TIMEZONE,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const month = MONTHS[Number(get("month")) - 1] ?? "";
  const day = `${get("weekday").slice(0, 3)} ${Number(get("day"))} ${month}`;
  const time = `${get("hour")}:${get("minute")}`;
  return `${day} · ${time}`.toUpperCase();
}
