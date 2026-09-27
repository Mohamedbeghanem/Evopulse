import type { DatabaseSync } from "node:sqlite";
import { one, run } from "../db";
import { id } from "../ids";
import type { CommandIntent } from "./types";

export type CommandSession = {
  id: string;
  lastIntent: CommandIntent | "";
  lastEntityIds: string[];
  lastWarningId: string | null;
  lastExceptionId: string | null;
  lastGoalId: string | null;
  updatedAt: string;
};

type SessionRow = {
  id: string;
  last_intent: string;
  last_entity_ids: string;
  last_warning_id: string | null;
  last_exception_id: string | null;
  last_goal_id: string | null;
  updated_at: string;
};

export function loadSession(db: DatabaseSync, sessionId: string | undefined, now: string): CommandSession {
  if (sessionId) {
    const row = one<SessionRow>(db, "SELECT * FROM command_sessions WHERE id = ?", [sessionId]);
    if (row) return fromRow(row);
  }
  const session: CommandSession = {
    id: id("cse"),
    lastIntent: "",
    lastEntityIds: [],
    lastWarningId: null,
    lastExceptionId: null,
    lastGoalId: null,
    updatedAt: now,
  };
  persist(db, session);
  return session;
}

export function saveSession(db: DatabaseSync, session: CommandSession, now: string) {
  session.updatedAt = now;
  persist(db, session);
}

function persist(db: DatabaseSync, session: CommandSession) {
  run(
    db,
    `INSERT INTO command_sessions
      (id, last_intent, last_entity_ids, last_warning_id, last_exception_id, last_goal_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       last_intent = excluded.last_intent,
       last_entity_ids = excluded.last_entity_ids,
       last_warning_id = excluded.last_warning_id,
       last_exception_id = excluded.last_exception_id,
       last_goal_id = excluded.last_goal_id,
       updated_at = excluded.updated_at`,
    [
      session.id,
      session.lastIntent,
      JSON.stringify(session.lastEntityIds),
      session.lastWarningId,
      session.lastExceptionId,
      session.lastGoalId,
      session.updatedAt,
    ],
  );
}

function fromRow(row: SessionRow): CommandSession {
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(row.last_entity_ids) as unknown;
    if (Array.isArray(parsed)) ids = parsed.filter((item): item is string => typeof item === "string");
  } catch {
    ids = [];
  }
  return {
    id: row.id,
    lastIntent: row.last_intent as CommandIntent | "",
    lastEntityIds: ids,
    lastWarningId: row.last_warning_id,
    lastExceptionId: row.last_exception_id,
    lastGoalId: row.last_goal_id,
    updatedAt: row.updated_at,
  };
}
