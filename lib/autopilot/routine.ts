import type { DatabaseSync } from "node:sqlite";
import { eventsFor, type EventInput } from "../events";

/**
 * Deterministic "business keeps running" stream for the demo seed.
 * Fixed ids, fixed timestamps, no randomness — reseeding yields identical rows.
 * Every event has its own source_id so EventService idempotency never collapses two facts.
 *
 * ROUTINE_EVENT_COUNT routine events + ANOMALY_EVENTS.length low-risk signals.
 * Nothing here hardcodes a headline number: the Pulse counts rows.
 */
export const ROUTINE_EVENT_COUNT = 160;

const CUSTOMERS = [
  "Oran Fresh Market",
  "Constantine Clinic",
  "Sétif Depot",
  "Béjaïa Foods",
  "Tlemcen Textiles",
  "Annaba Pharma",
  "Blida Hardware",
  "Batna Motors",
  "Tizi Ouzou Dairy",
  "Ghardaïa Tiles",
];

const TEAM = ["Samir", "Lina", "Karim", "Nadia"];

const TASKS = [
  "Confirm delivery slot",
  "Update CRM notes",
  "Send delivery note",
  "Check pallet count",
  "Book carrier",
  "Archive signed PO",
];

const MESSAGES = [
  "Thanks — delivery received in good condition.",
  "Can you resend the invoice PDF?",
  "Order confirmed for next week, same quantities.",
  "Payment has been scheduled.",
  "Please add two more racking kits to the next order.",
  "All good on our side, thank you.",
];

const pad = (n: number) => String(n).padStart(2, "0");

function at(dayOfSep: number, hour: number, minute: number) {
  return `2026-09-${pad(dayOfSep)}T${pad(hour)}:${pad(minute)}:00+01:00`;
}

function routineEvent(i: number): EventInput {
  const kind = i % 6;
  const customer = CUSTOMERS[(i * 7) % CUSTOMERS.length];
  const customerId = `ent_rt_cust_${(i * 7) % CUSTOMERS.length}`;
  const day = 14 + Math.floor(i / 13); // 14 → 26 Sep
  const slot = i % 13;
  const when = at(day, 8 + Math.floor((slot * 10) / 13), (i * 17) % 60);
  const amount = 20_000 + ((i * 7919) % 180) * 1_000;
  const orderRef = `O-${1000 + i}`;
  const base = {
    id: `evt_rt_${String(i).padStart(3, "0")}`,
    source_id: `rt_${String(i).padStart(3, "0")}`,
    occurred_at: when,
    received_at: when,
    confidence: 1,
    idempotent: true,
    metadata: { routine: true },
  };
  switch (kind) {
    case 0:
      return {
        ...base,
        type: "order.created",
        source: "erp",
        actor_id: customerId,
        entity_type: "order",
        entity_id: `ent_rt_${orderRef}`,
        payload: { order: orderRef, customer, amount, currency: "DZD" },
      };
    case 1:
      return {
        ...base,
        type: "payment.received",
        source: "bank",
        actor_id: customerId,
        entity_type: "customer",
        entity_id: customerId,
        payload: { customer, amount, currency: "DZD", reference: `PAY-${5000 + i}` },
      };
    case 2:
      return {
        ...base,
        type: "task.completed",
        source: "tasks",
        actor_id: TEAM[i % TEAM.length],
        entity_type: "task",
        entity_id: `ent_rt_task_${i}`,
        payload: { task: `${TASKS[i % TASKS.length]} — ${orderRef}`, owner: TEAM[i % TEAM.length] },
      };
    case 3:
      return {
        ...base,
        type: "message.received",
        source: "inbox",
        actor_id: customerId,
        entity_type: "customer",
        entity_id: customerId,
        payload: { from: customer, text: MESSAGES[i % MESSAGES.length] },
      };
    case 4:
      return {
        ...base,
        type: "delivery.completed",
        source: "logistics",
        actor_id: customerId,
        entity_type: "order",
        entity_id: `ent_rt_${orderRef}`,
        payload: { order: orderRef, customer, onTime: true },
      };
    default:
      return {
        ...base,
        type: "invoice.issued",
        source: "erp",
        actor_id: customerId,
        entity_type: "invoice",
        entity_id: `ent_rt_inv_${i}`,
        payload: { invoice: `INV-${2200 + i}`, customer, amount, currency: "DZD" },
      };
  }
}

