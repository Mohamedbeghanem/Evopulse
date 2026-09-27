import type { ReactNode } from "react";

/** One piece of evidence: a source chip (MAIL, ERP, POLICY…) and what it says. */
export function EvidenceRow({ source, children }: { source: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-ctl border border-os-hair bg-os-well px-3 py-2.5">
      <span className="shrink-0 rounded-[3px] bg-os-raise-2 px-1.5 py-0.5 font-mono text-os-chip font-semibold uppercase text-ice">
        {source}
      </span>
      <span className="min-w-0 text-[13px] leading-snug text-fg-2">{children}</span>
    </div>
  );
}

/** Label / value line, mono: "CAUSED BY  SH-204 (+2d)". Use inside a <dl>. */
export function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-2.5 font-mono text-xs">
      <dt className="w-[88px] shrink-0 uppercase text-fg-5">{label}</dt>
      <dd className="min-w-0 text-fg-2">{children}</dd>
    </div>
  );
}
