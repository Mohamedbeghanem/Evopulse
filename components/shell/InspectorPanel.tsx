import type { ReactNode } from "react";

export function InspectorPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="hidden w-[360px] shrink-0 flex-col border-l border-line bg-card min-[900px]:flex" aria-label={title}>
      <div className="flex h-14 items-center border-b border-line px-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">{title}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 text-sm text-ink-2">{children}</div>
    </aside>
  );
}
