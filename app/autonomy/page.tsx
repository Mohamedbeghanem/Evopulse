import { ApproverField, AutonomyActionControls, EmergencyPauseControl } from "@/components/AutonomyControls";
import { LEVEL_DESCRIPTIONS, LEVEL_NAMES, annotatePlanActions, autonomyOverview, type AutonomyLevel } from "@/lib/autonomy";
import { all, getDb } from "@/lib/db";
import { IDS } from "@/lib/ids";
import type { ActionRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const CEILING_TONE: Record<string, string> = {
  none: "text-[#5C6B73]",
  policy: "text-[#0F4C5C]",
  financial: "text-[#EC6025]",
  prohibited: "text-[#B42318]",
};

export default function AutonomyPage() {
  const db = getDb();
  const { pause, profiles, changes } = autonomyOverview(db);
  const planActions = all<ActionRow>(db, "SELECT * FROM actions WHERE plan_id = ? ORDER BY created_at, rowid", [
    IDS.planRecovery,
  ]);
  const playbook = planActions.length ? annotatePlanActions(db, planActions) : null;

  return (
    <div className="space-y-8 bg-[#F7F8F5] font-[Inter,ui-sans-serif,system-ui,sans-serif] text-[#0D1B24]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Adaptive autonomy</p>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight">Earned control</h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[#5C6B73]">
            EvoPulse earns autonomy one action type at a time, from verified outcomes. More authority needs a human
            approval. Poor results take authority away automatically. Company policy is always the hard ceiling.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <ApproverField />
          <EmergencyPauseControl paused={pause.paused} />
        </div>
      </div>

      <p className="text-xs text-[#5C6B73]">
        Automatic suspension is triggered by severe-failure outcomes; live wiring lands with the autopilot
        integration.
      </p>

      {pause.paused ? (
        <p className="rounded-[14px] border border-[#B42318]/30 bg-[#FDECEC] p-4 text-sm text-[#B42318]">
          Emergency pause is on ({pause.reason} · {pause.by}). Every action is at Level 0 Observe until a human
          resumes.
        </p>
      ) : null}

      <ol className="space-y-3">
        {profiles.map((p) => (
          <li key={p.actionType} className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-[#5C6B73]">{p.actionType}</p>
                <h2 className="mt-1 text-base font-semibold">{p.label}</h2>
                <p className="mt-1 text-sm">
                  Level {p.effectiveLevel} — {p.effectiveLevelName}
                  {p.effectiveLevel !== p.level ? (
                    <span className="text-[#5C6B73]"> (earned L{p.level} {p.levelName})</span>
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-[#5C6B73]">{p.evidenceText}</p>
                <p className={`mt-1 text-xs ${CEILING_TONE[p.ceiling.kind] || "text-[#5C6B73]"}`}>
                  {p.ceiling.label} · max L{p.ceiling.level} · {p.ceiling.policyReason}
                </p>
                {p.suspended ? <p className="mt-1 text-xs text-[#B42318]">Suspended: {p.suspendedReason}</p> : null}
                {p.candidateLevel !== null && !p.suspended ? (
                  <p className="mt-1 text-xs text-[#B45309]">
                    Promotion candidate: evidence supports L{p.candidateLevel} {LEVEL_NAMES[p.candidateLevel]}. Level
                    unchanged until a human approves.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  {p.suspended ? <Pill tone="bad">SUSPENDED</Pill> : null}
                  <Pill tone={p.effectiveLevel <= 0 ? "bad" : p.effectiveLevel === 1 ? "need" : "ok"}>{`L${p.effectiveLevel}`}</Pill>
                </div>
                <AutonomyActionControls
                  actionType={p.actionType}
                  candidateLevel={p.candidateLevel}
                  candidateName={p.candidateLevel !== null ? LEVEL_NAMES[p.candidateLevel] : null}
                  suspended={p.suspended}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-[#5C6B73]">
              {LEVEL_DESCRIPTIONS[p.effectiveLevel as AutonomyLevel]} Override rate{" "}
              {Math.round(p.evidence.overrideRate * 100)}% · last change: {p.lastChange.kind || "—"} by{" "}
              {p.lastChange.by || "—"}
            </p>
          </li>
        ))}
      </ol>

      {playbook ? (
        <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Playbook steps · Atlas recovery plan</p>
          <p className="mt-2 text-sm text-[#5C6B73]">Each step gets its own autonomy. One plan can run one step and hold another.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {playbook.steps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[#D8DDD6] px-3 py-3">
                <span>
                  {s.title} <span className="font-mono text-xs text-[#5C6B73]">({s.type})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-[#5C6B73]">{s.autonomy.reason}</span>
                  <Pill tone={s.autonomy.mayAutoExecute ? "ok" : s.autonomy.blocked ? "bad" : "need"}>
                    {s.autonomy.mayAutoExecute ? "AUTO" : s.autonomy.blocked ? "BLOCKED" : "APPROVAL_REQUIRED"}
                  </Pill>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-[14px] border border-[#D8DDD6] bg-[#FFFEFB] p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0F4C5C]">Autonomy audit trail</p>
        <ul className="mt-3 space-y-1 text-xs">
          {changes.map((c) => (
            <li key={c.id} className="font-mono text-[#5C6B73]">
              {c.created_at.slice(0, 16).replace("T", " ")} · {c.kind} · {c.action_type} ·{" "}
              {c.from_level ?? "—"}→{c.to_level ?? "—"} · {c.actor} · <span className="text-[#5C6B73]">{c.reason}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Pill({ children, tone }: { children: string; tone: "ok" | "need" | "bad" }) {
  const cls =
    tone === "bad"
      ? "bg-[#FDECEC] text-[#B42318]"
      : tone === "need"
        ? "bg-[#FDE8DC] text-[#B33A0F]"
        : "bg-[#E4F3EA] text-[#1B7A4A]";
  return (
    <span className={`inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold tracking-wide ${cls}`}>
      {children.replaceAll("_", " ")}
    </span>
  );
}
