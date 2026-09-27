import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PanelTone = "default" | "risk" | "now" | "well";

const TONES: Record<PanelTone, string> = {
  default: "border border-os-line bg-os-panel",
  risk: "border border-risk/45 bg-os-panel",
  now: "border-[1.5px] border-risk bg-risk-deep",
  well: "border border-os-line bg-os-well",
};

/** Bordered section surface. Use `aria-label` when the panel has no visible heading. */
export function Panel({
  tone = "default",
  className = "",
  children,
  ...rest
}: { tone?: PanelTone } & ComponentPropsWithoutRef<"section">) {
  return (
    <section className={`flex min-w-0 flex-col overflow-hidden rounded-panel ${TONES[tone]} ${className}`} {...rest}>
      {children}
    </section>
  );
}

/** 40px header row: eyebrow on the left, optional meta or link on the right. */
export function PanelHeader({
  eyebrow,
  right,
  className = "",
}: {
  eyebrow: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-os-line px-4 py-2 ${className}`}
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      {right ? <div className="font-mono text-os-eyebrow text-fg-3">{right}</div> : null}
    </div>
  );
}

/** Mono, uppercase, tracked label: "NEEDS YOU · 2". */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-os-eyebrow uppercase text-fg-5 ${className}`}>{children}</span>;
}
