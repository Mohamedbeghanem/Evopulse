import type { ReactNode } from "react";
import { Eyebrow } from "./Panel";

/** Top of every screen: eyebrow, 26px title, optional meta or actions on the right. */
export function ScreenHeader({
  eyebrow,
  title,
  lede,
  right,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  lede?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 max-w-3xl flex-col gap-1.5">
        <Eyebrow className="tracking-[0.14em]">{eyebrow}</Eyebrow>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.015em] text-fg sm:text-os-title">{title}</h1>
        {lede ? <p className="text-sm text-fg-3">{lede}</p> : null}
      </div>
      {right ? <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-fg-3">{right}</div> : null}
    </div>
  );
}

/** Heading for a group of cards outside a panel: "Needs you 2" + caption. */
export function SectionHeader({
  title,
  count,
  caption,
  right,
  id,
}: {
  title: ReactNode;
  count?: number;
  caption?: ReactNode;
  right?: ReactNode;
  id?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="flex items-baseline gap-2 text-base font-semibold text-fg">
        {title}
        {count !== undefined ? <span className="font-mono text-xs font-medium text-fg-5">{count}</span> : null}
      </h2>
      {caption || right ? (
        <div className="flex items-center gap-3 text-xs text-fg-4">
          {caption}
          {right}
        </div>
      ) : null}
    </div>
  );
}
