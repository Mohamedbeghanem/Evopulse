import type { DatabaseSync } from "node:sqlite";

export type OutboundIntent = "send_proposal" | "notify_customer" | "contact_supplier";
export type OutboundChannel = "email" | "whatsapp";

export type OutboundDraft = {
  /** Deterministic: `${actionId}:${recipientId}`. */
  id: string;
  actionId: string;
  actionType: string;
  exceptionId: string;
  intent: OutboundIntent;
  channel: OutboundChannel;
  toEntityId: string | null;
  toName: string;
  toAddress: string | null;
  subject: string;
  body: string;
};

export type OutboundMessage = OutboundDraft & {
  draftId: string;
  provider: string;
  external: boolean;
  status: "recorded_local" | "sent";
  approvedBy: string;
  recordedAt: string;
};

/**
 * Outbound connector interface. Small on purpose so it can be registered in the connectors
 * registry (lib/connectors/*) once that lands: a connector only has to implement `deliver`.
 */
export interface OutboundProvider {
  id: string;
  label: string;
  /** False for providers that never leave this workspace (the local outbox). */
  external: boolean;
  deliver(db: DatabaseSync, draft: OutboundDraft, approvedBy: string): { status: OutboundMessage["status"] };
}
