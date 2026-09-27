"use client";

import type { FormEvent } from "react";
import { Button } from "./primitives";

export function CommandComposer({
  value,
  onChange,
  onSubmit,
  busy,
  placeholder = "Ask your business…",
  suggestions,
  onSuggestion,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  busy?: boolean;
  placeholder?: string;
  suggestions?: readonly string[];
  onSuggestion?: (value: string) => void;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  }

  return (
    <div className="space-y-3">
      {suggestions?.length ? (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSuggestion?.(prompt)}
              className="rounded-md border border-hairline px-3 py-1.5 text-sm text-sand hover:border-need hover:text-paper"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="command-input">
          Command
        </label>
        <input
          id="command-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-14 flex-1 rounded-md border border-hairline bg-ink-800 px-4 py-3 text-paper outline-none focus:border-need"
        />
        <Button type="submit" disabled={busy || !value.trim()} variant="attention">
          {busy ? "Working…" : "Command"}
        </Button>
      </form>
    </div>
  );
}
