"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export function Inspector({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close inspector"
        className="fixed inset-0 z-30 bg-ink/50 min-[900px]:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-[min(360px,92vw)] flex-col border-l border-line bg-card min-[900px]:static min-[900px]:z-0"
        aria-label={title}
      >
        <div className="flex h-14 items-center justify-between border-b border-line px-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{title}</p>
          <button type="button" className="text-[12px] text-muted hover:text-ink" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 text-sm text-ink-2">{children}</div>
      </aside>
    </>
  );
}
