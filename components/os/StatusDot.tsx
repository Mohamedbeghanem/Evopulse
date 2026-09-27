import { TONE_CLASSES, type Tone } from "@/lib/ui/status";

/** 8px status dot. `pulse` adds the orange ring animation (skipped under reduced motion). */
export function StatusDot({
  tone = "neutral",
  pulse = false,
  label,
  className = "",
}: {
  tone?: Tone;
  pulse?: boolean;
  /** Screen-reader text; omit when the status is already written next to the dot. */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${TONE_CLASSES[tone].dot} ${pulse ? "motion-safe:animate-os-pulse" : ""} ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
