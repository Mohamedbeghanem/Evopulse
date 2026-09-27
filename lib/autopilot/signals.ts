import type { BusinessEvent } from "../events";
import type { Signal } from "./types";

/**
 * Sources that are EvoPulse itself talking (engines writing their own results back to the stream).
 * They are not "events understood" — they are the understanding.
 */
export const SYSTEM_EVENT_SOURCES = new Set([
  "pulse-engine",
  "action-engine",
  "verification-engine",
  "outcome-ledger",
  "policy-engine",
  "impact-engine",
  "recovery-engine",
  "feedback-engine",
  "autopilot",
]);

export function isInboundEvent(event: Pick<BusinessEvent, "source">): boolean {
  return !SYSTEM_EVENT_SOURCES.has(event.source);
}

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v || 0));

type SignalRule = (event: BusinessEvent) => Signal | null;

/**
 * Deterministic event → signal rules. One entry per event type that can carry an anomaly.
 * Any type not listed here is routine and classifies NORMAL.
 */
export const SIGNAL_RULES: Record<string, SignalRule> = {
  "inventory.low": (e) => {
    const sku = str(e.payload.sku, "item");
    return {
      kind: "inventory_low",
      title: `${sku} below reorder point`,
      risk: "low",
      impactValue: num(e.payload.reorderValue),
      expected: `On hand ≥ ${num(e.payload.reorderPoint)}`,
      actual: `On hand ${num(e.payload.onHand)}`,
      actions: [
        {
          type: "create_task",
          title: `Raise internal reorder request for ${sku}`,
          description: `Internal purchase request for ${sku}. Reversible — procurement can cancel before PO.`,
          payload: { internal: true, sku, quantity: num(e.payload.reorderPoint) * 2 },
        },
      ],
    };
  },
  "task.overdue": (e) => {
    const task = str(e.payload.task, "task");
    return {
      kind: "task_overdue",
      title: `Internal task overdue — ${task}`,
      risk: "low",
      impactValue: 0,
      expected: `Done by ${str(e.payload.dueAt, "due date")}`,
      actual: "Still open",
      actions: [
        {
          type: "create_task",
          title: `Reschedule and reassign: ${task}`,
          description: `Move to tomorrow 10:00 and notify ${str(e.payload.owner, "owner")} internally.`,
          payload: { internal: true, task, owner: e.payload.owner ?? null },
        },
      ],
    };
  },
  "invoice.mismatch": (e) => {
    const invoice = str(e.payload.invoice, "invoice");
    const delta = num(e.payload.delta);
    return {
      kind: "invoice_mismatch",
      title: `${invoice} total differs from order by ${delta.toLocaleString("en-US")} DZD`,
      risk: "low",
      impactValue: delta,
      expected: "Invoice total equals order total",
      actual: `Off by ${delta.toLocaleString("en-US")} DZD (rounding / line-item)`,
      actions: [
        {
          type: "create_task",
          title: `Queue internal correction for ${invoice}`,
          description: "Finance reviews the line items before the invoice goes out. Internal only.",
          payload: { internal: true, invoice, delta },
        },
      ],
    };
  },
  "payment.at_risk": (e) => ({
    kind: "payment_watch",
    title: `${str(e.payload.customer, "Customer")} payment due ${str(e.payload.dueLabel, "soon")} — not yet confirmed`,
    risk: "low",
    impactValue: num(e.payload.amount),
    expected: `Payment ${num(e.payload.amount).toLocaleString("en-US")} DZD by ${str(e.payload.dueLabel, "due date")}`,
    actual: "No bank confirmation yet",
    actions: [],
  }),
  "delivery.eta_changed": (e) => ({
    kind: "delivery_watch",
    title: `${str(e.payload.order, "Order")} carrier ETA slipped ${num(e.payload.deltaHours)}h — still same day`,
    risk: "low",
    impactValue: 0,
    expected: str(e.payload.originalEta),
    actual: str(e.payload.newEta),
    actions: [],
  }),
  "customer.request": (e) => {
    const customer = str(e.payload.customer, "Customer");
    return {
      kind: "customer_request",
      title: `${customer} asks: ${str(e.payload.request, "change")}`,
      risk: "medium",
      impactValue: num(e.payload.orderValue),
      expected: "Order ships as scheduled",
      actual: str(e.payload.text),
      actions: [
        {
          type: "draft_message",
          title: `Draft reply to ${customer}`,
          description: str(e.payload.proposedReply, "Confirm the change."),
          payload: { to: customer, audience: "customer", body: str(e.payload.proposedReply) },
        },
      ],
    };
  },
};

export function readSignal(event: BusinessEvent): Signal | null {
  if (!isInboundEvent(event)) return null;
  const rule = SIGNAL_RULES[event.type];
  return rule ? rule(event) : null;
}
