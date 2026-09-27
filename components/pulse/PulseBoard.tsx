"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { btn, Screen, StatusWord } from "@/components/pulse/attend";
import { formatDay, formatMoney } from "@/lib/clock";
import type { AttentionItem } from "@/lib/attention";
import { situationHref } from "@/lib/ui/situation";

type PulseCounts = {
  NEEDS_YOU: number;
  MONITORING: number;
  HANDLED: number;
};

type PulseView = {
  now: string;
  company?: { name: string } | null;
  counts: PulseCounts;
  attention: {
    needsMe: AttentionItem[];
    watching: AttentionItem[];
    handled: AttentionItem[];
  };
};

export function PulseBoard({ pulse }: { pulse: PulseView }) {
  const items = useMemo(
    () => [...pulse.attention.needsMe, ...pulse.attention.watching, ...pulse.attention.handled],
    [pulse],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const open = inspectorOpen && Boolean(selected);
  const clock = formatDay(pulse.now);
  const company = pulse.company?.name;

  function select(id: string) {
    setSelectedId(id);
    setInspectorOpen(true);
  }

  return (
    <Screen className="flex min-h-0">
      <div className="min-w-0 max-w-[920px] flex-1 px-4 py-6 lg:px-8">
        <header>
          <h1 className="text-[30px] font-semibold leading-tight tracking-tight text-[#0D1B24]">Your business is running.</h1>
          {company || clock ? (
            <p className="mt-2 text-[15px] text-[#5C6B73]">{[company, clock].filter(Boolean).join(" · ")}</p>
          ) : null}
          <p className="mt-3 text-[15px] text-[#5C6B73]">
            <span className="font-semibold text-[#EC6025]">{pulse.counts.NEEDS_YOU}</span> Needs you
            <span className="px-2 text-[#D8DDD6]">·</span>
            <span className="font-semibold text-[#0D1B24]">{pulse.counts.MONITORING}</span> Monitoring
            <span className="px-2 text-[#D8DDD6]">·</span>
            <span className="font-semibold text-[#1B7A4A]">{pulse.counts.HANDLED}</span> Handled
          </p>
        </header>

        <section className="mt-8">
          {pulse.attention.needsMe.length ? (
            <div className="space-y-3">
              {pulse.attention.needsMe.map((item) => (
                <OperatorCard key={item.id} item={item} selected={selected?.id === item.id} onSelect={() => select(item.id)} />
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-[#5C6B73]">Nothing needs you. EvoPulse is monitoring the rest of the operating week.</p>
          )}
        </section>

        {pulse.attention.watching.length ? (
          <section className="mt-8">
            <h2 className="mb-1 text-[19px] font-semibold text-[#0D1B24]">Monitoring</h2>
            <div>
              {pulse.attention.watching.map((item) => (
                <SituationLine key={item.id} item={item} selected={selected?.id === item.id} onSelect={() => select(item.id)} />
              ))}
            </div>
          </section>
        ) : null}

        {pulse.attention.handled.length ? (
          <section className="mt-8">
            <h2 className="mb-1 text-[19px] font-semibold text-[#0D1B24]">Handled</h2>
            <div>
              {pulse.attention.handled.map((item) => (
                <SituationLine key={item.id} item={item} selected={selected?.id === item.id} onSelect={() => select(item.id)} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <LightInspector title="Situation" open={open} onClose={() => setInspectorOpen(false)}>
        {selected ? <SelectedInspector item={selected} /> : <p>Select a situation.</p>}
      </LightInspector>
    </Screen>
  );
}

function ImpactLines({ item }: { item: AttentionItem }) {
  if (item.impact.associatedRevenue == null && item.impact.expectedCash == null) return null;
  return (
    <div className="mt-2 space-y-0.5 text-[13px] text-[#5C6B73]">
      {item.impact.associatedRevenue != null ? (
        <p>Associated revenue {formatMoney(item.impact.associatedRevenue, item.impact.currency)}</p>
      ) : null}
      {item.impact.expectedCash != null ? (
        <p>Expected cash timing {formatMoney(item.impact.expectedCash, item.impact.currency)}</p>
      ) : null}
    </div>
  );
}

function OperatorCard({
  item,
  selected,
  onSelect,
}: {
  item: AttentionItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className={`rounded-[14px] border bg-[#FFFEFB] px-4 py-4 ${selected ? "border-[#EC6025]" : "border-[#D8DDD6]"}`}
    >
      <button type="button" aria-pressed={selected} onClick={onSelect} className="w-full text-left">
        <StatusWord value={item.classification} />
        <h2 className="mt-2 text-[16px] font-semibold text-[#0D1B24]">{item.title}</h2>
        <p className="mt-1 text-[15px] leading-relaxed text-[#5C6B73]">{item.summary}</p>
        <ImpactLines item={item} />
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={situationHref(item)} className={btn.orange}>
          Why this matters
        </Link>
        <Link href="/simulate" className={`${btn.ghost} gap-1.5`}>
          <Icon name="simulation" size={14} />
          Simulate
        </Link>
        <Link href="/command" className={btn.quiet}>
          Protect this week
        </Link>
      </div>
    </article>
  );
}

function SituationLine({
  item,
  selected,
  onSelect,
}: {
  item: AttentionItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 border-b border-[#D8DDD6] py-3 text-left ${selected ? "bg-[#FFF7F2]" : ""}`}
    >
      <span className="w-[8.5rem] shrink-0 pt-0.5">
        <StatusWord value={item.classification} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-[#0D1B24]">{item.title}</span>
        <span className="mt-1 block text-[14px] text-[#5C6B73]">{item.summary}</span>
        <ImpactLines item={item} />
      </span>
    </button>
  );
}

function LightInspector({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close inspector"
        className="fixed inset-0 z-30 bg-[#0D1B24]/40 lg:hidden"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-40 flex w-[min(320px,92vw)] flex-col border-l border-[#D8DDD6] bg-[#FFFEFB] lg:static lg:z-0"
        aria-label={title}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#D8DDD6] px-4">
          <p className="text-[13px] font-medium text-[#0F4C5C]">{title}</p>
          <button type="button" className="text-[13px] text-[#5C6B73]" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 text-[14px] text-[#5C6B73]">{children}</div>
      </aside>
    </>
  );
}

function SelectedInspector({ item }: { item: AttentionItem }) {
  return (
    <div className="space-y-4">
      <StatusWord value={item.classification} />
      <p className="text-[16px] font-semibold text-[#0D1B24]">{item.title}</p>
      <p className="text-[15px] leading-relaxed text-[#5C6B73]">{item.summary}</p>
      <p className="text-[12px] text-[#5C6B73]">{item.layers.map((layer) => layer.kind).join(" · ")}</p>
      {item.impact.associatedRevenue != null ? (
        <div className="space-y-3">
          <div>
            <p className="text-[12px] text-[#5C6B73]">Associated revenue</p>
            <p className="mt-1 text-[16px] font-semibold text-[#0D1B24]">
              {formatMoney(item.impact.associatedRevenue, item.impact.currency)}
            </p>
            <p className="mt-1 text-[13px] text-[#5C6B73]">Not a loss. Revenue on the delayed path.</p>
          </div>
          {item.impact.expectedCash != null ? (
            <div>
              <p className="text-[12px] text-[#5C6B73]">Expected cash timing</p>
              <p className="mt-1 text-[16px] font-semibold text-[#0D1B24]">
                {formatMoney(item.impact.expectedCash, item.impact.currency)}
              </p>
              <p className="mt-1 text-[13px] text-[#5C6B73]">Timing at risk. Not lost cash.</p>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Link href={situationHref(item)} className={btn.orange}>
          Why this matters
        </Link>
        <Link href="/simulate" className={`${btn.ghost} gap-1.5`}>
          <Icon name="simulation" size={14} />
          Simulate
        </Link>
        <Link href="/command" className={btn.quiet}>
          Protect this week
        </Link>
      </div>
    </div>
  );
}
