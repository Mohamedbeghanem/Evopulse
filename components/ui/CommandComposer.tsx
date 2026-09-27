"use client";

import type { FormEvent, KeyboardEvent } from "react";
import { useState } from "react";
import { PulseAgent, type PulseAgentState } from "@/components/agent/PulseAgent";

export function CommandComposer({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder = "Ask EvoPulse anything about your business…",
  suggestions,
  onSuggestion,
  agentState,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  busy?: boolean;
  placeholder?: string;
  suggestions?: readonly string[];
  onSuggestion?: (value: string) => void;
  agentState?: PulseAgentState;
}) {
  const [showAll, setShowAll] = useState(false);
  const shown: PulseAgentState = busy && agentState === undefined ? "INVESTIGATING" : (agentState ?? "IDLE");
  const prompts = suggestions ?? [];
  const visible = showAll ? prompts : prompts.slice(0, 4);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!busy && value.trim()) onSubmit(value.trim());
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!busy && value.trim()) onSubmit(value.trim());
    }
  }

  return (
    <div className="max-w-[760px] space-y-3">
      <form
        onSubmit={handleSubmit}
        className="rounded-[14px] border border-line bg-card px-3 py-3 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex shrink-0 items-center gap-1.5 sm:pb-2">
            <span className="text-[13px] font-medium text-ink">Pulse ·</span>
            <PulseAgent state={shown} />
          </div>
          <label className="sr-only" htmlFor="command-input">
            Command
          </label>
          <textarea
            id="command-input"
            value={value}
            rows={2}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="min-h-[3.25rem] w-full flex-1 resize-none bg-transparent px-1 py-2 text-[15px] text-ink outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-ink px-4 py-2 text-sm font-medium text-card disabled:opacity-50"
          >
            Command
          </button>
        </div>
      </form>
      {visible.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {visible.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSuggestion?.(prompt)}
              className="rounded-full border border-line bg-card px-3 py-1 text-[13px] text-ink hover:border-teal"
            >
              {prompt}
            </button>
          ))}
          {prompts.length > 4 && !showAll ? (
            <button type="button" onClick={() => setShowAll(true)} className="px-2 py-1 text-[13px] text-teal">
              More examples
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
