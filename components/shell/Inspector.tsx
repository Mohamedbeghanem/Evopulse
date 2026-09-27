"use client";

import type { ReactNode } from "react";

export function Inspector({
  title,
  open,
  onClose,
  children,
}: {
  title?: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <button
        type="button"
        aria-label="Close inspector"
        className="fixed inset-0 z-20 bg-ink-950/60 xl:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-30 flex w-[min(100%,22rem)] flex-col overflow-auto border-l border-white/10 bg-ink-950 p-5 xl:static xl:z-0"
        aria-label="Inspector"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{title || "Inspect"}</p>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-sand hover:text-paper"
          >
            Close
          </button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </aside>
    </>
  );
}

export function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</dt>
      <dd className="mt-1 text-sm text-paper">{value || "—"}</dd>
    </div>
  );
}
