import Link from "next/link";
import { TONE_CLASSES, type Tone } from "@/lib/ui/status";

export type StatItem = { label: string; value: string | number; tone?: Tone; href?: string };

/**
 * Row of counters split by hairlines (the design's event summary strip).
 * Wraps to two columns on small screens.
 */
export function StatStrip({ items, label }: { items: StatItem[]; label: string }) {
  return (
    <section
      aria-label={label}
      className="grid grid-cols-2 overflow-hidden rounded-panel border border-os-line bg-os-panel sm:flex"
    >
      {items.map((item) => {
        const inner = (
          <>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-5">{item.label}</span>
            <span className={`font-mono text-[28px] font-medium leading-none ${item.tone ? TONE_CLASSES[item.tone].text : "text-fg"}`}>
              {item.value}
            </span>
          </>
        );
        const cls = "flex min-w-0 flex-1 flex-col justify-between gap-3 border-b border-r border-os-hair p-4 sm:border-b-0";
        return item.href ? (
          <Link key={item.label} href={item.href} className={`${cls} no-underline hover:bg-os-raise`}>
            {inner}
          </Link>
        ) : (
          <div key={item.label} className={cls}>
            {inner}
          </div>
        );
      })}
    </section>
  );
}
