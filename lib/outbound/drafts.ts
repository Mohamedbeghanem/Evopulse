import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import type { ActionRow } from "../types";
import type { OutboundChannel, OutboundDraft, OutboundIntent } from "./types";

/** Only actions a human already approved (or that ran) can produce a draft. Proposed/blocked never do. */
const DRAFTABLE_STATUSES = new Set(["approved", "executed"]);

type Entity = { id: string; type: string; name: string; payload: string };

export function listDrafts(db: DatabaseSync): OutboundDraft[] {
  const actions = all<ActionRow>(
    db,
    `SELECT * FROM actions WHERE status IN ('approved', 'executed')
       AND type IN ('prepare_proposal', 'draft_message', 'send_message', 'prepare_customer_notice', 'offer_alternative', 'escalate')
     ORDER BY created_at, id`,
  );
  return actions.flatMap((action) => draftsForAction(db, action));
}

export function draftsForAction(db: DatabaseSync, action: ActionRow): OutboundDraft[] {
  if (!DRAFTABLE_STATUSES.has(action.status)) return [];
  const payload = parse(action.payload);
  const company = one<{ name: string }>(db, "SELECT name FROM entities WHERE type = 'company' ORDER BY created_at LIMIT 1");
  const sender = company?.name || "our team";
  const opportunityContact = contactForException(db, action.exception_id);

  switch (action.type) {
    case "prepare_proposal": {
      if (!opportunityContact) return [];
      const amount = money(payload.amount, payload.currency);
      return [
        draft(action, "send_proposal", opportunityContact, {
          subject: `Revised proposal — ${amount}`,
          body: `Hello ${firstName(opportunityContact.name)},\n\nAs promised, here is the revised proposal (${amount}). We missed the Thursday send you were counting on — that is on us. The decision stays yours; tell me what you need to decide this week.\n\n— ${sender}`,
        }),
      ];
    }
    case "offer_alternative": {
      if (!opportunityContact) return [];
      const terms = typeof payload.terms === "string" ? payload.terms.toUpperCase() : "adjusted terms";
      const days = typeof payload.expediteDays === "number" ? payload.expediteDays : null;
      return [
        draft(action, "send_proposal", opportunityContact, {
          subject: "An alternative to the 10% request",
          body: `Hello ${firstName(opportunityContact.name)},\n\n10% is outside what we are authorized to offer. We can keep the proposal price and move to ${terms}${days ? `, with the installation pulled forward ${days} days` : ""}. Happy to walk through it today.\n\n— ${sender}`,
        }),
      ];
    }
    case "prepare_customer_notice": {
      const ids = Array.isArray(payload.customerIds) ? payload.customerIds.filter((v): v is string => typeof v === "string") : [];
      const days = typeof payload.delayDays === "number" ? payload.delayDays : null;
      return ids.flatMap((customerId) => {
        const customer = entity(db, customerId);
        if (!customer) return [];
        return [
          draft(action, "notify_customer", customer, {
            subject: "Delivery update on your order",
            body: `Hello ${customer.name},\n\nAn inbound shipment for your order is running ${days ? `${days} day${days === 1 ? "" : "s"}` : ""} late. We are prioritizing your delivery and will confirm the new date as soon as it is locked. Reply here if the timing causes a problem.\n\n— ${sender}`.replace("running  late", "running late"),
          }),
        ];
      });
    }
    case "draft_message":
    case "send_message":
    case "escalate": {
      const recipient = recipientFromPayload(db, payload) || opportunityContact;
      if (!recipient) return [];
      const intent: OutboundIntent =
        recipient.type === "supplier" || payload.audience === "supplier"
          ? "contact_supplier"
          : action.exception_id && opportunityContact?.id === recipient.id
            ? "send_proposal"
            : "notify_customer";
      const body = typeof payload.body === "string" && payload.body.trim() ? payload.body.trim() : action.description;
      return [
        draft(action, intent, recipient, {
          subject: typeof payload.subject === "string" && payload.subject ? payload.subject : action.title,
          body: `Hello ${firstName(recipient.name)},\n\n${body}\n\n— ${sender}`,
        }),
      ];
    }
    default:
      return [];
  }
}

function draft(
  action: ActionRow,
  intent: OutboundIntent,
  recipient: Entity,
  content: { subject: string; body: string },
): OutboundDraft {
  const payload = parse(recipient.payload);
  const email = typeof payload.email === "string" ? payload.email : null;
  const phone = typeof payload.phone === "string" ? payload.phone : null;
  const channel: OutboundChannel = !email && phone ? "whatsapp" : "email";
  return {
    id: `${action.id}:${recipient.id}`,
    actionId: action.id,
    actionType: action.type,
    exceptionId: action.exception_id,
    intent,
    channel,
    toEntityId: recipient.id,
    toName: recipient.name,
    toAddress: channel === "email" ? email : phone,
    subject: content.subject,
    body: content.body,
  };
}

function recipientFromPayload(db: DatabaseSync, payload: Record<string, unknown>): Entity | null {
  if (typeof payload.targetEntityId === "string") return entity(db, payload.targetEntityId);
  if (typeof payload.to !== "string" || !payload.to.trim()) return null;
  const matches = all<Entity>(
    db,
    "SELECT id, type, name, payload FROM entities WHERE lower(name) = lower(?) OR lower(name) LIKE lower(?) || ' %'",
    [payload.to.trim(), payload.to.trim()],
  );
  return matches.length === 1 ? matches[0] : null;
}

function contactForException(db: DatabaseSync, exceptionId: string): Entity | null {
  if (!exceptionId) return null;
  const exception = one<{ opportunity_id: string | null }>(db, "SELECT opportunity_id FROM exceptions WHERE id = ?", [exceptionId]);
  const opportunity = exception?.opportunity_id ? entity(db, exception.opportunity_id) : null;
  const contactId = opportunity ? parse(opportunity.payload).contactId : null;
  return typeof contactId === "string" ? entity(db, contactId) : null;
}

function entity(db: DatabaseSync, entityId: string): Entity | null {
  return one<Entity>(db, "SELECT id, type, name, payload FROM entities WHERE id = ?", [entityId]) || null;
}

function firstName(name: string) {
  return name.split(" ")[0] || name;
}

function money(amount: unknown, currency: unknown) {
  const value = typeof amount === "number" ? amount.toLocaleString("en-US") : "the agreed amount";
  return typeof amount === "number" ? `${value} ${typeof currency === "string" ? currency : "DZD"}` : value;
}

function parse(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
