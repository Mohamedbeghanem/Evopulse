"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PulseAvatar } from "@/components/pulse/PulseAvatar";
import { useAgentAvatar } from "@/components/pulse/useAgentAvatar";
import { Inspector } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { ActionBar, EmptyState, ImpactMetric, PageHeader, SectionHeader } from "@/components/ui/chrome";
import { Button } from "@/components/ui/primitives";
import { SituationRow } from "@/components/ui/rows";
import { formatMoney } from "@/lib/clock";
import type { AttentionItem } from "@/lib/attention";
import { SUGGESTED_PROMPTS } from "@/lib/ui/commands";
import { pulseCounts } from "@/lib/ui/pulse-counts";
import { AgentList } from "@/components/agents/AgentList";
import type { AgentCard } from "@/lib/business/agents";
import { situationHref, situationRowFromAttention } from "@/lib/ui/situation";
import { DemoPathPanel } from "@/components/demo-loop/DemoPathPanel";
import { OutcomePanel } from "@/components/demo-loop/OutcomePanel";
import type { DemoPathStep } from "@/lib/demo-loop/demo-path";
import type { PulseOutcome } from "@/lib/demo-loop/outcomes";

type PulseView = {
  headline: string;
  attention: {
    needsMe: AttentionItem[];
    watching: AttentionItem[];
    handled: AttentionItem[];
    summary: {
      needsYou: number;
      needsApproval: number;
      monitoring: number;
      handled: number;
      eventsProcessed: number;
      autoHandled: number;
    };
  };
};

export function PulseBoard({
  pulse,
  companyName,
  agents = [],
  outcome,
  demoPath,
}: {
  pulse: PulseView;
  companyName: string;
  agents?: AgentCard[];
  outcome?: PulseOutcome;
  demoPath?: { steps: DemoPathStep[]; currentStepId: string | null };
}) {
  const avatar = useAgentAvatar();
  const items = useMemo(
    () => [...pulse.attention.needsMe, ...pulse.attention.watching, ...pulse.attention.handled],
    [pulse],
  );
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? null);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [switching, setSwitching] = useState(false);
  const summary = pulse.attention.summary;
  const counts = pulseCounts(summary);
  const needsYou = counts.needsYou;
  const handledAutomatically = counts.handled;

  async function newCompany() {
    setSwitching(true);
    await fetch("/api/company/new", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <Workspace
      mode="operational"
      inspector={
        <Inspector title="Situation" open={inspectorOpen && Boolean(selected)} onClose={() => setInspectorOpen(false)}>
          {selected ? <SelectedInspector item={selected} /> : <p>Select a situation.</p>}
        </Inspector>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <PageHeader kicker="Pulse" title="Your business is running.">
          <p className="text-paper" data-testid="pulse-company">{companyName}</p>
          <p>
            {needsYou} needs you · {counts.monitoring} monitoring · {handledAutomatically} handled automatically
          </p>
        </PageHeader>
        <div className="flex flex-col items-end gap-3">
          <PulseAvatar state={avatar} size="sm" />
          <Button type="button" variant="quiet" disabled={switching} onClick={() => void newCompany()}>
            {switching ? "Opening…" : "+ New company"}
          </Button>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-3 max-w-xl">
        <Census label="Needs you" value={needsYou} />
        <Census label="Monitoring" value={counts.monitoring} />
        <Census label="Handled automatically" value={handledAutomatically} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Link
            key={prompt}
            href={`/command?q=${encodeURIComponent(prompt)}`}
            className="rounded-md border border-hairline px-3 py-1.5 text-sm text-sand hover:border-need hover:text-paper"
          >
            {prompt}
          </Link>
        ))}
      </div>

      {demoPath ? <DemoPathPanel steps={demoPath.steps} currentStepId={demoPath.currentStepId} /> : null}
      {outcome ? <OutcomePanel outcome={outcome} /> : null}

      {agents.length ? (
        <section className="mt-10 space-y-3">
          <SectionHeader title="Agents" count={agents.length} />
          <AgentList agents={agents} compact />
          <Link href="/agents" className="text-sm text-need">
            All agent activity
          </Link>
        </section>
      ) : null}

      <section className="mt-10 space-y-3">
        <SectionHeader title="Needs you" count={pulse.attention.needsMe.length} />
        {pulse.attention.needsMe.length ? (
          pulse.attention.needsMe.map((item) => (
            <SituationRow
              key={item.id}
              situation={situationRowFromAttention(item)}
              selected={selected?.id === item.id}
              onSelect={() => {
                setSelectedId(item.id);
                setInspectorOpen(true);
              }}
            />
          ))
        ) : (
          <EmptyState title="Nothing needs you." body="Pulse is monitoring the rest of the operating week." />
        )}
      </section>

      <section className="mt-10 space-y-3">
        <SectionHeader title="Monitoring" count={pulse.attention.watching.length} />
        {pulse.attention.watching.map((item) => (
          <SituationRow
            key={item.id}
            situation={situationRowFromAttention(item)}
            selected={selected?.id === item.id}
            onSelect={() => {
              setSelectedId(item.id);
              setInspectorOpen(true);
            }}
          />
        ))}
      </section>

      <section className="mt-10 space-y-3">
        <SectionHeader title="Handled" count={pulse.attention.handled.length} />
        {pulse.attention.handled.map((item) => (
          <SituationRow
            key={item.id}
            situation={situationRowFromAttention(item)}
            selected={selected?.id === item.id}
            onSelect={() => {
              setSelectedId(item.id);
              setInspectorOpen(true);
            }}
          />
        ))}
      </section>
    </Workspace>
  );
}

function Census({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-hairline bg-ink-800 px-3 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{label}</p>
      <p className="mt-1 text-2xl text-paper">{value}</p>
    </div>
  );
}

function SelectedInspector({ item }: { item: AttentionItem }) {
  return (
    <div className="space-y-4">
      <p className="text-paper">{item.title}</p>
      <p>{item.summary}</p>
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">
        {item.layers.map((layer) => layer.kind).join(" · ")}
      </p>
      {item.impact.associatedRevenue != null ? (
        <div className="grid gap-3">
          <ImpactMetric
            label="Associated revenue"
            value={formatMoney(item.impact.associatedRevenue, item.impact.currency)}
            caption="Not a loss. Revenue on the delayed path."
          />
          {item.impact.expectedCash != null ? (
            <ImpactMetric
              label="Expected cash timing"
              value={formatMoney(item.impact.expectedCash, item.impact.currency)}
              caption="Timing at risk. Not lost cash."
            />
          ) : null}
        </div>
      ) : null}
      <ActionBar>
        <Link href={situationHref(item)}>
          <Button variant="attention">Why this matters</Button>
        </Link>
        <Link href="/simulate">
          <Button variant="ghost">Simulate</Button>
        </Link>
        <Link href="/command">
          <Button variant="quiet">Protect this week</Button>
        </Link>
      </ActionBar>
    </div>
  );
}