/** Low-risk signals mixed into the stream. The autopilot, not the seed, decides what they become. */
export const ANOMALY_EVENTS: EventInput[] = [
  ...[
    ["SB-2 shelf brackets", 4, 10, 18_000, at(25, 9, 10)],
    ["CT-100 cable ties", 30, 100, 6_500, at(25, 14, 40)],
    ["PW-50 pallet wrap", 3, 8, 12_000, at(26, 11, 5)],
  ].map(([sku, onHand, reorderPoint, reorderValue, when], n) => ({
    id: `evt_rt_sig_inv_${n}`,
    type: "inventory.low",
    source: "wms",
    source_id: `rt_sig_inv_${n}`,
    entity_type: "product",
    entity_id: `ent_rt_sku_${n}`,
    payload: { sku, onHand, reorderPoint, reorderValue },
    occurred_at: when as string,
    received_at: when as string,
  })),
  ...[
    ["Update delivery schedule sheet", "Samir", at(25, 17, 0)],
    ["File signed delivery note O-1127", "Lina", at(26, 12, 0)],
    ["Reconcile petty cash", "Karim", at(26, 17, 30)],
  ].map(([task, owner, when], n) => ({
    id: `evt_rt_sig_task_${n}`,
    type: "task.overdue",
    source: "tasks",
    source_id: `rt_sig_task_${n}`,
    actor_id: owner,
    entity_type: "task",
    entity_id: `ent_rt_sig_task_${n}`,
    payload: { task, owner, dueAt: when },
    occurred_at: when,
    received_at: when,
  })),
  ...[
    ["INV-2291", 1_200, at(25, 10, 20)],
    ["INV-2304", 800, at(26, 9, 45)],
    ["INV-2310", 2_400, at(26, 15, 15)],
  ].map(([invoice, delta, when], n) => ({
    id: `evt_rt_sig_invm_${n}`,
    type: "invoice.mismatch",
    source: "erp",
    source_id: `rt_sig_invm_${n}`,
    entity_type: "invoice",
    entity_id: `ent_rt_sig_invm_${n}`,
    payload: { invoice, delta },
    occurred_at: when as string,
    received_at: when as string,
  })),
  {
    id: "evt_rt_sig_pay_0",
    type: "payment.at_risk",
    source: "bank",
    source_id: "rt_sig_pay_0",
    entity_type: "customer",
    entity_id: "ent_rt_cust_3",
    payload: { customer: "Béjaïa Foods", amount: 86_000, dueLabel: "Mon 28 Sep" },
    occurred_at: at(26, 18, 0),
    received_at: at(26, 18, 0),
  },
  {
    id: "evt_rt_sig_eta_0",
    type: "delivery.eta_changed",
    source: "logistics",
    source_id: "rt_sig_eta_0",
    entity_type: "order",
    entity_id: "ent_rt_O-1133",
    payload: { order: "O-1133", deltaHours: 4, originalEta: "Sun 27 Sep 10:00", newEta: "Sun 27 Sep 14:00" },
    occurred_at: at(27, 7, 50),
    received_at: at(27, 7, 50),
  },
  {
    id: "evt_rt_sig_req_0",
    type: "customer.request",
    source: "inbox",
    source_id: "rt_sig_req_0",
    entity_type: "customer",
    entity_id: "ent_rt_cust_4",
    payload: {
      customer: "Tlemcen Textiles",
      request: "move Tuesday delivery to Thursday",
      text: "Can we move Tuesday's delivery to Thursday? Our dock is closed for maintenance.",
      orderValue: 64_000,
      proposedReply:
        "No problem — we have moved your delivery to Thursday 1 Oct, same time window. Reply if you need a different slot.",
    },
    occurred_at: at(26, 16, 20),
    received_at: at(26, 16, 20),
  },
].map((e) => ({ ...e, confidence: 1, idempotent: true, metadata: { routine: true, signal: true } }));

export function seedRoutineActivity(db: DatabaseSync) {
  const events = eventsFor(db);
  for (let i = 0; i < ROUTINE_EVENT_COUNT; i += 1) events.append(routineEvent(i));
  for (const event of ANOMALY_EVENTS) events.append(event);
}
