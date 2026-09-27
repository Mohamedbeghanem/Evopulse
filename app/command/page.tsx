"use client";

import { useState } from "react";
import { CANNED_PROMPTS } from "@/lib/prompts";

type AskResult = {
  question: string;
  answer: string;
  grounded: boolean;
  citations: { type: string; id: string; title: string }[];
  now: string;
  phase: string;
};

export default function CommandPage() {
  const [question, setQuestion] = useState<string>(CANNED_PROMPTS[0]);
  const [result, setResult] = useState<AskResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    setBusy(true);
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: q }),
    });
    const data = await res.json();
    setResult(data);
    setBusy(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-mute">Ask EvoPulse</p>
        <h1 className="mt-2 font-serif text-5xl">Command</h1>
        <p className="mt-3 max-w-2xl text-sand">
          Answers are grounded in live business state — commitments, exceptions, policies — not a
          generic chat transcript.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CANNED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => {
              setQuestion(prompt);
              void ask(prompt);
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
          void ask(question);
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
          {busy ? "Reading state…" : "Ask"}
        </button>
      </form>

      {result ? (
        <article className="rounded-2xl border border-white/10 bg-ink-800/50 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-need">
            {result.grounded ? "Grounded" : "Ungrounded"} · phase {result.phase}
          </p>
          <p className="mt-4 font-serif text-2xl leading-snug">{result.answer}</p>
          <ul className="mt-5 space-y-1 text-sm text-mute">
            {result.citations.map((c) => (
              <li key={c.id}>
                {c.type} · {c.title}
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <p className="text-sm text-mute">Pick a canned question. Judges should not have to type.</p>
      )}
    </div>
  );
}
