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
        className="fixed inset-0 z-30 bg-ink-950/70 lg:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-[min(360px,92vw)] flex-col border-l border-hairline bg-[#0a0d11] lg:static lg:z-0"
        aria-label={title}
      >
        <div className="flex h-14 items-center justify-between border-b border-hairline px-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{title}</p>
          <button type="button" className="font-mono text-[11px] uppercase text-sand hover:text-paper" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 text-sm text-sand">{children}</div>
      </aside>
    </>
  );
}
