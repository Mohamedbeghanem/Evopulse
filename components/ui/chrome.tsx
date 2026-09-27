import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="max-w-[42rem]">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{kicker}</p>
      <h1 className="mt-3 text-[26px] leading-[1.2] tracking-tight text-paper sm:text-[32px]">{title}</h1>
      {children ? <div className="mt-3 text-sm text-sand">{children}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: number | string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-hairline pb-2">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">{title}</h2>
      {count !== undefined ? <p className="font-mono text-[11px] text-mute">{count}</p> : null}
    </div>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-8">
      <p className="text-xl text-paper">{title}</p>
      <p className="mt-2 text-sm text-sand">{body}</p>
    </div>
  );
}

export function LoadingState({ label = "Listening for expected versus actual." }: { label?: string }) {
  return (
    <p className="font-mono text-sm text-mute" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-hairline p-4" role="status">
      <p className="text-lg text-paper">{title}</p>
      <p className="mt-2 text-sm text-sand">{body}</p>
    </div>
  );
}

export function ImpactMetric({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</p>
      <p className="mt-1 font-mono text-xl text-paper">{value}</p>
      {caption ? <p className="mt-1 text-xs text-mute">{caption}</p> : null}
    </div>
  );
}
