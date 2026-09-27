"use client";

import Link from "next/link";

export type SegItem = { key: string; label: string; href?: string };

const BASE =
  "inline-flex h-[30px] items-center rounded-[5px] px-3 font-mono text-[11px] font-semibold tracking-[0.06em] transition-colors";
const ON = "bg-[#1F2731] text-fg";
const OFF = "text-fg-4 hover:text-fg";

/**
 * Segmented control. Items with `href` are links (URL state, server-rendered pages);
 * otherwise `onChange` receives the key (client state).
 */
export function Seg({
  items,
  value,
  onChange,
  label,
  className = "",
}: {
  items: SegItem[];
  value: string;
  onChange?: (key: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`inline-flex gap-0.5 rounded-ctl bg-os-well p-0.5 ${className}`}>
      {items.map((item) => {
        const on = item.key === value;
        const cls = `${BASE} ${on ? ON : OFF}`;
        return item.href ? (
          <Link key={item.key} href={item.href} className={cls} aria-current={on ? "true" : undefined}>
            {item.label}
          </Link>
        ) : (
          <button
            key={item.key}
            type="button"
            className={cls}
            aria-pressed={on}
            onClick={() => onChange?.(item.key)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
