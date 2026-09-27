"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PulseAvatar } from "@/components/pulse/PulseAvatar";
import { Inspector } from "@/components/shell/Inspector";
import { Workspace } from "@/components/shell/Workspace";
import { CommandComposer } from "@/components/ui/CommandComposer";
import { PolicyBadge, StatusBadge } from "@/components/ui/badges";
import { ActionBar, PageHeader } from "@/components/ui/chrome";
import { Button } from "@/components/ui/primitives";
import { avatarStateFromAgent } from "@/lib/company/avatar";
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

export default function CommandPage() {
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [turns, setTurns] = useState<{ message: string; result: CommandResponse }[]>([]);
  const [busy, setBusy] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const latest = turns[turns.length - 1];
  const avatar = avatarStateFromAgent(
    busy ? latest?.result.agent?.phase || "RUNNING_TOOL" : latest?.result.agent?.phase,
    latest?.result.agent?.status,
  );

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("q");
    if (query) void ask(query);
    // Run once for the judge path from Pulse chips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setInspectorOpen(true);
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
    <Workspace
      mode="focused"
      inspector={
        <Inspector title="Operation" open={inspectorOpen} onClose={() => setInspectorOpen(false)}>
          {latest?.result.agent ? (
            <div className="space-y-3">
              <StatusBadge value={latest.result.agent.phase} />
              <p>Runtime: {latest.result.agent.runtime}</p>
              {latest.result.agent.fallbackUsed ? <p>Governed fallback is active. The demo continues.</p> : null}
              <p>Policy still owns permission. The model does not calculate money.</p>
            </div>
          ) : (
            <p>Ask the business. Visible steps only — no hidden chain-of-thought.</p>
          )}
        </Inspector>
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-6">
        <PageHeader kicker="Command · Operating console" title="Ask your business.">
          <p>AI investigates. EvoPulse determines truth. Policy determines permission.</p>
        </PageHeader>
        <PulseAvatar state={avatar} size="sm" />
      </div>

      <div className="mt-8">
        <CommandComposer
          value={message}
          onChange={setMessage}
          onSubmit={(value) => void ask(value)}
          busy={busy}
          suggestions={COMMAND_PROMPTS}
          onSuggestion={(value) => void ask(value)}
        />
      </div>

      <div className="mt-8 space-y-6">
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
  return (
    <article className="border-t border-hairline pt-6">
      <p className="text-sm text-mute">{message}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <StatusBadge value={phaseLabel(agent?.phase || result.status)} />
        {agent?.fallbackUsed ? <PolicyBadge outcome="FALLBACK" /> : null}
      </div>
      <h2 className="mt-3 text-2xl text-paper">{agent?.summary || result.summary}</h2>

      {agent?.steps?.length ? (
        <ol className="mt-5 space-y-3">
          {agent.steps.map((step) => (
            <li key={step.id} className="border-l border-hairline pl-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-need">{step.label}</p>
              <p className="mt-1 text-sand">{step.detail}</p>
              {step.policy ? <p className="mt-1 text-xs text-mute">{step.policy}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}

      {typeof report.associatedRevenue === "number" ? (
        <p className="mt-4 text-sand">
          {report.orders} orders · {report.customers} customers · {report.associatedRevenue.toLocaleString("en-US")} DZD
          associated · {Number(report.expectedCash || 0).toLocaleString("en-US")} DZD expected cash timing
        </p>
      ) : null}

      {typeof report.safe === "number" && report.safe + (report.approval || 0) + (report.blocked || 0) > 0 ? (
        <p className="mt-3 text-sand">
          {report.safe} safe · {report.approval || 0} approval · {report.blocked || 0} blocked
          {report.executed ? ` · ${report.executed} executed` : ""}
          {report.verificationPending ? ` · ${report.verificationPending} verifying` : ""}
        </p>
      ) : null}

      {report.simulationUnchanged ? (
        <p className="sim-banner mt-3 rounded-md px-3 py-2 font-mono text-xs uppercase">Simulation — reality unchanged</p>
      ) : null}

      {report.allowedAlternative ? <p className="mt-3 text-sand">{report.allowedAlternative}</p> : null}

      {agent?.approvals
        ?.filter((item) => item.status === "pending" || item.status === "edited")
        .map((approval) => (
          <section key={approval.id} className="mt-5 rounded-md border border-need/40 p-4">
            <PolicyBadge outcome="APPROVAL REQUIRED" />
            <p className="mt-2 text-xl text-paper">{approval.title}</p>
            <p className="mt-2 text-sand">{approval.why}</p>
            {approval.policy ? <p className="mt-1 text-sm text-mute">Policy: {approval.policy}</p> : null}
            <div className="mt-4">
              <ActionBar>
                <Button type="button" disabled={busy} onClick={() => onDecide(agent.runId, approval, "approve")}>
                  Approve
                </Button>
                <Link href="/goals">
                  <Button variant="ghost">Edit</Button>
                </Link>
                <Button type="button" variant="quiet" disabled={busy} onClick={() => onDecide(agent.runId, approval, "reject")}>
                  Reject
                </Button>
              </ActionBar>
            </div>
          </section>
        ))}

      <div className="mt-4 flex flex-wrap gap-2">
        {result.links.map((link) => (
          <Link key={link.href + link.label} href={link.href} className="text-sm text-need">
            {link.label}
          </Link>
        ))}
      </div>
    </article>
  );
}

function phaseLabel(phase: string) {
  if (phase === "INTERPRETING") return "Inspecting business";
  if (phase === "RUNNING_TOOL" || phase === "WAITING_FOR_TOOL") return "Inspecting business";
  if (phase === "EXECUTING") return "Executing safe action";
  if (phase === "VERIFYING") return "Verifying";
  if (phase === "WAITING_FOR_APPROVAL") return "Waiting for approval";
  if (phase === "COMPLETE") return "COMPLETE";
  if (phase === "FAILED") return "FAILED";
  if (phase === "CANCELLED") return "CANCELLED";
  return phase.replaceAll("_", " ");
}
