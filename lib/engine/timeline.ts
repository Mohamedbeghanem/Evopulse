import type { DatabaseSync } from "node:sqlite";
import { parseIso } from "../clock";
import { all, getMeta } from "../db";
import type { EventRow, ExpectationRow } from "../types";

export type TimelineSpot = {
  id: string;
  lane: "PAST" | "NOW" | "FUTURE";
  at: string;
  title: string;
  detail: string;
  tone: "miss" | "need" | "ok" | "ice" | "mute";
  amount?: number;
};

export function buildTimeline(db: DatabaseSync) {
  const now = getMeta(db, "demo_now");
  const nowMs = parseIso(now).getTime();
  const events = all<EventRow>(db, "SELECT * FROM events ORDER BY occurred_at");
  const expectations = all<ExpectationRow>(db, "SELECT * FROM expectations ORDER BY due_at");

  const spots: TimelineSpot[] = [];

  for (const event of events) {
    const payload = JSON.parse(event.payload || "{}") as { text?: string; note?: string };
    spots.push({
      id: event.id,
      lane: parseIso(event.occurred_at).getTime() <= nowMs ? "PAST" : "FUTURE",
      at: event.occurred_at,
      title: labelEvent(event.type),
      detail: payload.text || payload.note || event.type,
      tone: event.type === "time_advanced" ? "miss" : "ice",
    });
  }

  for (const exp of expectations) {
    const due = parseIso(exp.due_at).getTime();
    const lane: TimelineSpot["lane"] = due < nowMs - 36e5 ? "PAST" : due > nowMs + 36e5 ? "FUTURE" : "NOW";
    spots.push({
      id: exp.id,
      lane: exp.status === "MISSED" || exp.status === "BLOCKED" ? (due < nowMs ? "PAST" : "NOW") : lane,
      at: exp.due_at,
      title: `${exp.status.replace("_", " ")} · ${exp.description}`,
      detail: exp.actual || "Awaiting fulfilment",
      tone:
        exp.status === "MISSED" || exp.status === "BLOCKED"
          ? "miss"
          : exp.status === "FULFILLED"
            ? "ok"
            : exp.status === "AT_RISK"
              ? "need"
              : "ice",
      amount: exp.description.includes("320") ? 320000 : undefined,
    });
  }

  const phase = getMeta(db, "demo_phase", "seeded");
  const nowSpot: TimelineSpot =
    phase === "discount_blocked"
      ? {
          id: "now",
          lane: "NOW",
          at: now,
          title: "10% discount BLOCKED",
          detail: "Policy discount_max=5% refused the close. 5% or Net-14 is ready.",
          tone: "miss",
          amount: 320000,
        }
      : phase === "recovered"
        ? {
            id: "now",
            lane: "NOW",
            at: now,
            title: "Recovery executed",
            detail: "Proposal prepared, follow-up drafted, Monday checkpoint planted.",
            tone: "ok",
            amount: 320000,
          }
        : {
            id: "now",
            lane: "NOW",
            at: now,
            title: "320K decision overdue",
            detail: "Atlas Retail — proposal never sent, Friday decision blocked.",
            tone: "need",
            amount: 320000,
          };

  const hasNeedNow = spots.some((s) => s.lane === "NOW" && (s.tone === "need" || s.tone === "miss"));
  if (!hasNeedNow) spots.push(nowSpot);

  spots.sort((a, b) => parseIso(a.at).getTime() - parseIso(b.at).getTime());
  return {
    now,
    past: spots.filter((s) => s.lane === "PAST"),
    nowLane: [nowSpot, ...spots.filter((s) => s.lane === "NOW" && s.id !== "now")],
    future: spots.filter((s) => s.lane === "FUTURE"),
    spots,
  };
}

function labelEvent(type: string) {
  const map: Record<string, string> = {
    message_received: "Customer message",
    time_advanced: "Clock advanced — proposal not sent",
    proposal_prepared: "Proposal prepared",
    message_drafted: "Follow-up drafted",
    checkpoint_created: "Checkpoint planted",
  };
  return map[type] || type;
}
