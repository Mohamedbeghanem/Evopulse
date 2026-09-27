import type { KeyboardEvent, ReactNode } from "react";
import { formatMoney } from "@/lib/clock";
import type { Situation } from "@/lib/ui/attention";
import { attentionTone, StatusBadge } from "./badges";

export function SituationRow({
  situation,
  selected,
  onSelect,
}: {
  situation: Situation;
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
      className={`grid w-full grid-cols-[8.5rem_minmax(0,1fr)_auto] gap-4 border-b border-white/10 px-3 py-4 text-left ${
        selected ? "border-l-2 border-l-need bg-need/5" : "border-l-2 border-l-transparent hover:bg-white/[0.02]"
      }`}
    >
      <StatusBadge value={situation.projection} />
      <div className="min-w-0">
        <p className="font-serif text-2xl leading-tight text-paper">{situation.title}</p>
        <p className="mt-1 text-sm text-sand">{situation.summary}</p>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-mute">
          {situation.layers.join(" · ")}
        </p>
      </div>
      <div className="text-right">
        {situation.money ? (
          <p className={`font-mono text-lg ${attentionTone(situation.projection)}`}>
            {formatMoney(situation.money.amount, situation.money.currency)}
          </p>
        ) : null}
        {situation.cashTiming ? (
          <p className="mt-1 font-mono text-[11px] text-mute">
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
      className={`w-full border-b border-white/10 px-3 py-3 text-left ${current ? "bg-need/5" : "hover:bg-white/[0.02]"}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
        {index} · {kind}
      </p>
      <p className="mt-1 text-paper">{title}</p>
      <p className="mt-1 text-sm text-sand">{fact}</p>
    </button>
  );
}

export function EventRow({
  kind,
  at,
  title,
  detail,
  children,
}: {
  kind: string;
  at: string;
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <li className="border-l border-white/10 py-3 pl-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">
        {kind} · {at}
      </p>
      <p className="mt-1 text-paper">{title}</p>
      <p className="text-sm text-sand">{detail}</p>
      {children}
    </li>
  );
}
