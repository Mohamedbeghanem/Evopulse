import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";

export const attendFont = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const btn = {
  ink: "inline-flex min-h-[34px] items-center justify-center rounded-lg bg-[#0D1B24] px-3 text-sm font-semibold text-white",
  orange: "inline-flex min-h-[34px] items-center justify-center rounded-lg bg-[#EC6025] px-3 text-sm font-semibold text-white",
  ghost:
    "inline-flex min-h-[34px] items-center justify-center rounded-lg border border-[#D8DDD6] bg-transparent px-3 text-sm font-medium text-[#0D1B24]",
  quiet: "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm text-[#5C6B73]",
} as const;

const PILL: Record<string, string> = {
  need: "bg-[#FDE8DC] text-[#B33A0F]",
  watch: "bg-[#E7F1F3] text-[#0F4C5C]",
  ok: "bg-[#E8F6EE] text-[#1B7A4A]",
  bad: "bg-[#FDECEC] text-[#B42318]",
  warn: "bg-[#FFF4E5] text-[#B45309]",
  ink: "bg-[#E8EEF0] text-[#0D1B24]",
};

export function toneFor(value: string) {
  const v = value.toUpperCase().replaceAll("-", " ");
  if (v === "AT RISK" || v === "AT_RISK" || v === "WARN" || v === "WARNING" || v === "TIGHT") return "warn";
  if (v === "NOT MISSED" || v === "NOT_MISSED") return "watch";
  if (
    v === "BLOCKED" ||
    v === "MISSED" ||
    v === "FAILED" ||
    v === "ESCALATED" ||
    v === "CRITICAL"
  ) {
    return "bad";
  }
  if (
    v === "NEEDS YOU" ||
    v === "NEEDS_YOU" ||
    v === "NEEDS APPROVAL" ||
    v === "NEEDS_APPROVAL" ||
    v === "APPROVAL REQUIRED" ||
    v === "APPROVAL_REQUIRED" ||
    v === "HIGH" ||
    v === "ACTIVE" ||
    v === "OPEN"
  ) {
    return "need";
  }
  if (
    v === "MONITORING" ||
    v === "WATCH" ||
    v === "PENDING" ||
    v === "MEDIUM" ||
    v === "PREPARED" ||
    v === "AWAITING_VERIFICATION" ||
    v === "AWAITING VERIFICATION"
  ) {
    return "watch";
  }
  if (
    v === "HANDLED" ||
    v === "AUTO" ||
    v === "AUTO_HANDLED" ||
    v === "AUTO HANDLED" ||
    v === "SUCCESS" ||
    v === "OK" ||
    v === "RESOLVED" ||
    v === "SAFE" ||
    v === "FULFILLED" ||
    v === "HEALTHY" ||
    v === "LOW" ||
    v === "RELIABLE_PATTERN" ||
    v === "RELIABLE PATTERN" ||
    v === "EXECUTED" ||
    v === "COMPLETED"
  ) {
    return "ok";
  }
  return "ink";
}

export function Pill({ children }: { children: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${PILL[toneFor(children)]}`}
    >
      {children.replaceAll("_", " ")}
    </span>
  );
}

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${attendFont.className} min-h-full flex-1 bg-[#F7F8F5] text-[#0D1B24] ${className}`}>{children}</div>;
}

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="max-w-[42rem]">
      <h1 className="text-[22px] font-semibold leading-snug tracking-tight text-[#0D1B24]">{title}</h1>
      {children ? <div className="mt-1.5 max-w-[40rem] text-sm leading-relaxed text-[#5C6B73]">{children}</div> : null}
    </header>
  );
}

export function SectionTitle({ title, count }: { title: string; count?: number | string }) {
  return (
    <h2 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-[#0D1B24]">
      {title}
      {count !== undefined ? <span className="text-xs font-medium text-[#5C6B73]">{count}</span> : null}
    </h2>
  );
}

export function Metric({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-4 py-3">
      <p className="text-[11px] text-[#5C6B73]">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-[#0D1B24]">{value}</p>
      {caption ? <p className="mt-1 text-xs leading-relaxed text-[#5C6B73]">{caption}</p> : null}
    </div>
  );
}

export function EmptyNote({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] px-4 py-6">
      <p className="text-[15px] font-semibold text-[#0D1B24]">{title}</p>
      <p className="mt-1 text-sm text-[#5C6B73]">{body}</p>
    </div>
  );
}

export function Aside({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside
      className={`${attendFont.className} hidden w-[320px] shrink-0 flex-col border-l border-[#D8DDD6] bg-[#FFFEFB] px-5 py-6 text-sm text-[#5C6B73] lg:flex`}
      aria-label={title}
    >
      <p className="text-[13px] font-medium text-[#0F4C5C]">{title}</p>
      <div className="mt-3 space-y-3 text-[#0D1B24]">{children}</div>
    </aside>
  );
}

export function rowCard(selected = false) {
  return `flex w-full items-start gap-3.5 rounded-[14px] border bg-[#FFFEFB] p-3.5 text-left ${
    selected
      ? "border-[rgba(236,96,37,0.45)] shadow-[0_0_0_3px_rgba(236,96,37,0.08)]"
      : "border-[#D8DDD6]"
  }`;
}

const STATUS_ICON: Partial<Record<string, IconName>> = {
  "NEEDS APPROVAL": "approval",
  BLOCKED: "blocked",
  MONITORING: "monitoring",
  HANDLED: "verified",
};

const TONE_COLOR: Record<string, string> = {
  need: "text-[#EC6025]",
  watch: "text-[#0F4C5C]",
  ok: "text-[#1B7A4A]",
  bad: "text-[#B42318]",
  warn: "text-[#B45309]",
  ink: "text-[#5C6B73]",
};

export function StatusWord({ value }: { value: string }) {
  const label = value.replaceAll("_", " ");
  const key = label.toUpperCase();
  const tone = key === "NEEDS APPROVAL" || key === "AT RISK" ? "warn" : toneFor(value);
  const icon = STATUS_ICON[key];
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-medium leading-none ${TONE_COLOR[tone] || TONE_COLOR.ink}`}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {label}
    </span>
  );
}
