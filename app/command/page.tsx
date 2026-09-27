"use client";

import Link from "next/link";
import { useState } from "react";
import { CANNED_PROMPTS, GOAL_PROMPTS } from "@/lib/prompts";

type AskResult = {
  question: string;
  answer: string;
  grounded: boolean;
  citations: { type: string; id: string; title: string }[];
  now: string;
  phase: string;
};

type GoalResult = {
  kind: "goal";
  goal: {
    id: string;
    objective: string;
    status: string;
    goal_type: string;
    scope: string;
  };
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
      affectedDomains: string[];
    };
    actions: Array<{
      id?: string;
      title: string;
      domain: string;
      policyDecision: string;
      reason: string;
    }>;
  };
  context: {
    risks: Array<{
      id: string;
      domain: string;
      title: string;
      associatedValue: number;
      currency: string;
    }>;
  };
};

export default function CommandPage() {
  const [question, setQuestion] = useState<string>(GOAL_PROMPTS[0]);
  const [askResult, setAskResult] = useState<AskResult | null>(null);
  const [goalResult, setGoalResult] = useState<GoalResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(q: string) {
    setBusy(true);
    setAskResult(null);
    setGoalResult(null);
    if (isGoalPrompt(q)) {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utterance: q, plan: true }),
      });
      const data = await res.json();
      setBusy(false);
      setGoalResult({
        kind: "goal",
        goal: data.goal,
        plan: data.plan,
        context: data.context,
      });
      return;
    }
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    setAskResult(data);
    setBusy(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Business Control</p>
        <h1 className="mt-2 font-serif text-5xl">Command</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Outcome commands create a Goal and a structured Plan. Questions still read live state.
          This is not a chatbot.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {GOAL_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => {
              setQuestion(prompt);
              void submit(prompt);
            }}
            className="rounded-full border border-need/40 px-3 py-1.5 text-sm text-need hover:bg-need/10"
          >
            {prompt}
          </button>
        ))}
        {CANNED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => {
              setQuestion(prompt);
              void submit(prompt);
            }}
            className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-sand hover:border-need hover:text-paper"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="flex-1 rounded-full border border-white/15 bg-ink-800 px-4 py-3 text-paper outline-none focus:border-need"
        />
        <button
          disabled={busy}
          className="rounded-full bg-paper px-5 py-3 text-sm font-medium text-ink-950 disabled:opacity-50"
        >
          {busy ? "Reading state…" : "Command"}
        </button>
      </form>

      {goalResult ? <GoalCommandResult result={goalResult} /> : null}

      {askResult ? (
        <article className="rounded-2xl border border-white/10 bg-ink-800/50 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-need">
            {askResult.grounded ? "Grounded" : "Ungrounded"} · phase {askResult.phase}
          </p>
          <p className="mt-4 font-serif text-2xl leading-snug">{askResult.answer}</p>
          <ul className="mt-5 space-y-1 text-sm text-mute">
            {askResult.citations.map((c) => (
              <li key={c.id}>
                {c.type} · {c.title}
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  );
}

function isGoalPrompt(text: string) {
  const q = text.toLowerCase();
  return (
    /protect\s+(everything|this|the\s+business|revenue|cash|customer)/.test(q) ||
    /recover\s+(stalled\s+)?opportunit/.test(q) ||
    /what should we handle first/.test(q) ||
    /prepare everything requiring my approval/.test(q)
  );
}

function GoalCommandResult({ result }: { result: GoalResult }) {
  const plan = result.plan;
  return (
    <article className="space-y-5 rounded-2xl border border-need/30 bg-need/5 p-6">
      <p className="text-xs uppercase tracking-[0.18em] text-need">Goal created · not a chat answer</p>
      <h2 className="font-serif text-3xl">{result.goal.objective}</h2>
      <p className="text-sm text-sand">
        Status {result.goal.status} · {result.goal.goal_type} · {result.goal.scope}
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {result.context.risks.map((risk) => (
          <div key={risk.id} className="rounded-xl border border-white/10 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{risk.domain}</p>
            <p className="mt-1 font-mono text-xl text-need">
              {risk.associatedValue.toLocaleString("en-US")} {risk.currency}
            </p>
            <p className="mt-1 text-sm text-sand">{risk.title}</p>
          </div>
        ))}
      </div>
      {plan ? (
        <div className="space-y-3">
          <p className="text-sm text-sand">{plan.summary}</p>
          <p className="font-mono text-xs text-mute">
            {plan.expectedImpact.totalActions} actions · {plan.expectedImpact.autoActions} auto ·{" "}
            {plan.expectedImpact.approvalRequiredActions} need approval · {plan.expectedImpact.blockedActions}{" "}
            blocked
          </p>
          <ul className="space-y-1 text-sm text-sand">
            {plan.actions.map((action) => (
              <li key={action.id || action.title}>
                {action.domain.toUpperCase()} · {action.title} · {action.policyDecision}
              </li>
            ))}
          </ul>
          <Link
            href={`/goals/${result.goal.id}`}
            className="inline-flex rounded-full bg-need px-5 py-2.5 text-sm font-medium text-ink-950"
          >
            Open the plan
          </Link>
        </div>
      ) : null}
    </article>
  );
}
