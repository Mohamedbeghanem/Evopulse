"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CommandComposer } from "@/components/ui/CommandComposer";
import { EmptyState, ErrorState, LoadingState, PageHeader, SectionHeader } from "@/components/ui/chrome";
import { PolicyBadge, StatusBadge } from "@/components/ui/badges";
import { Workspace } from "@/components/shell/Workspace";
import { InspectorField } from "@/components/shell/Inspector";
import { CANNED_PROMPTS, GOAL_PROMPTS } from "@/lib/prompts";
import { COMMAND_PROMPTS, classifyCommand, traceForIntent, type CommandIntent } from "@/lib/ui/commands";

type AskResult = {
  question: string;
  answer: string;
  grounded: boolean;
  citations: { type: string; id: string; title: string }[];
  now: string;
  phase: string;
};

type GoalResult = {
  goal: { id: string; objective: string; status: string; goal_type: string; scope: string };
  plan?: {
    id?: string;
    summary: string;
    expectedImpact: {
      totalActions: number;
      autoActions: number;
      approvalRequiredActions: number;
      blockedActions: number;
      associatedValueAddressed: number;
      cashTimingUnderAttention: number;
      currency: string;
    };
    actions: Array<{ id?: string; title: string; domain: string; policyDecision: string; reason: string }>;
  };
  context: { risks: Array<{ id: string; domain: string; title: string; associatedValue: number; currency: string }> };
};

type SafeResult = {
  counts?: { prepared: number; executed: number; waitingForApproval: number; blocked: number };
  error?: string;
};

type SimResult = {
  delta: { headline: string[]; cash: { movedToNextPeriod: number } };
  isolation: { unchanged: boolean };
};

