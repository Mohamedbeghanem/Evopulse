import type { DatabaseSync } from "node:sqlite";
import { audit, one } from "../db";
import { getOutboundAdapter, outboundConfigured } from "../connectors/outbound";
import { recheckActionPolicy } from "../engine/policy";
import type { ActionRow } from "../types";
import { listDrafts } from "./drafts";
import { listOutbox, outboxEntry, recordOutbound } from "./outbox";

export type { OutboundDraft, OutboundMessage } from "./types";
export { listDrafts, draftsForAction } from "./drafts";
export { listOutbox, wipeOutbox } from "./outbox";

export class OutboundError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Default delivery: the connectors registry's local outbox. Nothing leaves the workspace. */
export const DEFAULT_OUTBOUND_ADAPTER = "local-outbox";
const EXTERNAL_ADAPTERS = new Set(["whatsapp"]);

/** Agent/AI actors can draft but never approve a send. */
const NON_HUMAN_ACTOR = /^(agent|ai|pulse|system|autopilot|planner|model|deepseek|openrouter|llm)\b|[:_-](agent|ai|bot)$/i;

export function isHumanActor(actor: unknown): actor is string {
  return typeof actor === "string" && actor.trim().length > 0 && !NON_HUMAN_ACTOR.test(actor.trim());
}

export function outboundView(db: DatabaseSync) {
  const sent = new Set(listOutbox(db).map((message) => message.draftId));
  return {
    provider: { id: DEFAULT_OUTBOUND_ADAPTER, label: "Local outbox — not sent externally", external: false },
    drafts: listDrafts(db).filter((draft) => !sent.has(draft.id)),
    outbox: listOutbox(db),
  };
}

/**
 * Human approval of one draft. Never called automatically. Rechecks policy on the source action
 * immediately before delivery, then hands the message to a connectors outbound adapter
 * (default: local outbox — recorded, not sent externally).
 */
export async function approveAndSendDraft(
  db: DatabaseSync,
  draftId: string,
  actor: unknown,
  options: { workspaceId?: string; adapterId?: string } = {},
) {
  if (!isHumanActor(actor)) {
    throw new OutboundError("A person must approve a send. Agents can draft messages but cannot approve them.", 403);
  }
  const existing = outboxEntry(db, draftId);
  if (existing) return { message: existing, duplicate: true };
  const draft = listDrafts(db).find((item) => item.id === draftId);
  if (!draft) throw new OutboundError("Draft not found, or its action has not been approved yet.", 404);
  const action = one<ActionRow>(db, "SELECT * FROM actions WHERE id = ?", [draft.actionId]);
  if (!action) throw new OutboundError("Source action not found.", 404);
  const rechecked = recheckActionPolicy(db, action);
  if (rechecked.policy_outcome === "BLOCKED") {
    throw new OutboundError(`Policy blocks this send: ${rechecked.policy_reason}`, 409);
  }
  const adapterId = options.adapterId || DEFAULT_OUTBOUND_ADAPTER;
  const ctx = { db, workspaceId: options.workspaceId || "demo" };
  const adapter = getOutboundAdapter(adapterId);
  if (!adapter || !outboundConfigured(ctx, adapterId)) {
    throw new OutboundError(`Outbound channel "${adapterId}" is not connected.`, 409);
  }
  const result = await adapter.send(ctx, {
    actionId: draft.actionId,
    channel: adapter.channel,
    to: draft.toAddress || draft.toName,
    body: `${draft.subject}\n\n${draft.body}`,
  });
  if (!result.ok) throw new OutboundError(result.detail || "Delivery failed.", 502);
  const external = EXTERNAL_ADAPTERS.has(adapterId);
  recordOutbound(db, draft, { provider: adapterId, external, approvedBy: actor.trim(), providerRef: result.providerRef || null });
  audit(db, actor.trim(), "outbound.approved", "action", draft.actionId, { draftId, provider: adapterId, external, to: draft.toName });
  return { message: outboxEntry(db, draftId)!, duplicate: false };
}
