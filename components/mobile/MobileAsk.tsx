"use client";

import { useState } from "react";
import { HUMAN_ROUTES } from "@/lib/mobile/routes";

const PROMPTS = ["What needs me?", "Why is 850K at risk?", "What if it is another 3 days late?", "Give the customer 10%."];

type AskReply = {
  answer?: string;
  summary?: string;
  error?: string;
  warnings?: string[];
  evidence?: { statement: string; sourceSystem?: string }[];
  approvalRequired?: boolean;
};

export function MobileAsk({ initial = "" }: { initial?: string }) {
  const [question, setQuestion] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<AskReply | null>(null);
  const [asked, setAsked] = useState("");

  async function ask(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    setAsked(message);
    try {
      const res = await fetch(HUMAN_ROUTES.ask(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = (await res.json().catch(() => ({}))) as AskReply;
      setReply(res.ok ? data : { error: data.error || "Ask failed." });
    } catch {
      setReply({ error: "You are offline. Ask needs a connection." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
        className="flex gap-2"
      >
        <label htmlFor="m-ask-input" className="sr-only">
          Ask EvoPulse
        </label>
        <input
          id="m-ask-input"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your business"
          className="min-h-[48px] min-w-0 flex-1 rounded-lg border border-hairline bg-ink-800 px-3 text-base text-paper placeholder:text-mute"
        />
        <button
          type="submit"
          disabled={busy}
          className="min-h-[48px] rounded-lg bg-need px-4 font-medium text-ink-950 disabled:opacity-60"
        >
          {busy ? "…" : "Ask"}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => {
              setQuestion(prompt);
              void ask(prompt);
            }}
            className="min-h-[40px] rounded-full border border-hairline px-3 text-sm text-sand"
          >
            {prompt}
          </button>
        ))}
      </div>
      {reply ? (
        <section className="rounded-xl border border-hairline bg-ink-800 p-4" aria-live="polite" data-testid="m-answer">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{asked}</p>
          <p className="mt-2 whitespace-pre-line text-paper">{reply.error || reply.answer || reply.summary}</p>
          {reply.evidence?.length ? (
            <ul className="mt-3 space-y-2 text-sm text-sand">
              {reply.evidence.slice(0, 4).map((row) => (
                <li key={row.statement} className="border-l-2 border-hairline pl-3">
                  {row.statement}
                  {row.sourceSystem ? <span className="block text-[11px] uppercase text-mute">{row.sourceSystem}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {reply.warnings?.length ? (
            <ul className="mt-2 space-y-1 text-xs text-mute">
              {reply.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-3 text-xs text-mute">
            {reply.approvalRequired
              ? "Something is waiting for your approval. Approve it on the situation — Ask never approves."
              : "Approvals still happen on the situation, by you."}
          </p>
        </section>
      ) : null}
    </div>
  );
}
