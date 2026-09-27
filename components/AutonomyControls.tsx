"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Who approves is decided on the server: the signed-in person, or the fixed demo human on the public demo.
 * The browser never sends an actor name.
 */
export function ApproverField() {
  return <p className="text-xs text-mute">Changes are recorded under your signed-in account (demo: “Demo operator”).</p>;
}

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return res.ok ? null : data.error || "Request failed";
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const err = await post(path, body);
    setBusy(false);
    if (err) setError(err);
    else router.refresh();
  }
  return { busy, error, run };
}

/** Per-action human controls. Promotion appears only for evidence-backed candidates. */
export function AutonomyActionControls({
  actionType,
  candidateLevel,
  candidateName,
  suspended,
}: {
  actionType: string;
  candidateLevel: number | null;
  candidateName: string | null;
  suspended: boolean;
}) {
  const { busy, error, run } = useAction();
  const base = `/api/autonomy/${encodeURIComponent(actionType)}`;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {candidateLevel !== null && !suspended ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(`${base}/promote`, { toLevel: candidateLevel })}
            className="rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-need disabled:opacity-50"
          >
            Approve promotion → L{candidateLevel} {candidateName}
          </button>
        ) : null}
        {suspended ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(`${base}/reinstate`, {})}
            className="rounded-full border border-ok/40 px-3 py-1.5 text-xs text-ok disabled:opacity-50"
          >
            Reinstate
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(`${base}/suspend`, { reason: "Suspended from the autonomy page." })}
            className="rounded-full border border-miss/40 px-3 py-1.5 text-xs text-miss disabled:opacity-50"
          >
            Suspend
          </button>
        )}
      </div>
      {error ? <p className="max-w-xs text-right text-xs text-miss">{error}</p> : null}
    </div>
  );
}

export function EmergencyPauseControl({ paused }: { paused: boolean }) {
  const { busy, error, run } = useAction();
  return (
    <div className="space-y-2">
      {paused ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run("/api/autonomy/resume", { reason: "Resumed from the autonomy page." })}
          className="rounded-full bg-paper px-5 py-2.5 text-sm font-medium text-ink-950 disabled:opacity-50"
        >
          Resume earned autonomy
        </button>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => run("/api/autonomy/pause", { reason: "Emergency pause from the autonomy page." })}
          className="rounded-full bg-miss px-5 py-2.5 text-sm font-medium text-ink-950 disabled:opacity-50"
        >
          Emergency pause
        </button>
      )}
      {error ? <p className="text-sm text-miss">{error}</p> : null}
    </div>
  );
}
