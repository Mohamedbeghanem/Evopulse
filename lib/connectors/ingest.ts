import type { DatabaseSync } from "node:sqlite";
import { all, runWithDb } from "../db";
import { EVENT_TYPES, eventsFor, type BusinessEvent } from "../events";
import { boundedText, looksLikeInstruction, UNTRUSTED_MARKER } from "./data";

export type InboundMessage = {
  source: "email-imap" | "whatsapp-cloud";
  sourceId: string;
  channel: "email" | "whatsapp";
  from: string;
  fromName?: string;
  subject?: string;
  text: string;
  occurredAt: string;
};

function matchParty(db: DatabaseSync, from: string): { type: string; id: string } | null {
  const needle = from.trim().toLowerCase().replace(/^\+/, "");
  if (!needle) return null;
  const rows = all<{ id: string; type: string; payload: string }>(
    db,
    "SELECT id, type, payload FROM entities WHERE type IN ('customer', 'supplier', 'contact')",
  );
  for (const row of rows) {
    try {
      const p = JSON.parse(row.payload) as { email?: string; phone?: string };
      const email = String(p.email || "").toLowerCase();
      const phone = String(p.phone || "").replace(/[^\d]/g, "");
      if ((email && email === needle) || (phone && phone === needle.replace(/[^\d]/g, ""))) return { type: row.type, id: row.id };
    } catch {
      /* ignore bad payloads */
    }
  }
  return null;
}

/**
 * Record an inbound message as a business event. The text is DATA: bounded, tagged untrusted,
 * flagged if it reads like an instruction. It is not routed to the Command Center or the agent as a
 * command, and it does not create commitments on its own.
 */
export function recordInboundMessage(db: DatabaseSync, message: InboundMessage, now = new Date().toISOString()): BusinessEvent {
  const party = matchParty(db, message.from);
  const text = boundedText(message.text, 4000);
  return runWithDb(db, () =>
    eventsFor(db).append({
      type: EVENT_TYPES.MESSAGE_RECEIVED,
      source: message.source,
      source_id: boundedText(message.sourceId, 200),
      actor_id: party?.id || null,
      entity_type: party?.type || null,
      entity_id: party?.id || null,
      payload: {
        channel: message.channel,
        from: boundedText(message.from, 200),
        fromName: message.fromName ? boundedText(message.fromName, 200) : undefined,
        subject: message.subject ? boundedText(message.subject, 300) : undefined,
        text,
        flaggedAsInstruction: looksLikeInstruction(`${message.subject || ""}\n${text}`),
        ...UNTRUSTED_MARKER,
      },
      occurred_at: message.occurredAt,
      received_at: now,
      confidence: 1,
      metadata: { connector: message.source, matchedParty: Boolean(party) },
      idempotent: true,
    }),
  );
}
