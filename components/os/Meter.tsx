import { TONE_CLASSES, type Tone } from "@/lib/ui/status";

/** 4px bar for a ratio in [0, 1] (confidence, share of target). Values are clamped. */
export function Meter({
  value,
  tone = "neutral",
  label,
  className = "",
}: {
  value: number;
  tone?: Tone;
  label: string;
  className?: string;
}) {
  const ratio = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const pct = Math.round(ratio * 100);
  return (
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={`flex h-1 w-full overflow-hidden rounded-sm bg-os-line ${className}`}
    >
      <span className={`h-1 rounded-sm ${TONE_CLASSES[tone].bar}`} style={{ width: `${pct}%` }} />
    </span>
  );
}
