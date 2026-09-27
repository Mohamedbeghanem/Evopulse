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
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-teal">{kicker}</p>
      <h1 className="mt-2 text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-ink">{title}</h1>
      {children ? <div className="mt-1.5 text-sm text-muted">{children}</div> : null}
    </header>
  );
}

export function SectionHeader({ title, count }: { title: string; count?: number | string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line pb-2">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</h2>
      {count !== undefined ? <p className="text-[11px] text-muted">{count}</p> : null}
    </div>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-8">
      <p className="text-xl font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

export function LoadingState({ label = "Listening for expected versus actual." }: { label?: string }) {
  return (
    <p className="text-sm text-muted" role="status" aria-live="polite">
      {label}
    </p>
  );
}

export function ErrorState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-line bg-card p-4" role="status">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm text-muted">{body}</p>
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
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{value}</p>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
    </div>
  );
}
