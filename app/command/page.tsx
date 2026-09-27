"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { CommandComposer } from "@/components/ui/CommandComposer";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader } from "@/components/ui/chrome";
import { PolicyBadge, StatusBadge } from "@/components/ui/badges";
import { Workspace } from "@/components/shell/Workspace";
import { InspectorField } from "@/components/shell/Inspector";
import { CANNED_PROMPTS, GOAL_PROMPTS } from "@/lib/prompts";
import { COMMAND_PROMPTS } from "@/lib/ui/commands";

type AgentEvent = { label: string; at: string };
type AgentEvidence = { type: string; id: string; title: string };
type AgentLink = { href: string; label: string };
type ToolCall = { id: string; name: string; ok: boolean; forbidden: boolean; result?: unknown };

type AgentResult = {
  id: string;
  intent: string;
  summary: string;
  state: string;
  grounded: boolean;
  unknown: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  provider: string;
  requestedProvider: string;
  model: string | null;
  events: AgentEvent[];
  evidence: AgentEvidence[];
  links: AgentLink[];
  toolCalls: ToolCall[];
  payload: {
    simulation?: {
      delta?: { headline?: string[]; cash?: { movedToNextPeriod?: number } };
      isolation?: { unchanged?: boolean };
    };
    goal?: {
      goal?: { id: string; objective: string; status: string; goal_type: string; scope: string };
      plan?: {
        id?: string;
        summary: string;
        expectedImpact: {
          autoActions: number;
          approvalRequiredActions: number;
          blockedActions: number;
        };
        actions: Array<{ id?: string; title: string; domain: string; policyDecision: string }>;
      };
      context?: { risks?: Array<{ id: string; domain: string; title: string; associatedValue: number; currency: string }> };
    };
    safe?: { counts?: { executed: number; waitingForApproval: number; blocked: number }; error?: string };
    approval?: { waiting?: Array<{ title: string }>; blocked?: Array<{ title: string }> };
    policy?: { live?: { outcome?: string; reason?: string } };
  };
  error: string | null;
};

