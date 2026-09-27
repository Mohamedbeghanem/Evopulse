import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { IDS } from "../ids";
import { handleLearningEvent, VerificationService } from "../learning";
import { runAutopilot } from "./engine";

export const CUSTOMER_REPLY_EVENT_ID = "evt_msg_proposal_reply";
export const CUSTOMER_REPLY_TEXT =
  "Got the revised proposal, thank you. Reviewing it with finance — you will have our decision Monday.";

/**
 * Demo trigger: Amine replies to the recovery follow-up.
 * Refuses (no event written) when nothing is waiting on a reply, so the reply can never
 * pre-date the action it verifies. Idempotent on (inbox, evt_msg_proposal_reply, customer.replied).
 */
export function receiveCustomerReply(db: DatabaseSync) {
  const now = getMeta(db, "demo_now");
  const pending = VerificationService.for(db).getPendingVerifications(IDS.excMissed);
  const existing = eventsFor(db).getById(CUSTOMER_REPLY_EVENT_ID);
  if (!pending.length && !existing) {
    return {
      ok: false as const,
      note: "No verification is waiting on a customer reply. Approve and execute the recovery first.",
    };
  }
  // Record the pre-reply state first (e.g. MONITORING after an approval made outside the Pulse).
  runAutopilot(db, now);
  const event = eventsFor(db).append({
    id: CUSTOMER_REPLY_EVENT_ID,
    type: EVENT_TYPES.CUSTOMER_REPLIED,
    source: "inbox",
    source_id: CUSTOMER_REPLY_EVENT_ID,
    actor_id: IDS.contact,
    entity_type: "contact",
    entity_id: IDS.contact,
    payload: { text: CUSTOMER_REPLY_TEXT, from: "Amine Khelifi", inReplyTo: IDS.message1 },
    occurred_at: now,
    received_at: now,
    confidence: 0.95,
    idempotent: true,
  });
  handleLearningEvent(db, event);
  const pass = runAutopilot(db, now);
  return { ok: true as const, event, state: pass.exceptionStates[IDS.excMissed] ?? null };
}
