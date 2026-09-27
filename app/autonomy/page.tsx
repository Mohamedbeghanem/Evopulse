import { EmergencyPauseControl, AutonomyActionControls } from "@/components/AutonomyControls";
import { Badge } from "@/components/Badge";
import { LEVEL_DESCRIPTIONS, LEVEL_NAMES, annotatePlanActions, autonomyOverview, type AutonomyLevel } from "@/lib/autonomy";
import { all, getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";
import type { ActionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const CEILING_TONE: Record<string, string> = {
  none: "text-mute",
  policy: "text-ice",
  financial: "text-need",
  prohibited: "text-miss",
};

export default function AutonomyPage() {
  const db = getDb();
  const { pause, profiles, changes } = autonomyOverview(db);
  const planActions = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ? ORDER BY created_at, rowid", [
    IDS.planRecovery,
  ]);
  const playbook = planActions.length ? annotatePlanActions(db, planActions) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-mute">Adaptive autonomy</p>
          <h1 className="mt-2 font-serif text-4xl sm:text-5xl">Earned control</h1>
          <p className="mt-3 max-w-2xl text-sand">
            EvoPulse earns autonomy one action type at a time, from verified outcomes. More authority needs a human
            approval. Poor results take authority away automatically. Company policy is always the hard ceiling.
          </p>
        </div>
        <EmergencyPauseControl paused={pause.paused} />
      </div>

      {pause.paused ? (
        <p className="rounded-2xl border border-miss/30 bg-miss/10 p-4 text-sm text-miss">
          Emergency pause is on ({pause.reason} · {pause.by}). Every action is at Level 0 Observe until a human
          resumes.
        </p>
      ) : null}

      <ol className="space-y-3">
        {profiles.map((p) => (
          <li key={p.actionType} className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-mute">{p.actionType}</p>
                <h2 className="mt-1 font-serif text-2xl">{p.label}</h2>
                <p className="mt-1 text-sm text-paper">
                  Level {p.effectiveLevel} — {p.effectiveLevelName}
                  {p.effectiveLevel !== p.level ? (
                    <span className="text-mute"> (earned L{p.level} {p.levelName})</span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-sand">{p.evidenceText}</p>
                <p className={`mt-1 text-xs ${CEILING_TONE[p.ceiling.kind] || "text-mute"}`}>
                  {p.ceiling.label} · max L{p.ceiling.level} · {p.ceiling.policyReason}
                </p>
                {p.suspended ? <p className="mt-1 text-xs text-miss">Suspended: {p.suspendedReason}</p> : null}
                {p.candidateLevel !== null && !p.suspended ? (
                  <p className="mt-1 text-xs text-need">
                    Promotion candidate: evidence supports L{p.candidateLevel} {LEVEL_NAMES[p.candidateLevel]}. Level
                    unchanged until a human approves.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  {p.suspended ? <Badge>SUSPENDED</Badge> : null}
                  <Badge>{`L${p.effectiveLevel}`}</Badge>
                </div>
                <AutonomyActionControls
                  actionType={p.actionType}
                  candidateLevel={p.candidateLevel}
                  candidateName={p.candidateLevel !== null ? LEVEL_NAMES[p.candidateLevel] : null}
                  suspended={p.suspended}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-mute">
              {LEVEL_DESCRIPTIONS[p.effectiveLevel as AutonomyLevel]} Override rate{" "}
              {Math.round(p.evidence.overrideRate * 100)}% · last change: {p.lastChange.kind || "—"} by{" "}
              {p.lastChange.by || "—"}
            </p>
          </li>
        ))}
      </ol>

      {playbook ? (
        <section className="rounded-2xl border border-white/10 p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Playbook steps · Atlas recovery plan</p>
          <p className="mt-2 text-sm text-sand">Each step gets its own autonomy. One plan can run one step and hold another.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {playbook.steps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {s.title} <span className="font-mono text-xs text-mute">({s.type})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-mute">{s.autonomy.reason}</span>
                  <Badge>{s.autonomy.mayAutoExecute ? "AUTO" : s.autonomy.blocked ? "BLOCKED" : "APPROVAL_REQUIRED"}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/10 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-mute">Autonomy audit trail</p>
        <ul className="mt-3 space-y-1 text-xs">
          {changes.map((c) => (
            <li key={c.id} className="font-mono text-sand">
              {c.created_at.slice(0, 16).replace("T", " ")} · {c.kind} · {c.action_type} ·{" "}
              {c.from_level ?? "—"}→{c.to_level ?? "—"} · {c.actor} · <span className="text-mute">{c.reason}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
