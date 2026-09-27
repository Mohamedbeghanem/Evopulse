import type { ReactNode } from "react";
import { TONE_CLASSES, statusLabel, toneFor, type Tone } from "@/lib/ui/status";

/**
 * Status label. Tone comes from lib/ui/status unless given, and
 * "NEEDS YOU" / "NEEDS_YOU" resolve to the same colour.
 * `chip` is the small inline marker; `tag` is the bordered one used in tables.
 */
export function Tag({
  children,
  tone,
  variant = "chip",
  icon,
  className = "",
}: {
  children: string;
  tone?: Tone;
  variant?: "chip" | "tag";
  icon?: ReactNode;
  className?: string;
}) {
  const resolved = tone ?? toneFor(children);
  const shape =
    variant === "tag"
      ? `gap-1.5 rounded-tag px-2 py-1 text-[10px] ${TONE_CLASSES[resolved].tag}`
      : `gap-1 rounded-[3px] px-1.5 py-0.5 text-os-chip ${TONE_CLASSES[resolved].chip}`;
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap font-mono font-semibold uppercase tracking-[0.08em] ${shape} ${className}`}
    >
      {icon}
      {statusLabel(children)}
    </span>
  );
}
