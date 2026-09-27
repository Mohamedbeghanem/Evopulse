/**
 * Manus run trace storage. Runs themselves are ordinary EvoPulse agent runs (agent_runs, trace
 * steps, tool calls, approvals); this additive table only keeps the plan / thought / tool events the
 * OpenManus loop produces, so the Agent runs page can show them. Created lazily — no engine migration.
 */
import type { DatabaseSync } from "node:sqlite";
import { all, run } from "../../db";
import type { ManusEvent } from "./events";

const ensured = new WeakSet<DatabaseSync>();

export function ensureManusTables(db: DatabaseSync) {
  if (ensured.has(db)) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS manus_run_events (
      run_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      step_index INTEGER,
      agent_step INTEGER,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (run_id, seq)
    );
  `);
  ensured.add(db);
}

export type StoredManusEvent = ManusEvent & { seq: number; createdAt: string };

export function appendManusEvent(db: DatabaseSync, runId: string, seq: number, event: ManusEvent, createdAt: string) {
  ensureManusTables(db);
  run(db, "INSERT INTO manus_run_events (run_id, seq, kind, step_index, agent_step, payload, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    runId,
    seq,
    event.kind,
    event.stepIndex,
    event.agentStep,
    JSON.stringify(event.payload),
    createdAt,
  ]);
}

export function loadManusEvents(db: DatabaseSync, runId: string): StoredManusEvent[] {
  ensureManusTables(db);
  return all<{ seq: number; kind: ManusEvent["kind"]; step_index: number | null; agent_step: number | null; payload: string; created_at: string }>(
    db,
    "SELECT seq, kind, step_index, agent_step, payload, created_at FROM manus_run_events WHERE run_id = ? ORDER BY seq",
    [runId],
  ).map((row) => ({
    seq: row.seq,
    kind: row.kind,
    stepIndex: row.step_index,
    agentStep: row.agent_step,
    payload: safeJson(row.payload),
    createdAt: row.created_at,
  }));
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
