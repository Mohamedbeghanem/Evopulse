import type { KeyboardEvent, ReactNode } from "react";
import { formatMoney } from "@/lib/clock";
import { attentionTone, StatusBadge } from "./badges";

export type SituationRowModel = {
  id: string;
  title: string;
  summary: string;
  status: string;
  layers: string[];
  money?: { amount: number; currency: string } | null;
  cashTiming?: { amount: number; currency: string } | null;
};

export function SituationRow({
  situation,
  selected,
  onSelect,
}: {
  situation: SituationRowModel;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
      className={`grid w-full grid-cols-1 gap-3 border-b border-line px-3 py-4 text-left sm:grid-cols-[8.5rem_minmax(0,1fr)_auto] ${
        selected ? "bg-[#FFF3EC]" : "hover:bg-cream"
      }`}
    >
      <StatusBadge value={situation.status} />
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-tight text-ink">{situation.title}</p>
        <p className="mt-1 text-sm text-muted">{situation.summary}</p>
        {situation.layers.length ? (
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-muted">{situation.layers.join(" · ")}</p>
        ) : null}
      </div>
      <div className="text-left sm:text-right">
        {situation.money ? (
          <p className={`text-lg font-semibold ${attentionTone(situation.status)}`}>
            {formatMoney(situation.money.amount, situation.money.currency)}
          </p>
        ) : null}
        {situation.cashTiming ? (
          <p className="mt-1 text-[11px] text-muted">
            {formatMoney(situation.cashTiming.amount, situation.cashTiming.currency)} cash timing
          </p>
        ) : null}
      </div>
    </button>
  );
}

export function EvidenceRow({
  index,
  kind,
  title,
  fact,
  current,
  onSelect,
}: {
  index: string;
  kind: string;
  title: string;
  fact: string;
  current?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={current ? "true" : undefined}
      onClick={onSelect}
      className={`w-full border-b border-line px-3 py-3 text-left ${current ? "bg-[#FFF3EC]" : "hover:bg-cream"}`}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">
        {index} · {kind}
      </p>
      <p className="mt-1 font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-muted">{fact}</p>
    </button>
  );
}

export function EventRow({
  time,
  kind,
  statement,
  children,
}: {
  time: string;
  kind: string;
  statement: string;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 border-b border-line px-3 py-3">
      <p className="text-[11px] text-muted">{time}</p>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{kind}</p>
        <p className="mt-1 text-sm text-ink">{statement}</p>
        {children}
      </div>
    </div>
  );
}
