"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PulseAgent, phaseToPulseState, type PulseAgentState } from "@/components/agent/PulseAgent";
import { Inspector } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { CommandComposer } from "@/components/ui/CommandComposer";
import { COMMAND_PROMPTS } from "@/lib/ui/commands";

type TraceStep = {
  id: string;
  label: string;
  detail: string;
  tool?: string;
  decision?: string;
  policy?: string;
};

type Approval = {
  id: string;
  actionId: string;
  title: string;
  why: string;
  impact: string;
  policy: string;
  evidence: string;
  status: string;
};

type AgentPayload = {
  runId: string;
  sessionId: string;
  status: string;
  phase: string;
  runtime: string;
  fallbackUsed: boolean;
  summary: string;
  report: {
    associatedRevenue?: number;
    expectedCash?: number;
    orders?: number;
    customers?: number;
    safe?: number;
    approval?: number;
    blocked?: number;
    executed?: number;
    verificationPending?: number;
    allowedAlternative?: string;
    policyBlocked?: boolean;
    simulationUnchanged?: boolean;
  };
  steps: TraceStep[];
  toolCalls: { id: string; tool: string; status: string; permission: string }[];
  approvals: Approval[];
};

type CommandResponse = {
  commandId: string;
  intent: string;
  status: string;
  summary: string;
  data: Record<string, unknown>;
  links: { href: string; label: string }[];
  sourceSystems: string[];
  session: { id: string; lastIntent: string };
  agent?: AgentPayload;
};

type BusinessContext = {
  company: string;
  needs: number;
  monitoring: number;
  handled: number;
};

const btn =
  "inline-flex min-h-[34px] items-center justify-center rounded-lg bg-ink px-3 text-sm font-medium text-card disabled:opacity-50";
const ghost =
  "inline-flex min-h-[34px] items-center justify-center rounded-lg border border-line bg-card px-3 text-sm text-ink disabled:opacity-50";
const quiet =
  "inline-flex min-h-[34px] items-center justify-center rounded-lg px-3 text-sm text-muted hover:text-ink disabled:opacity-50";

