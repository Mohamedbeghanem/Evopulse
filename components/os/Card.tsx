import Link from "next/link";
import type { ReactNode } from "react";
import { TONE_CLASSES, type Tone } from "@/lib/ui/status";

// Static strings so Tailwind can see them.
const ACCENT: Record<Tone, string> = {
  risk: "before:bg-risk",
  watch: "before:bg-watch",
  ok: "before:bg-ok",
  ice: "before:bg-ice",
  blocked: "before:bg-miss",
  neutral: "before:bg-calm",
};

/**
 * Item card inside a panel or a list (a decision, an order, a plan step).
 * `tone` tints the border; `accent` adds a 2px left bar in the tone colour.
 * With `href` the whole card is a link.
 */
export function Card({
  tone,
  accent = false,
  href,
  className = "",
  children,
  ...data
}: {
  tone?: Tone;
  accent?: boolean;
  href?: string;
  className?: string;
  children: ReactNode;
} & { [key: `data-${string}`]: string | undefined }) {
  const border = tone ? TONE_CLASSES[tone].border : "border-os-line";
  const fill = tone === "risk" ? "bg-risk/[0.05]" : "bg-os-well";
  const bar = accent && tone ? `before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full ${ACCENT[tone]}` : "";
  const cls = `relative block rounded-node border p-4 ${border} ${fill} ${bar} ${className}`;
  if (href) {
    return (
      <Link href={href} className={`${cls} text-fg no-underline transition-colors hover:bg-os-raise`} {...data}>
        {children}
      </Link>
    );
  }
  return (
    <article className={cls} {...data}>
      {children}
    </article>
  );
}
