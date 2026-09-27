"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type AskResult = {
  answer: string;
  grounded: boolean;
  citations: { type: string; id: string; title: string }[];
};

/** Top-bar question box. Answers come from POST /api/ask (grounded in live state). */
export function AskBar({ placeholder }: { placeholder: string }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setOpen(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not answer");
      setResult(data as AskResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not answer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={wrapper} className="relative min-w-0 flex-1 md:max-w-[380px]">
      <form onSubmit={ask} role="search">
        <label htmlFor={inputId} className="sr-only">
          Ask your business
        </label>
        <input
          id={inputId}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onFocus={() => (result || error ? setOpen(true) : undefined)}
          placeholder={placeholder}
          aria-controls={panelId}
          aria-expanded={open}
          className="h-[34px] w-full min-w-0 rounded-ctl border border-[#232B35] bg-os-panel px-3 text-[13px] text-fg placeholder:text-fg-5 focus:border-os-line-2"
        />
      </form>
      <div
        id={panelId}
        aria-live="polite"
        className={`${open ? "block" : "hidden"} absolute right-0 top-full z-50 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-panel border border-os-line-2 bg-os-panel p-4 shadow-[0_12px_32px_rgba(0,0,0,0.5)]`}
      >
        {busy ? <p className="font-mono text-xs text-fg-4">Reading business state…</p> : null}
        {error ? <p className="text-sm text-miss">{error}</p> : null}
        {result ? (
          <div className="space-y-3">
            <p className={`font-mono text-os-eyebrow uppercase ${result.grounded ? "text-ok" : "text-watch"}`}>
              {result.grounded ? "Grounded in live state" : "Not grounded"}
            </p>
            <p className="text-sm leading-relaxed text-fg">{result.answer}</p>
            {result.citations.length ? (
              <ul className="space-y-1 border-t border-os-hair pt-3 font-mono text-[11px] text-fg-4">
                {result.citations.map((c) => (
                  <li key={`${c.type}-${c.id}`}>
                    {c.type} · {c.title}
                  </li>
                ))}
              </ul>
            ) : null}
            <Link href="/command" className="inline-block text-xs text-risk-fg hover:text-risk-soft">
              Open in Command →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
