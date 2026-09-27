import type { ReactNode } from "react";

export function InspectorPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="hidden w-[360px] shrink-0 flex-col border-l border-hairline bg-[#0a0d11] lg:flex" aria-label={title}>
      <div className="flex h-14 items-center border-b border-hairline px-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{title}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-4 text-sm text-sand">{children}</div>
    </aside>
  );
}
