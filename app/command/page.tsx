"use client";

import Link from "next/link";
import { useState } from "react";
import { DEMO_COMMANDS } from "@/lib/prompts";

type CommandResponse = {
  commandId: string;
  intent: string;
  understoodAs: string;
  answerType: string;
  status: string;
  summary: string;
  data: Record<string, unknown>;
  evidence: { statement: string; sourceSystem: string; sourceId?: string }[];
  links: { href: string; label: string }[];
  sourceSystems: string[];
  warnings: string[];
  approvalRequired: boolean;
  session: { id: string; lastIntent: string };
};

export default function CommandPage() {
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [turns, setTurns] = useState<{ message: string; result: CommandResponse }[]>([]);
  const [busy, setBusy] = useState(false);
  const [openEvidence, setOpenEvidence] = useState<string | null>(null);

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
    setSessionId(result.session?.id);
    setTurns((current) => [...current, { message: trimmed, result }]);
    setMessage("");
    setBusy(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Ask EvoPulse</p>
        <h1 className="mt-2 font-serif text-5xl">Command</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Questions go to the business engines. The wording is only the interface. State stays the truth.
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
          placeholder="Ask anything about your business…"
          className="flex-1 rounded-full border border-white/15 bg-ink-800 px-4 py-3 text-paper outline-none focus:border-need"
        />
        <button
          disabled={busy}
          className="rounded-full bg-paper px-5 py-3 text-sm font-medium text-ink-950 disabled:opacity-50"
        >
          {busy ? "Reading state…" : "Ask"}
        </button>
      </form>

      <div className="space-y-4">
        {turns.map((turn) => (
          <article key={turn.result.commandId} className="rounded-2xl border border-white/10 bg-ink-800/40 p-5">
            <p className="text-sm text-mute">{turn.message}</p>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-need">
              {turn.result.answerType} · {turn.result.status}
            </p>
            <h2 className="mt-2 font-serif text-3xl">{turn.result.summary}</h2>
            <ResultBody result={turn.result} />
            <div className="mt-4 flex flex-wrap gap-2">
              {turn.result.links.map((link) => (
                <Link key={link.href + link.label} href={link.href} className="rounded-full border border-white/15 px-3 py-1.5 text-sm">
                  {link.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => setOpenEvidence(openEvidence === turn.result.commandId ? null : turn.result.commandId)}
                className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-sand"
              >
                {openEvidence === turn.result.commandId ? "Hide evidence" : "View evidence"}
              </button>
            </div>
            {openEvidence === turn.result.commandId ? (
              <ul className="mt-4 space-y-2 text-sm text-sand">
                {turn.result.evidence.map((item, index) => (
                  <li key={`${item.sourceId || item.statement}-${index}`}>
                    {item.sourceSystem}
                    {item.sourceId ? ` · ${item.sourceId}` : ""} — {item.statement}
                  </li>
                ))}
                {turn.result.warnings.map((warning) => (
                  <li key={warning} className="text-mute">
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
              {turn.result.sourceSystems.join(" · ") || "no engine"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ResultBody({ result }: { result: CommandResponse }) {
  const data = result.data;
  if (result.answerType === "TIMELINE" && Array.isArray(data.changes)) {
    return (
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-sand">
        {data.changes.map((line) => (
          <li key={String(line)}>{String(line)}</li>
        ))}
      </ol>
    );
  }
  if (result.answerType === "ATTENTION" && Array.isArray(data.items)) {
    return (
      <ul className="mt-4 space-y-2">
        {data.items.map((item) => {
          const row = item as { id: string; kind: string; title: string; detail?: string };
          return (
            <li key={row.id} className="rounded-xl border border-white/10 p-3">
              <p className="font-mono text-[11px] uppercase text-need">{row.kind}</p>
              <p className="mt-1">{row.title}</p>
              {row.detail ? <p className="text-sm text-sand">{row.detail}</p> : null}
            </li>
          );
        })}
      </ul>
    );
  }
  if (result.answerType === "WARNING" && Array.isArray(data.comingNext)) {
    return (
      <ul className="mt-4 space-y-3">
        {data.comingNext.map((item) => {
          const row = item as { id: string; title: string; state: string; available: string; required: string; shortfall: string };
          return (
            <li key={row.id} className="rounded-xl border border-white/10 p-3">
              <p className="font-serif text-2xl">{row.title}</p>
              <p className="text-sm text-need">{row.state}</p>
              <p className="mt-2 font-mono text-xs text-sand">
                Available {row.available} · Required {row.required} · Shortfall {row.shortfall}
              </p>
            </li>
          );
        })}
      </ul>
    );
  }
  if (result.answerType === "CAUSAL_PATH" && Array.isArray(data.path)) {
    return (
      <div className="mt-4 space-y-2">
        {data.path.map((label) => (
          <p key={String(label)} className="font-serif text-xl">
            {String(label)}
          </p>
        ))}
        <p className="text-sand">
          {String(data.orders)} orders · {String(data.customers)} customers · {String(data.associatedRevenue)} associated ·{" "}
          {String(data.expectedCash)} expected cash timing
        </p>
      </div>
    );
  }
  if (result.answerType === "SIMULATION") {
    const delta = data.delta as { headline?: string[] } | undefined;
    return (
      <div className="mt-4 space-y-2 text-sand">
        <p className="font-mono text-xs uppercase text-need">Simulation — not real business state</p>
        {(delta?.headline || []).map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p>Reality unchanged: {String(data.realityUnchanged)}</p>
      </div>
    );
  }
  if (result.answerType === "PLAN") {
    return (
      <p className="mt-4 text-sand">
        {String(data.total ?? "")} actions · {String(data.safe ?? "")} safe · {String(data.approval ?? "")} need approval ·{" "}
        {String(data.blocked ?? "")} blocked
      </p>
    );
  }
  if (result.answerType === "POLICY") {
    return (
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Bucket title="Safe now" items={data.safe} />
        <Bucket title="Requires approval" items={data.approval} />
        <Bucket title="Blocked" items={data.blocked} />
      </div>
    );
  }
  if (result.answerType === "EXECUTION_RESULT") {
    return (
      <p className="mt-4 text-sand">
        Done {Array.isArray(data.executed) ? data.executed.length : 0}. Waiting {Array.isArray(data.waiting) ? data.waiting.length : 0}.
        Blocked {Array.isArray(data.blocked) ? data.blocked.length : 0}.
      </p>
    );
  }
  if (result.answerType === "HISTORICAL_EVIDENCE") {
    return <p className="mt-4 text-sand">{String(data.strongest || data.note || "")}</p>;
  }
  if (result.answerType === "AUDIT_TRACE" && Array.isArray(data.trace)) {
    return (
      <ul className="mt-4 space-y-1 text-sand">
        {data.trace.map((step) => {
          const row = step as { step: string; detail: string };
          return (
            <li key={row.step}>
              {row.step}: {row.detail}
            </li>
          );
        })}
      </ul>
    );
  }
  if (Array.isArray(data.suggestions)) {
    return <p className="mt-4 text-sm text-mute">{data.suggestions.map(String).join(" · ")}</p>;
  }
  return null;
}

function Bucket({ title, items }: { title: string; items: unknown }) {
  const rows = Array.isArray(items) ? (items as { id: string; title: string }[]) : [];
  return (
    <section className="rounded-xl border border-white/10 p-3">
      <p className="font-mono text-[11px] uppercase text-mute">{title}</p>
      <ul className="mt-2 space-y-1 text-sm">
        {rows.map((row) => (
          <li key={row.id}>{row.title}</li>
        ))}
        {rows.length === 0 ? <li className="text-mute">None</li> : null}
      </ul>
    </section>
  );
}
