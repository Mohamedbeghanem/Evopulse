"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HUMAN_ROUTES } from "@/lib/mobile/routes";

async function post(url: string) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return { ok: res.ok, error: data.error };
}

/**
 * One-tap human approval for an APPROVAL_REQUIRED action.
 * Same two human routes as the desktop ApproveActionButton: approve (policy recheck) → execute (policy recheck).
 * Never rendered for BLOCKED actions.
 */
export function MobileApprove({ planId, actionId, title }: { planId: string; actionId: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function approve() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const approved = await post(HUMAN_ROUTES.approveAction(planId, actionId));
    if (!approved.ok) {
      setBusy(false);
      setMessage(approved.error || "Could not approve — policy rechecked.");
      router.refresh();
      return;
    }
    const executed = await post(HUMAN_ROUTES.executeAction(actionId));
    setBusy(false);
    setMessage(
      executed.ok
        ? "Approved and executed. Waiting for verification — not handled yet."
        : executed.error || "Approved, but execution failed — policy rechecked.",
    );
    router.refresh();
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        data-testid="m-approve"
        onClick={() => void approve()}
        disabled={busy}
        aria-busy={busy}
        aria-label={`Approve: ${title} — human authorization`}
        className="min-h-[48px] w-full rounded-lg bg-need px-4 text-base font-medium text-ink-950 disabled:opacity-60"
      >
        {busy ? "Approving…" : "Approve"}
      </button>
      {message ? (
        <p className="mt-2 text-sm text-sand" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}

/** Human reject of the prepared external action (autopilot decision → back to NEEDS YOU). */
export function MobileReject({ decisionId }: { decisionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function reject() {
    if (busy) return;
    setBusy(true);
    const result = await post(HUMAN_ROUTES.rejectDecision(decisionId));
    setBusy(false);
    setMessage(result.ok ? "Rejected. Nothing was sent. It stays with you." : result.error || "Could not reject.");
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        data-testid="m-reject"
        onClick={() => void reject()}
        disabled={busy}
        aria-busy={busy}
        className="min-h-[48px] w-full rounded-lg border border-hairline px-4 text-base text-paper disabled:opacity-60"
      >
        {busy ? "Rejecting…" : "Reject"}
      </button>
      {message ? (
        <p className="mt-2 text-sm text-sand" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
