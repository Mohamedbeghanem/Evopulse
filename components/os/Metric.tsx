import type { ReactNode } from "react";
import { TONE_CLASSES, type Tone } from "@/lib/ui/status";

/** Eyebrow + mono value. `tone` colours the value only. */
export function Metric({
  label,
  value,
  sub,
  tone,
  size = "md",
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const valueSize = size === "lg" ? "text-[44px] leading-none tracking-[-0.03em]" : size === "sm" ? "text-sm" : "text-os-metric";
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-5">{label}</span>
      <span className={`font-mono font-medium ${valueSize} ${tone ? TONE_CLASSES[tone].text : "text-fg"}`}>{value}</span>
      {sub ? <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-4">{sub}</span> : null}
    </div>
  );
}