export default function CommandPage() {
  const [question, setQuestion] = useState<string>("Protect everything at risk this week.");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AgentResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const events = useMemo(() => result?.events || [], [result]);

  async function submit(raw: string) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: raw }),
        signal: controller.signal,
      });
      const data = (await res.json()) as AgentResult & { error?: string };
      if (!res.ok && !data.summary) throw new Error(data.error || "Command failed.");
      setResult(data);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setResult({
          id: "cancelled",
          intent: "cancelled",
          summary: "Command cancelled.",
          state: "CANCELLED",
          grounded: false,
          unknown: false,
          fallbackUsed: false,
          fallbackReason: null,
          provider: "deterministic",
          requestedProvider: "deterministic",
          model: null,
          events: [],
          evidence: [],
          links: [],
          toolCalls: [],
          payload: {},
          error: "User cancelled.",
        });
      } else {
        setError(err instanceof Error ? err.message : "Command failed. Deterministic engines were not bypassed.");
      }
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  const inspector = (
    <>
      <InspectorField label="Runtime" value={result?.provider || "Governed agent"} />
      <InspectorField label="Intent" value={result?.intent || "idle"} />
      <InspectorField label="State" value={result?.state || "IDLE"} />
      <InspectorField label="Model" value={result?.model || "not vendor-locked"} />
      <p className="text-sm text-sand">
        Visible steps are operational, not chain-of-thought. Policy is rechecked before consequential execution. The
        model cannot approve itself.
      </p>
      {result?.fallbackUsed ? <p className="text-sm text-ice">Fallback: {result.fallbackReason}</p> : null}
    </>
  );

  const goal = result?.payload.goal;
  const sim = result?.payload.simulation;
  const safe = result?.payload.safe;
  const policy = result?.payload.policy?.live;

  return (
    <Workspace inspectorTitle="Agent runtime" inspector={inspector}>
      <PageHeader kicker="Command Center" title="Operate the business.">
        <p>Ask, simulate, plan, and hand off approval. This is not a chatbot. The model cannot approve itself.</p>
      </PageHeader>

      <div className="mt-8">
        <CommandComposer
          value={question}
          onChange={setQuestion}
          onSubmit={(value) => void submit(value)}
          busy={busy}
          suggestions={Array.from(new Set([...COMMAND_PROMPTS, ...GOAL_PROMPTS, ...CANNED_PROMPTS]))}
          onSuggestion={(value) => {
            setQuestion(value);
            void submit(value);
          }}
        />
        {busy ? (
          <button type="button" onClick={cancel} className="mt-3 text-sm text-miss underline underline-offset-4">
            Cancel
          </button>
        ) : null}
      </div>

      {busy ? (
        <ol className="mt-8 space-y-2" aria-live="polite">
          {(events.length ? events.map((event) => event.label) : ["Inspecting business…"]).map((label, index) => (
            <li key={`${label}-${index}`} className="text-paper">
              <span className="font-mono text-[11px] uppercase tracking-[0.14em]">{String(index + 1).padStart(2, "0")}</span>
              <span className="ml-3">{label}</span>
            </li>
          ))}
          <LoadingState label="Working from live business state…" />
        </ol>
      ) : null}

      {error ? (
        <div className="mt-8">
          <ErrorState title="Command did not complete." body={error} />
        </div>
      ) : null}

      {result?.state === "CANCELLED" ? (
        <article className="mt-8 border border-white/10 p-5">
          <StatusBadge value="CANCELLED" />
          <p className="mt-3 font-serif text-2xl">{result.summary}</p>
        </article>
      ) : null}

      {result && result.state !== "CANCELLED" && result.unknown ? (
        <article className="mt-8 border border-white/10 p-5">
          <StatusBadge value="UNKNOWN" />
          <p className="mt-3 font-serif text-2xl">{result.summary}</p>
          <p className="mt-2 text-sm text-mute">Try a grounded command from the suggestions.</p>
        </article>
      ) : null}

      {sim?.delta ? (
        <article className="mt-8 border border-dashed border-ice/50 bg-ice/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ice">Simulation · not live</p>
          <ul className="mt-3 space-y-1 font-serif text-2xl">
            {(sim.delta.headline || []).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-sand">
            Cash moved to next period: {(sim.delta.cash?.movedToNextPeriod || 0).toLocaleString("en-US")} DZD. Isolation{" "}
            {sim.isolation?.unchanged ? "verified" : "failed"}.
          </p>
          <Link href="/simulate" className="mt-4 inline-block text-sm text-need underline underline-offset-4">
            Open the simulation chamber
          </Link>
        </article>
      ) : null}

      {result && !result.unknown && !sim && !goal ? (
        <article className="mt-8 border border-white/10 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-need">
            {result.grounded ? "Grounded" : "Ungrounded"} · {result.provider}
          </p>
          <p className="mt-3 font-serif text-2xl leading-snug">{result.summary}</p>
          {policy?.outcome === "BLOCKED" ? (
            <p className="mt-3 text-sm text-miss">
              {policy.outcome}: {policy.reason} OpenRouter cannot override policy.
            </p>
          ) : null}
          <ul className="mt-4 space-y-1 text-sm text-mute">
            {result.evidence.map((citation) => (
              <li key={citation.id}>
                {citation.type} · {citation.title}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {goal?.goal ? (
        <article className="mt-8 space-y-4 border border-need/30 bg-need/5 p-5">
          <StatusBadge value="PLAN" />
          <h2 className="font-serif text-3xl">{goal.goal.objective}</h2>
          <p className="text-sm text-sand">
            {goal.goal.status} · {goal.goal.goal_type} · {goal.goal.scope}
          </p>
          <p className="text-sm text-sand">{result?.summary}</p>
          <SectionHeader title="Risks addressed" count={goal.context?.risks?.length || 0} />
          <div className="grid gap-3 md:grid-cols-3">
            {(goal.context?.risks || []).map((risk) => (
              <div key={risk.id} className="border border-white/10 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{risk.domain}</p>
                <p className="mt-1 font-mono text-lg text-need">
                  {risk.associatedValue.toLocaleString("en-US")} {risk.currency}
                </p>
                <p className="mt-1 text-sm text-sand">{risk.title}</p>
              </div>
            ))}
          </div>
          {goal.plan ? (
            <div>
              <p className="text-sm text-sand">{goal.plan.summary}</p>
              <p className="mt-2 font-mono text-xs text-mute">
                {goal.plan.expectedImpact.autoActions} AUTO · {goal.plan.expectedImpact.approvalRequiredActions} need
                approval · {goal.plan.expectedImpact.blockedActions} blocked
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {goal.plan.actions.map((action) => (
                  <li key={action.id || action.title} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {action.domain} · {action.title}
                    </span>
                    <PolicyBadge outcome={action.policyDecision} />
                  </li>
                ))}
              </ul>
              {safe?.counts ? (
                <p className="mt-4 text-sm text-ice">
                  Safe execute: {safe.counts.executed} AUTO ran · {safe.counts.waitingForApproval} waiting for a human ·{" "}
                  {safe.counts.blocked} blocked. The agent did not self-approve.
                </p>
              ) : null}
              <Link
                href={`/goals/${goal.goal.id}`}
                className="mt-4 inline-flex min-h-10 items-center rounded-full bg-need px-4 text-sm font-medium text-ink-950"
              >
                Open the plan / approval handoff
              </Link>
            </div>
          ) : (
            <EmptyState title="Plan was not generated." body="Retry from Command. Policy was not bypassed." />
          )}
        </article>
      ) : null}

      {result?.links?.length ? (
        <ul className="mt-6 space-y-1 text-sm text-mute">
          {result.links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="text-need underline underline-offset-4">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Workspace>
  );
}
