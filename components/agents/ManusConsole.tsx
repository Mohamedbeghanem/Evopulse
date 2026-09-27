"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, CheckCircle2, CircleDashed, CircleDot, Hand, Lightbulb, OctagonAlert, Wrench } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import type { ManusRunView } from "@/lib/agents/manus/runtime";
import type { ManusToolInfo } from "@/lib/agents/manus/runtime";

type RunSummary = { id: string; goal: string; status: string; startedAt: string };

const SUGGESTIONS = ["Protect everything at risk this week.", "What needs my attention?", "Why is revenue at risk?"];

const STATUS_ICON = {
  completed: <CheckCircle2 aria-hidden size={16} className="text-ok" />,
  in_progress: <CircleDot aria-hidden size={16} className="text-need" />,
  blocked: <OctagonAlert aria-hidden size={16} className="text-watch" />,
  not_started: <CircleDashed aria-hidden size={16} className="text-mute" />,
} as const;

const KIND_LABEL: Record<string, string> = {
  read: "read",
  prepare: "prepare",
  approval: "needs approval",
  control: "control",
  external_read: "web read",
  unavailable: "not available",
  refused: "refused",
};

/** Human-only decision via the normal agent approve flow. Never the agent tool `approve_action`. */
const HUMAN_DECIDE = (runId: string) => `/api/agent/runs/${runId}/approve`;

