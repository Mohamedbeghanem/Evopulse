import type { DatabaseSync } from "node:sqlite";
import { all, getMeta, run } from "../db";
import type { OutboundDraft, OutboundMessage, OutboundProvider } from "./types";

export function ensureOutboxSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS outbound_messages (
      id TEXT PRIMARY KEY,
      draft_id TEXT NOT NULL UNIQUE,
      action_id TEXT NOT NULL,
      exception_id TEXT NOT NULL DEFAULT '',
      intent TEXT NOT NULL,
      channel TEXT NOT NULL,
      provider TEXT NOT NULL,
      external INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      to_entity_id TEXT,
      to_name TEXT NOT NULL,
      to_address TEXT,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      approved_by TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);
}

export function wipeOutbox(db: DatabaseSync) {
  ensureOutboxSchema(db);
  db.exec("DELETE FROM outbound_messages");
}

/** Default provider: records the message locally. Nothing leaves the workspace. */
export const localOutboxProvider: OutboundProvider = {
  id: "local-outbox",
  label: "Local outbox — not sent externally",
  external: false,
  deliver(db, draft, approvedBy) {
    ensureOutboxSchema(db);
    run(
      db,
      `INSERT INTO outbound_messages (id, draft_id, action_id, exception_id, intent, channel, provider, external, status,
         to_entity_id, to_name, to_address, subject, body, approved_by, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'recorded_local', ?, ?, ?, ?, ?, ?, ?)`,
      [
        `out_${draft.id}`,
        draft.id,
        draft.actionId,
        draft.exceptionId,
        draft.intent,
        draft.channel,
        this.id,
        draft.toEntityId,
        draft.toName,
        draft.toAddress,
        draft.subject,
        draft.body,
        approvedBy,
        getMeta(db, "demo_now") || new Date().toISOString(),
      ],
    );
    return { status: "recorded_local" };
  },
};

type OutboxRow = {
  draft_id: string;
  action_id: string;
  exception_id: string;
  intent: string;
  channel: string;
  provider: string;
  external: number;
  status: string;
  to_entity_id: string | null;
  to_name: string;
  to_address: string | null;
  subject: string;
  body: string;
  approved_by: string;
  recorded_at: string;
};

export function listOutbox(db: DatabaseSync): OutboundMessage[] {
  ensureOutboxSchema(db);
  return all<OutboxRow>(db, "SELECT * FROM outbound_messages ORDER BY recorded_at DESC, rowid DESC").map(toMessage);
}

export function outboxEntry(db: DatabaseSync, draftId: string): OutboundMessage | null {
  ensureOutboxSchema(db);
  const row = all<OutboxRow>(db, "SELECT * FROM outbound_messages WHERE draft_id = ?", [draftId])[0];
  return row ? toMessage(row) : null;
}

function toMessage(row: OutboxRow): OutboundMessage {
  return {
    id: row.draft_id,
    draftId: row.draft_id,
    actionId: row.action_id,
    actionType: "",
    exceptionId: row.exception_id,
    intent: row.intent as OutboundDraft["intent"],
    channel: row.channel as OutboundDraft["channel"],
    toEntityId: row.to_entity_id,
    toName: row.to_name,
    toAddress: row.to_address,
    subject: row.subject,
    body: row.body,
    provider: row.provider,
    external: row.external === 1,
    status: row.status as OutboundMessage["status"],
    approvedBy: row.approved_by,
    recordedAt: row.recorded_at,
  };
}
