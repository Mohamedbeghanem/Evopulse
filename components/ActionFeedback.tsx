"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STRATEGIES = [
  { value: "personalized_followup", label: "Personalized follow-up" },
  { value: "generic_followup", label: "Generic follow-up" },
  { value: "call_first", label: "Call first" },
];

export function ActionFeedback({
  actionId,
  originalStrategy,
}: {
  actionId: string;
  originalStrategy: string;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<"ACCEPT" | "EDIT" | "REJECT" | null>(null);
  const [finalStrategy, setFinalStrategy] = useState("personalized_followup");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(next: "ACCEPT" | "EDIT" | "REJECT") {
    setBusy(true);
    setMessage(null);
    const res = await fetch(`/api/actions/${actionId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: next,
        original_strategy: originalStrategy,
        final_strategy: next === "EDIT" ? finalStrategy : originalStrategy,
        reason,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error || "Could not record feedback");
      return;
    }
    setDecision(next);
    setMessage("Feedback recorded. It does not change live strategy defaults.");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-ink-900/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Operator feedback</p>
      <p className="mt-1 text-xs text-sand">ACCEPT · EDIT · REJECT — corrections are stored, not applied globally.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("ACCEPT")}
          className="rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-50"
        >
          Accept
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setDecision("EDIT")}
          className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-paper disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit("REJECT")}
          className="rounded-full border border-miss/40 px-3 py-1.5 text-xs text-miss disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      {decision === "EDIT" ? (
        <div className="mt-3 space-y-2">
          <select
            value={finalStrategy}
            onChange={(e) => setFinalStrategy(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-paper"
          >
            {STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this correction?"
            className="w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-paper"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => submit("EDIT")}
            className="rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-50"
          >
            Record correction
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-2 text-xs text-sand">{message}</p> : null}
    </div>
  );
}