export function ManusConsole({
  initialRun,
  runs,
  tools,
  llm,
}: {
  initialRun: ManusRunView | null;
  runs: RunSummary[];
  tools: ManusToolInfo[];
  llm: { configured: boolean; model: string | null };
}) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [answer, setAnswer] = useState("");
  const [run, setRun] = useState<ManusRunView | null>(initialRun);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/manus/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json()) as { run?: ManusRunView; error?: string };
      if (!res.ok || !data.run) throw new Error(data.error || "Run failed");
      setRun(data.run);
      setAnswer("");
      router.replace(`/agents/manus?run=${data.run.id}`, { scroll: false });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(approvalId: string, decision: "approve" | "reject") {
    if (!run || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(HUMAN_DECIDE(run.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvalId, decision }) });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not record the decision");
      const fresh = await fetch(`/api/agents/manus/runs/${run.id}`).then((r) => r.json() as Promise<{ run?: ManusRunView }>);
      if (fresh.run) setRun(fresh.run);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record the decision");
    } finally {
      setBusy(false);
    }
  }

  const pending = run?.approvals.filter((a) => a.status === "pending" || a.status === "edited") || [];

  return (
    <div className="space-y-8" data-testid="manus-console">
      <section aria-labelledby="manus-goal" className="rounded-md border border-hairline bg-ink-900 p-4">
        <h2 id="manus-goal" className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
          Goal
        </h2>
        <form
          className="mt-3 flex flex-col gap-3 md:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (goal.trim()) void start({ goal: goal.trim() });
          }}
        >
          <label htmlFor="manus-goal-input" className="sr-only">
            Goal for the agent
          </label>
          <input
            id="manus-goal-input"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            placeholder="e.g. Protect everything at risk this week."
            maxLength={2000}
            className="min-h-11 flex-1 rounded-md border border-hairline bg-ink-800 px-4 py-2.5 text-paper outline-none focus:border-need"
          />
          <Button type="submit" variant="attention" disabled={busy || !goal.trim()} aria-busy={busy}>
            {busy ? "Running…" : "Run agent"}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((text) => (
            <button key={text} type="button" onClick={() => setGoal(text)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-sand hover:text-paper">
              {text}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-mute" data-testid="manus-runtime-note">
          {llm.configured
            ? `Model: OpenRouter ${llm.model} (free-model policy). Falls back to the deterministic runtime if the model is unavailable.`
            : "OpenRouter is not configured — runs use the deterministic runtime (EvoPulse playbooks). No model is called."}
        </p>
        {error ? (
          <p className="mt-3 text-sm text-miss" role="status">
            {error}
          </p>
        ) : null}
      </section>

      {run ? <RunView run={run} pending={pending} busy={busy} decide={decide} answer={answer} setAnswer={setAnswer} start={start} /> : (
        <p className="text-sand">No agent runs yet. Give Manus a goal to start.</p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="manus-history">
          <h2 id="manus-history" className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
            Recent runs
          </h2>
          <ul className="mt-3 space-y-2">
            {runs.length ? (
              runs.map((item) => (
                <li key={item.id}>
                  <Link href={`/agents/manus?run=${item.id}`} className="block rounded-md border border-hairline px-3 py-2 text-sm text-sand hover:text-paper">
                    <span className="line-clamp-1 text-paper">{item.goal}</span>
                    <span className="font-mono text-[11px] uppercase text-mute">{item.status.replace(/_/g, " ")}</span>
                  </Link>
                </li>
              ))
            ) : (
              <li className="text-sm text-mute">None yet.</li>
            )}
          </ul>
        </section>
        <section aria-labelledby="manus-tools">
          <h2 id="manus-tools" className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
            Tools
          </h2>
          <ul className="mt-3 grid gap-1 text-sm" data-testid="manus-tools">
            {tools.map((tool) => (
              <li key={tool.name} className="flex items-baseline justify-between gap-3 border-b border-hairline py-1">
                <span className={tool.available ? "font-mono text-xs text-paper" : "font-mono text-xs text-mute line-through"}>{tool.name}</span>
                <span className="text-right text-[11px] text-mute" title={tool.reason || undefined}>
                  {tool.available ? `${KIND_LABEL[tool.kind] || tool.kind} · ${tool.source}` : tool.kind === "external_read" ? "not configured" : "not available"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function RunView({
  run,
  pending,
  busy,
  decide,
  answer,
  setAnswer,
  start,
}: {
  run: ManusRunView;
  pending: ManusRunView["approvals"];
  busy: boolean;
  decide: (approvalId: string, decision: "approve" | "reject") => Promise<void>;
  answer: string;
  setAnswer: (value: string) => void;
  start: (body: Record<string, unknown>) => Promise<void>;
}) {
  const plan = run.plan;
  const byStep = new Map<number, ManusRunView["events"]>();
  for (const event of run.events) {
    if (event.stepIndex === null || !["thought", "tool_call", "tool_result", "approval", "ask_human", "stuck", "max_steps", "fallback"].includes(event.kind)) continue;
    const list = byStep.get(event.stepIndex) || [];
    list.push(event);
    byStep.set(event.stepIndex, list);
  }
  const flowNotes = run.events.filter((e) => e.stepIndex === null && e.kind === "fallback");
  return (
    <section aria-labelledby="manus-run" className="space-y-6" data-testid="manus-run">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="manus-run" className="text-lg text-paper">
            {run.goal.split("\n")[0]}
          </h2>
          <p className="mt-1 text-sm text-sand" data-testid="manus-summary">
            {run.summary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[11px] uppercase">
          <span className="rounded border border-white/10 px-2 py-1 text-sand" data-testid="manus-status">
            {run.status.replace(/_/g, " ")}
          </span>
          <span className="rounded border border-white/10 px-2 py-1 text-sand" data-testid="manus-runtime">
            {run.runtime === "openrouter" ? `OpenRouter · ${run.model || "model"}` : "Deterministic runtime"}
          </span>
          {run.planSource ? <span className="rounded border border-white/10 px-2 py-1 text-mute">plan: {run.planSource}</span> : null}
        </div>
      </header>
      {run.fallbackReason && run.runtime === "deterministic" ? <p className="text-xs text-mute">{run.fallbackReason}</p> : null}
      {flowNotes.map((note) => (
        <p key={note.seq} className="text-xs text-watch">
          {String(note.payload.reason || "")}
        </p>
      ))}

      {pending.length ? (
        <div className="rounded-md border border-need/40 bg-need/5 p-4" data-testid="manus-approvals">
          <h3 className="flex items-center gap-2 text-sm font-medium text-paper">
            <Hand aria-hidden size={16} className="text-need" /> Waiting for your approval ({pending.length})
          </h3>
          <p className="mt-1 text-xs text-mute">Nothing below has run. Policy is rechecked right before anything executes. The agent cannot approve its own work.</p>
          <ul className="mt-3 space-y-3">
            {pending.map((approval) => (
              <li key={approval.id} className="rounded-md border border-hairline bg-ink-900 p-3" data-testid="manus-approval-item">
                <p className="text-paper">{approval.title}</p>
                <p className="mt-1 text-xs text-sand">{approval.policy || approval.why}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="attention" disabled={busy} onClick={() => void decide(approval.id, "approve")} aria-label={`Approve: ${approval.title}`}>
                    Approve
                  </Button>
                  <Button type="button" variant="quiet" disabled={busy} onClick={() => void decide(approval.id, "reject")} aria-label={`Reject: ${approval.title}`}>
                    Reject
                  </Button>
                  {approval.links.map((link) => (
                    <Link key={link.href + link.label} href={link.href} className="text-sm text-need hover:underline">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {run.question ? (
        <form
          className="rounded-md border border-watch/40 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (answer.trim()) void start({ previousRunId: run.id, answer: answer.trim() });
          }}
        >
          <p className="text-sm text-paper">Manus asks: {run.question}</p>
          <label htmlFor="manus-answer" className="sr-only">
            Your answer
          </label>
          <input id="manus-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} className="mt-3 min-h-11 w-full rounded-md border border-hairline bg-ink-800 px-4 text-paper" />
          <Button type="submit" className="mt-3" disabled={busy || !answer.trim()}>
            Answer and continue
          </Button>
        </form>
      ) : null}

      {plan ? (
        <ol className="space-y-4" data-testid="manus-plan">
          {plan.steps.map((step, index) => (
            <li key={index} className="rounded-md border border-hairline p-4" data-testid="manus-plan-step">
              <div className="flex items-start gap-2">
                {STATUS_ICON[plan.stepStatuses[index]]}
                <div className="min-w-0 flex-1">
                  <p className="text-paper">
                    <span className="font-mono text-xs text-mute">{index + 1}.</span> {step}
                  </p>
                  {plan.stepNotes[index] ? <p className="mt-1 text-xs text-watch">{plan.stepNotes[index]}</p> : null}
                  <StepEvents events={byStep.get(index) || []} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function StepEvents({ events }: { events: ManusRunView["events"] }) {
  if (!events.length) return null;
  return (
    <ul className="mt-3 space-y-2 border-l border-hairline pl-3 text-sm">
      {events.map((event) => {
        const p = event.payload;
        if (event.kind === "thought") {
          return (
            <li key={event.seq} className="flex gap-2 text-sand">
              <Lightbulb aria-hidden size={14} className="mt-0.5 shrink-0 text-mute" />
              <span>
                <span className="sr-only">Thought: </span>
                {String(p.content || "…")}
              </span>
            </li>
          );
        }
        if (event.kind === "tool_call") {
          return (
            <li key={event.seq} className="flex flex-wrap items-center gap-2">
              <Wrench aria-hidden size={14} className="text-mute" />
              <code className="font-mono text-xs text-paper">{String(p.name)}</code>
              <span className="rounded border border-white/10 px-1.5 font-mono text-[10px] uppercase text-mute">{KIND_LABEL[String(p.kind)] || String(p.kind)}</span>
              {p.arguments && Object.keys(p.arguments as object).length ? (
                <code className="max-w-full truncate font-mono text-[11px] text-mute">{JSON.stringify(p.arguments)}</code>
              ) : null}
            </li>
          );
        }
        if (event.kind === "tool_result") {
          if (p.name === "terminate") return null;
          return (
            <li key={event.seq}>
              <details className="text-xs">
                <summary className="cursor-pointer text-mute">
                  Result: <span className={p.status === "ok" ? "text-ok" : "text-watch"}>{String(p.status).replace(/_/g, " ")}</span>
                  {p.error ? <span className="text-miss"> — {String(p.error)}</span> : null}
                </summary>
                <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-ink-800 p-2 text-[11px] text-sand">{String(p.output || "")}</pre>
              </details>
            </li>
          );
        }
        if (event.kind === "approval") {
          return (
            <li key={event.seq} className="flex gap-2 text-need">
              <Hand aria-hidden size={14} className="mt-0.5 shrink-0" /> Approval item: {String(p.title)}
            </li>
          );
        }
        if (event.kind === "ask_human") {
          return (
            <li key={event.seq} className="flex gap-2 text-watch">
              <Bot aria-hidden size={14} className="mt-0.5 shrink-0" /> Asked you: {String(p.question)}
            </li>
          );
        }
        return (
          <li key={event.seq} className="text-xs text-watch">
            {event.kind === "stuck" ? "Stuck — changing strategy." : event.kind === "max_steps" ? `Reached the step limit (${String(p.maxSteps)}).` : String(p.reason || event.kind)}
          </li>
        );
      })}
    </ul>
  );
}