export default function CommandPage() {
  const [question, setQuestion] = useState<string>(COMMAND_PROMPTS[4]);
  const [intent, setIntent] = useState<CommandIntent | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [goalResult, setGoalResult] = useState<GoalResult | null>(null);
  const [safeResult, setSafeResult] = useState<SafeResult | null>(null);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [unknown, setUnknown] = useState<string | null>(null);

  const trace = useMemo(() => (intent ? traceForIntent(intent) : []), [intent]);

  async function submit(raw: string) {
    const classified = classifyCommand(raw);
    setIntent(classified);
    setBusy(true);
    setError(null);
    setAskResult(null);
    setGoalResult(null);
    setSafeResult(null);
    setSimResult(null);
    setUnknown(null);
    setStep(0);
    const steps = traceForIntent(classified);
    for (let i = 0; i < steps.length; i += 1) {
      setStep(i);
      await wait(classified === "unknown" ? 80 : 140);
    }
    try {
      if (classified === "simulate") {
        const res = await fetch("/api/simulations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "supplier_delay", targetId: "ent_ship_204", days: 3 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Simulation did not run.");
        setSimResult(data);
      } else if (classified === "discount") {
        const res = await fetch("/api/demo/discount", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Discount ingest failed.");
        const ask = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: "What is putting revenue at risk?" }),
        });
        setAskResult(await ask.json());
      } else if (classified === "goal" || classified === "protect_safe" || classified === "safe_execute") {
        const res = await fetch("/api/goals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ utterance: classified === "goal" ? raw : "Protect everything at risk this week.", plan: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Goal failed.");
        setGoalResult({ goal: data.goal, plan: data.plan, context: data.context });
        if (classified === "safe_execute" && data.plan?.id) {
          const exec = await fetch(`/api/plans/${data.plan.id}/execute-safe`, { method: "POST" });
          const execData = await exec.json();
          if (!exec.ok) setSafeResult({ error: execData.error || "Safe execute refused." });
          else setSafeResult({ counts: execData.counts });
        }
      } else if (classified === "ask") {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: raw }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ask failed.");
        setAskResult(data);
      } else {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: raw }),
        });
        const data = await res.json();
        setUnknown(
          data.answer ||
            "I only operate from business state. I will not invent an answer, a policy decision, or an impact number.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Command failed. Deterministic engines were not bypassed.");
    } finally {
      setBusy(false);
      setStep(steps.length - 1);
    }
  }

  const inspector = (
    <>
      <InspectorField label="Runtime" value="Deterministic command · no hidden prompts" />
      <InspectorField label="Intent" value={intent || "idle"} />
      <p className="text-sm text-sand">
        Visible steps are operational, not chain-of-thought. Policy is rechecked before consequential execution.
      </p>
    </>
  );

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
      </div>

      {busy ? (
        <ol className="mt-8 space-y-2" aria-live="polite">
          {trace.map((label, index) => (
            <li key={label} className={index <= step ? "text-paper" : "text-mute"}>
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

      {unknown ? (
        <article className="mt-8 border border-white/10 p-5">
          <StatusBadge value="UNKNOWN" />
          <p className="mt-3 font-serif text-2xl">{unknown}</p>
          <p className="mt-2 text-sm text-mute">Try a grounded command from the suggestions.</p>
        </article>
      ) : null}

      {simResult ? (
        <article className="mt-8 border border-dashed border-ice/50 bg-ice/5 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ice">Simulation · not live</p>
          <ul className="mt-3 space-y-1 font-serif text-2xl">
            {simResult.delta.headline.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-sand">
            Cash moved to next period: {simResult.delta.cash.movedToNextPeriod.toLocaleString("en-US")} DZD. Isolation{" "}
            {simResult.isolation.unchanged ? "verified" : "failed"}.
          </p>
          <Link href="/simulate" className="mt-4 inline-block text-sm text-need underline underline-offset-4">
            Open the simulation chamber
          </Link>
        </article>
      ) : null}

      {askResult ? (
        <article className="mt-8 border border-white/10 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-need">
            {askResult.grounded ? "Grounded" : "Ungrounded"} · phase {askResult.phase}
          </p>
          <p className="mt-3 font-serif text-2xl leading-snug">{askResult.answer}</p>
          <ul className="mt-4 space-y-1 text-sm text-mute">
            {askResult.citations.map((citation) => (
              <li key={citation.id}>
                {citation.type} · {citation.title}
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {goalResult ? (
        <article className="mt-8 space-y-4 border border-need/30 bg-need/5 p-5">
          <StatusBadge value="PLAN" />
          <h2 className="font-serif text-3xl">{goalResult.goal.objective}</h2>
          <p className="text-sm text-sand">
            {goalResult.goal.status} · {goalResult.goal.goal_type} · {goalResult.goal.scope}
          </p>
          <SectionHeader title="Risks addressed" count={goalResult.context.risks.length} />
          <div className="grid gap-3 md:grid-cols-3">
            {goalResult.context.risks.map((risk) => (
              <div key={risk.id} className="border border-white/10 p-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{risk.domain}</p>
                <p className="mt-1 font-mono text-lg text-need">
                  {risk.associatedValue.toLocaleString("en-US")} {risk.currency}
                </p>
                <p className="mt-1 text-sm text-sand">{risk.title}</p>
              </div>
            ))}
          </div>
          {goalResult.plan ? (
            <div>
              <p className="text-sm text-sand">{goalResult.plan.summary}</p>
              <p className="mt-2 font-mono text-xs text-mute">
                {goalResult.plan.expectedImpact.autoActions} AUTO · {goalResult.plan.expectedImpact.approvalRequiredActions}{" "}
                need approval · {goalResult.plan.expectedImpact.blockedActions} blocked
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {goalResult.plan.actions.map((action) => (
                  <li key={action.id || action.title} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {action.domain} · {action.title}
                    </span>
                    <PolicyBadge outcome={action.policyDecision} />
                  </li>
                ))}
              </ul>
              {safeResult?.counts ? (
                <p className="mt-4 text-sm text-ice">
                  Safe execute: {safeResult.counts.executed} AUTO ran · {safeResult.counts.waitingForApproval} waiting for
                  a human · {safeResult.counts.blocked} blocked. The agent did not self-approve.
                </p>
              ) : null}
              {safeResult?.error ? <p className="mt-4 text-sm text-miss">{safeResult.error}</p> : null}
              <Link
                href={`/goals/${goalResult.goal.id}`}
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
    </Workspace>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
