"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

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
    if (busy) return;
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
    setMessage("Feedback recorded. It does not change live strategy defaults. It is not an approval.");
    router.refresh();
  }

  return (
    <div className="mt-8 rounded-md border border-hairline bg-ink-800 p-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">Operator feedback</p>
      <p className="mt-1 text-xs text-sand">
        ACCEPT · EDIT · REJECT — corrections are stored, not applied globally. This is not an approve path.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          disabled={busy}
          aria-busy={busy}
          aria-label="Accept recommended strategy"
          onClick={() => void submit("ACCEPT")}
        >
          {busy && decision === "ACCEPT" ? "Recording accept…" : "Accept strategy"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          aria-busy={busy}
          aria-label="Edit recommended strategy"
          onClick={() => setDecision("EDIT")}
        >
          Edit strategy
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={busy}
          aria-busy={busy}
          aria-label="Reject recommended strategy"
          onClick={() => void submit("REJECT")}
        >
          {busy && decision === "REJECT" ? "Recording reject…" : "Reject strategy"}
        </Button>
      </div>
      {decision === "EDIT" ? (
        <div className="mt-3 space-y-2">
          <label className="block text-xs text-mute" htmlFor="strategy-select">
            Replacement strategy
          </label>
          <select
            id="strategy-select"
            value={finalStrategy}
            onChange={(e) => setFinalStrategy(e.target.value)}
            disabled={busy}
            className="min-h-11 w-full rounded-md border border-hairline bg-ink-950 px-4 py-2.5 text-sm text-paper"
          >
            {STRATEGIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <label className="block text-xs text-mute" htmlFor="correction-reason">
            Why this correction?
          </label>
          <input
            id="correction-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
            placeholder="Why this correction?"
            className="min-h-11 w-full rounded-md border border-hairline bg-ink-950 px-4 py-2.5 text-sm text-paper"
          />
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            aria-busy={busy}
            aria-label="Record strategy correction"
            onClick={() => void submit("EDIT")}
          >
            {busy ? "Recording correction…" : "Record correction"}
          </Button>
        </div>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-sand" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