function countOf(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stateFromResult(result: CommandResponse): PulseAgentState {
  const agent = result.agent;
  const report = agent?.report || {};
  const pending = agent?.approvals?.some((item) => item.status === "pending" || item.status === "edited");
  if (report.policyBlocked || result.status === "BLOCKED" || agent?.status === "BLOCKED") return "BLOCKED";
  if (pending) return "WAITING_FOR_APPROVAL";
  if (agent?.phase) return phaseToPulseState(agent.phase, agent.status);
  if (result.status === "FAILED") return "ERROR";
  if (result.status === "APPROVAL_REQUIRED") return "WAITING_FOR_APPROVAL";
  if (result.status === "OK" || result.status === "EXECUTED") return "SUCCESS";
  return "IDLE";
}

export default function CommandPage() {
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [turns, setTurns] = useState<{ message: string; result: CommandResponse }[]>([]);
  const [busy, setBusy] = useState(false);
  const [inflight, setInflight] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [context, setContext] = useState<BusinessContext | null>(null);
  const latest = turns[turns.length - 1];
  const liveState: PulseAgentState = busy ? "THINKING" : latest ? stateFromResult(latest.result) : "IDLE";
  const approvalPending = Boolean(
    latest?.result.agent?.approvals?.some((item) => item.status === "pending" || item.status === "edited"),
  );

  useEffect(() => {
    if (approvalPending) setInspectorOpen(true);
  }, [approvalPending]);

  useEffect(() => {
    const ask = new URLSearchParams(window.location.search).get("ask");
    if (ask) setMessage(ask);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pulse")
      .then((res) => {
        if (!res.ok) throw new Error("pulse");
        return res.json();
      })
      .then((data: { company?: { name?: unknown }; counts?: Record<string, unknown> }) => {
        if (cancelled) return;
        const needs = countOf(data.counts?.NEEDS_YOU);
        const monitoring = countOf(data.counts?.MONITORING);
        const handled = countOf(data.counts?.HANDLED);
        const company = data.company?.name;
        if (needs === null || monitoring === null || handled === null || typeof company !== "string" || !company) return;
        setContext({ company, needs, monitoring, handled });
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInflight(trimmed);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId }),
      });
      const result = (await res.json()) as CommandResponse;
      setSessionId(result.agent?.sessionId || result.session?.id);
      setTurns((current) => [...current, { message: trimmed, result }]);
      setMessage("");
      setInspectorOpen(true);
    } finally {
      setBusy(false);
      setInflight(null);
    }
  }

  async function decide(runId: string, approval: Approval, decision: "approve" | "reject" | "edit") {
    setBusy(true);
    try {
      const path = decision === "reject" ? "reject" : "approve";
      const res = await fetch(`/api/agent/runs/${runId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalId: approval.id, actionId: approval.actionId, decision }),
      });
      const result = (await res.json()) as CommandResponse;
      setTurns((current) =>
        current.map((turn) => (turn.result.agent?.runId === runId ? { ...turn, result } : turn)),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Workspace
      mode="focused"
      inspector={
        <Inspector title="Operation" open={inspectorOpen} onClose={() => setInspectorOpen(false)}>
          {latest ? (
            <div className="space-y-3">
              <PulseAgent state={stateFromResult(latest.result)} />
              <p className="text-sm text-ink">{latest.result.agent?.summary || latest.result.summary}</p>
            </div>
          ) : null}
        </Inspector>
      }
    >
      <div>
        <header>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-teal">Command</p>
          <h1 className="mt-2 text-[30px] font-semibold tracking-tight text-ink">Ask your business</h1>
          <p className="mt-2 max-w-[640px] text-[15px] text-muted">
            Investigate, simulate and act across your business.
          </p>
        </header>

        <div className="mt-8">
          <CommandComposer
            value={message}
            onChange={setMessage}
            onSubmit={(value) => void ask(value)}
            busy={busy}
            agentState={liveState}
            suggestions={[
              "What needs me?",
              "What changed today?",
              "Why is 850K at risk?",
              "Protect everything at risk this week.",
              ...COMMAND_PROMPTS.filter(
                (prompt) =>
                  prompt !== "What needs me?" &&
                  prompt !== "What changed today?" &&
                  prompt !== "Why is 850K at risk?" &&
                  prompt !== "Protect everything at risk this week.",
              ),
            ]}
            onSuggestion={(value) => void ask(value)}
          />
          {context ? (
            <p className="mt-4 flex max-w-[760px] flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span className="font-medium text-ink">{context.company}</span>
              <span aria-hidden>·</span>
              <span className={context.needs > 0 ? "text-need" : undefined}>
                {context.needs === 1 ? "1 needs you" : `${context.needs} need you`}
              </span>
              <span aria-hidden>·</span>
              <span>{context.monitoring} monitoring</span>
              <span aria-hidden>·</span>
              <span>{context.handled} handled</span>
            </p>
          ) : null}
        </div>

        <div className="mt-8 max-w-[760px] space-y-8">
          {turns.map((turn) => (
            <AgentTurn
              key={turn.result.commandId}
              message={turn.message}
              result={turn.result}
              busy={busy}
              onDecide={decide}
            />
          ))}
          {inflight ? (
            <article>
              <p className="text-[13px] text-muted">{inflight}</p>
              <div className="mt-3">
                <PulseAgent state="THINKING" />
                <p className="mt-2 text-sm text-muted">Investigating</p>
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </Workspace>
  );
}

function AgentTurn({
  message,
  result,
  busy,
  onDecide,
}: {
  message: string;
  result: CommandResponse;
  busy: boolean;
  onDecide: (runId: string, approval: Approval, decision: "approve" | "reject" | "edit") => void;
}) {
  const agent = result.agent;
  const report = agent?.report || {};
  const state = stateFromResult(result);
  const pending = agent?.approvals?.filter((item) => item.status === "pending" || item.status === "edited") ?? [];

  return (
    <article>
      <p className="text-[13px] text-muted">{message}</p>
      <div className="mt-3">
        <PulseAgent state={state} />
        {agent?.steps?.length ? (
          <ul className="mt-3 space-y-2">
            {agent.steps.map((step) => (
              <li key={step.id} className="flex gap-2.5 text-sm">
                <span className="mt-0.5 text-ok" aria-hidden="true">
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="text-ink">{step.label}</span>
                  {step.detail ? <span className="mt-0.5 block text-muted">{step.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-[15px] leading-snug text-ink">{agent?.summary || result.summary}</p>
        {typeof report.associatedRevenue === "number" || typeof report.expectedCash === "number" ? (
          <div className="mt-4 space-y-1">
            {typeof report.associatedRevenue === "number" ? (
              <p className="text-sm text-ink">
                <span className="font-semibold tracking-tight">
                  {report.associatedRevenue.toLocaleString("en-US")} DZD
                </span>
                <span className="text-muted"> / Associated revenue</span>
              </p>
            ) : null}
            {typeof report.expectedCash === "number" ? (
              <p className="text-sm text-ink">
                <span className="font-semibold tracking-tight">{report.expectedCash.toLocaleString("en-US")} DZD</span>
                <span className="text-muted"> / Expected cash timing</span>
              </p>
            ) : null}
          </div>
        ) : null}
        {typeof report.safe === "number" && report.safe + (report.approval || 0) + (report.blocked || 0) > 0 ? (
          <p className="mt-3 text-sm text-muted">
            {report.safe} safe · {report.approval || 0} approval · {report.blocked || 0} blocked
            {report.executed ? ` · ${report.executed} executed` : ""}
            {report.verificationPending ? ` · ${report.verificationPending} verifying` : ""}
          </p>
        ) : null}
        {report.simulationUnchanged ? <p className="mt-3 text-sm text-muted">Simulation — reality unchanged</p> : null}
        {report.allowedAlternative ? <p className="mt-3 text-sm text-muted">{report.allowedAlternative}</p> : null}
        {result.links.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {result.links.map((link) => (
              <Link key={link.href + link.label} href={link.href} className={quiet}>
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
        {agent
          ? pending.map((approval) => (
              <section key={approval.id} className="mt-4 rounded-[14px] border border-orange/40 bg-cream p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted">Approval</p>
                <p className="mt-2 text-lg font-semibold text-ink">{approval.title}</p>
                <p className="mt-1 text-sm text-muted">{approval.why}</p>
                {approval.policy ? <p className="mt-1 text-sm text-muted">{approval.policy}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className={btn} onClick={() => onDecide(agent.runId, approval, "approve")}>
                    Approve
                  </button>
                  <button type="button" disabled={busy} className={ghost} onClick={() => onDecide(agent.runId, approval, "edit")}>
                    Edit
                  </button>
                  <button type="button" disabled={busy} className={quiet} onClick={() => onDecide(agent.runId, approval, "reject")}>
                    Reject
                  </button>
                </div>
              </section>
            ))
          : null}
      </div>
    </article>
  );
}
