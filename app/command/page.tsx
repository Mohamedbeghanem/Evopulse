"use client";

import Link from "next/link";
import { useState } from "react";
import { DEMO_COMMANDS } from "@/lib/prompts";

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

export default function CommandPage() {
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [turns, setTurns] = useState<{ message: string; result: CommandResponse }[]>([]);
  const [busy, setBusy] = useState(false);

  async function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: trimmed, sessionId }),
    });
    const result = (await res.json()) as CommandResponse;
    setSessionId(result.agent?.sessionId || result.session?.id);
    setTurns((current) => [...current, { message: trimmed, result }]);
    setMessage("");
    setBusy(false);
  }

  async function decide(runId: string, approval: Approval, decision: "approve" | "reject" | "edit") {
    setBusy(true);
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
    setBusy(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Operating console</p>
        <h1 className="mt-2 font-serif text-5xl">Command</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Ask the business to inspect, simulate, plan, and act. Engines decide what is true. Policy decides what is allowed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {DEMO_COMMANDS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => void ask(prompt)}
            className="rounded-full border border-white/15 px-3 py-1.5 text-left text-sm text-sand hover:border-need hover:text-paper"
          >
            {prompt}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(message);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Protect everything at risk this week."
          className="flex-1 rounded-full border border-white/15 bg-ink-800 px-4 py-3 text-paper outline-none focus:border-need"
        />
        <button disabled={busy} className="rounded-full bg-paper px-5 py-3 text-sm font-medium text-ink-950 disabled:opacity-50">
          {busy ? "Operating…" : "Run"}
        </button>
      </form>

      <div className="space-y-4">
        {turns.map((turn) => (
          <AgentTurn
            key={turn.result.commandId}
            message={turn.message}
            result={turn.result}
            busy={busy}
            onDecide={decide}
          />
        ))}
      </div>
    </div>
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
  return (
    <article className="rounded-2xl border border-white/10 bg-ink-800/40 p-5">
      <p className="text-sm text-mute">{message}</p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-need">
        {phaseLabel(agent?.phase || result.status)} · {agent?.runtime || "command"}
        {agent?.fallbackUsed ? " · fallback" : ""}
      </p>
      <h2 className="mt-2 font-serif text-3xl">{agent?.summary || result.summary}</h2>

      {agent?.steps?.length ? (
        <ol className="mt-5 space-y-3">
          {agent.steps.map((step) => (
            <li key={step.id} className="border-l border-white/15 pl-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-need">{step.label}</p>
              <p className="mt-1 text-sand">{step.detail}</p>
              {step.policy ? <p className="mt-1 text-xs text-mute">{step.policy}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {typeof report.associatedRevenue === "number" ? (
        <p className="mt-4 text-sand">
          {report.orders} orders · {report.customers} customers · {report.associatedRevenue.toLocaleString("en-US")} associated ·{" "}
          {Number(report.expectedCash || 0).toLocaleString("en-US")} expected cash timing
        </p>
      ) : null}

      {typeof report.safe === "number" && (report.safe + (report.approval || 0) + (report.blocked || 0) > 0) ? (
        <p className="mt-3 text-sand">
          {report.safe} safe · {report.approval || 0} approval · {report.blocked || 0} blocked
          {report.executed ? ` · ${report.executed} executed` : ""}
          {report.verificationPending ? ` · ${report.verificationPending} verification pending` : ""}
        </p>
      ) : null}

      {report.simulationUnchanged ? (
        <p className="mt-3 font-mono text-xs uppercase text-need">Simulation — reality unchanged</p>
      ) : null}

      {report.allowedAlternative ? <p className="mt-3 text-sand">{report.allowedAlternative}</p> : null}

      {agent?.approvals?.filter((item) => item.status === "pending" || item.status === "edited").map((approval) => (
        <section key={approval.id} className="mt-5 rounded-xl border border-need/40 p-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-need">Approval required</p>
          <p className="mt-2 font-serif text-2xl">{approval.title}</p>
          <p className="mt-2 text-sand">{approval.why}</p>
          {approval.impact ? <p className="mt-1 text-sm text-mute">Impact: {approval.impact}</p> : null}
          {approval.policy ? <p className="mt-1 text-sm text-mute">Policy: {approval.policy}</p> : null}
          {approval.evidence ? <p className="mt-1 text-sm text-mute">Evidence: {approval.evidence}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(agent.runId, approval, "approve")}
              className="rounded-full bg-paper px-4 py-2 text-sm text-ink-950 disabled:opacity-50"
            >
              Approve
            </button>
            <Link href="/goals" className="rounded-full border border-white/15 px-4 py-2 text-sm">
              Edit
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(agent.runId, approval, "reject")}
              className="rounded-full border border-white/15 px-4 py-2 text-sm disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </section>
      ))}

      <div className="mt-4 flex flex-wrap gap-2">
        {result.links.map((link) => (
          <Link key={link.href + link.label} href={link.href} className="rounded-full border border-white/15 px-3 py-1.5 text-sm">
            {link.label}
          </Link>
        ))}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
        {(agent?.toolCalls || []).map((call) => call.tool).join(" → ") || result.sourceSystems.join(" · ") || "no engine"}
      </p>
    </article>
  );
}

function phaseLabel(phase: string) {
  if (phase === "INTERPRETING") return "Understanding request";
  if (phase === "RUNNING_TOOL" || phase === "WAITING_FOR_TOOL") return "Inspecting business";
  if (phase === "EXECUTING") return "Executing";
  if (phase === "VERIFYING") return "Verifying";
  if (phase === "WAITING_FOR_APPROVAL") return "Waiting for your approval";
  if (phase === "COMPLETE") return "Complete";
  if (phase === "FAILED") return "Failed";
  if (phase === "CANCELLED") return "Cancelled";
  return phase.replaceAll("_", " ");
}
