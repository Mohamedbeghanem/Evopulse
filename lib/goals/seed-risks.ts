import type { DatabaseSync } from "node:sqlite";
import type { SQLInputValue } from "node:sqlite";
import {
  CASH_DUE_ISO,
  DELIVER_A_ISO,
  DEMO_NOW_ISO,
  SHIP_DELAYED_ISO,
  SHIP_EXPECTED_ISO,
  SUPPLIER_MSG_ISO,
} from "../clock";
import { one } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { IDS } from "../ids";
import type { EntityRow } from "../types";

const SUPPLIER_QUOTE =
  "Your shipment SH-204 will arrive Wednesday instead of Monday.";

function run(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
  db.prepare(sql).run(...params);
}

function entity(db: DatabaseSync, id: string, type: string, name: string, payload: unknown, createdAt: string) {
  run(
    db,
    `INSERT OR IGNORE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, type, name, JSON.stringify(payload), createdAt],
  );
}

export function orderAmountsFromDb(db: DatabaseSync): { orders: number; customers: number; revenue: number; cash: number } {
  const orders = (["ent_order_a", "ent_order_b", "ent_order_c"] as const)
    .map((id) => one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [id]))
    .filter((row): row is EntityRow => Boolean(row));
  const invoices = (["ent_inv_a", "ent_inv_b", "ent_inv_c"] as const)
    .map((id) => one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [id]))
    .filter((row): row is EntityRow => Boolean(row));
  const customers = (["ent_cust_a", "ent_cust_b", "ent_cust_c"] as const)
    .map((id) => one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [id]))
    .filter((row): row is EntityRow => Boolean(row));
  const revenue = orders.reduce((sum, row) => {
    const payload = JSON.parse(row.payload) as { amount?: number };
    return sum + (payload.amount || 0);
  }, 0);
  const cash = invoices.reduce((sum, row) => {
    const payload = JSON.parse(row.payload) as { amount?: number };
    return sum + (payload.amount || 0);
  }, 0);
  return { orders: orders.length, customers: customers.length, revenue, cash };
}

/** Open the supplier cascade using the graph PR trigger when the graph is seeded but still stable. */
export function ensureLiveCascade(db: DatabaseSync) {
  if (!one(db, "SELECT id FROM entities WHERE id = ?", [IDS.shipment])) {
    seedOperationalExposure(db);
    return;
  }
  try {
    const { triggerSupplierDelay } = require("../engine/supplier") as typeof import("../engine/supplier");
    triggerSupplierDelay(db);
  } catch {
    seedOperationalExposure(db);
  }
}

/** Persist the supplier / order / cash exposure using existing entity + exception tables. Not a graph engine. */
export function seedOperationalExposure(db: DatabaseSync) {
  if (one(db, "SELECT id FROM entities WHERE id = ?", [IDS.shipment])) {
    ensureDelayException(db);
    return;
  }

  const now = DEMO_NOW_ISO;

  entity(db, IDS.supplier, "supplier", "Atlas Supply", { city: "Oran" }, "2026-08-01T09:00:00+01:00");
  entity(
    db,
    IDS.shipment,
    "shipment",
    "SH-204",
    { expectedAt: SHIP_EXPECTED_ISO, delayedTo: SHIP_DELAYED_ISO, deltaDays: 2, status: "delayed" },
    "2026-09-20T09:00:00+01:00",
  );
  entity(db, IDS.product, "product", "RK-7 kit", { sku: "RK-7" }, "2026-08-20T09:00:00+01:00");
  entity(db, IDS.customerA, "customer", "Oran Fresh", { city: "Oran" }, "2026-07-02T09:00:00+01:00");
  entity(db, IDS.customerB, "customer", "Constantine Clinic", { city: "Constantine" }, "2026-07-02T09:00:00+01:00");
  entity(db, IDS.customerC, "customer", "Sétif Depot", { city: "Sétif" }, "2026-07-02T09:00:00+01:00");
  entity(
    db,
    IDS.orderA,
    "order",
    "Order A",
    { amount: 320000, currency: "DZD", customerId: IDS.customerA, deliverBy: DELIVER_A_ISO, shipmentId: IDS.shipment },
    "2026-09-18T10:00:00+01:00",
  );
  entity(
    db,
    IDS.orderB,
    "order",
    "Order B",
    { amount: 280000, currency: "DZD", customerId: IDS.customerB, shipmentId: IDS.shipment },
    "2026-09-18T10:05:00+01:00",
  );
  entity(
    db,
    IDS.orderC,
    "order",
    "Order C",
    { amount: 250000, currency: "DZD", customerId: IDS.customerC, shipmentId: IDS.shipment },
    "2026-09-18T10:10:00+01:00",
  );
  entity(db, IDS.invoiceA, "invoice", "Invoice A", { amount: 200000, currency: "DZD", orderId: IDS.orderA, dueAt: CASH_DUE_ISO }, now);
  entity(db, IDS.invoiceB, "invoice", "Invoice B", { amount: 180000, currency: "DZD", orderId: IDS.orderB, dueAt: CASH_DUE_ISO }, now);
  entity(db, IDS.invoiceC, "invoice", "Invoice C", { amount: 160000, currency: "DZD", orderId: IDS.orderC, dueAt: CASH_DUE_ISO }, now);

  const totals = orderAmountsFromDb(db);
  entity(
    db,
    IDS.cashWeek,
    "cash_window",
    "Expected cash this week",
    { amount: totals.cash, currency: "DZD", status: "at_risk", source: "invoices" },
    now,
  );

  insertCommitment(
    db,
    IDS.commitShip,
    "Receive SH-204 Monday",
    SHIP_EXPECTED_ISO,
    "at_risk",
    SUPPLIER_QUOTE,
  );
  insertCommitment(
    db,
    IDS.commitDeliverA,
    "Deliver Order A Tuesday",
    DELIVER_A_ISO,
    "at_risk",
    "Order A delivery depends on SH-204",
  );
  insertCommitment(
    db,
    IDS.commitCash,
    "Collect expected cash this week",
    CASH_DUE_ISO,
    "at_risk",
    "Invoice timing follows delivery",
  );

  insertExpectation(db, IDS.expectShip, IDS.commitShip, "SH-204 received Monday", SHIP_EXPECTED_ISO, "AT_RISK", SUPPLIER_QUOTE);
  insertExpectation(db, IDS.expectDeliverA, IDS.commitDeliverA, "Order A delivered Tuesday", DELIVER_A_ISO, "AT_RISK", "Blocked by SH-204 delay");
  insertExpectation(db, IDS.expectCash, IDS.commitCash, "Expected cash collected this week", CASH_DUE_ISO, "AT_RISK", "Cash timing follows delayed deliveries");

  const deps: [string, string, string, string, string, string][] = [
    ["dep_ship_supplier", IDS.shipment, "shipment", IDS.supplier, "supplier", "SH-204 is supplied by Atlas Supply"],
    ["dep_product_ship", IDS.product, "product", IDS.shipment, "shipment", "RK-7 kit rides on SH-204"],
    ["dep_order_a_product", IDS.orderA, "order", IDS.product, "product", "Order A depends on RK-7"],
    ["dep_order_b_product", IDS.orderB, "order", IDS.product, "product", "Order B depends on RK-7"],
    ["dep_order_c_product", IDS.orderC, "order", IDS.product, "product", "Order C depends on RK-7"],
    ["dep_cust_a_order", IDS.customerA, "customer", IDS.orderA, "order", "Oran Fresh waits on Order A"],
    ["dep_inv_a_order", IDS.invoiceA, "invoice", IDS.orderA, "order", "Invoice A is produced by Order A"],
    ["dep_cash_inv_a", IDS.cashWeek, "cash_window", IDS.invoiceA, "invoice", "Weekly cash includes Invoice A"],
    ["dep_cash_inv_b", IDS.cashWeek, "cash_window", IDS.invoiceB, "invoice", "Weekly cash includes Invoice B"],
    ["dep_cash_inv_c", IDS.cashWeek, "cash_window", IDS.invoiceC, "invoice", "Weekly cash includes Invoice C"],
    ["dep_deliver_a_ship", IDS.expectDeliverA, "expectation", IDS.expectShip, "expectation", "Tuesday delivery depends on Monday receipt"],
    ["dep_cash_deliver", IDS.expectCash, "expectation", IDS.expectDeliverA, "expectation", "Cash timing depends on deliveries"],
  ];
  for (const [id, fromId, fromType, toId, toType, description] of deps) {
    run(
      db,
      `INSERT OR IGNORE INTO dependencies (id, from_id, from_type, to_id, to_type, description) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, fromId, fromType, toId, toType, description],
    );
  }

  const events = eventsFor(db);
  events.append({
    id: "evt_msg_supplier_delay",
    type: EVENT_TYPES.MESSAGE_RECEIVED,
    source: "inbox",
    source_id: IDS.supplier,
    actor_id: IDS.supplier,
    entity_type: "supplier",
    entity_id: IDS.supplier,
    payload: { text: SUPPLIER_QUOTE, from: "Atlas Supply" },
    occurred_at: SUPPLIER_MSG_ISO,
    received_at: now,
    confidence: 1,
    idempotent: true,
  });
  events.append({
    id: "evt_ship_delayed",
    type: EVENT_TYPES.SHIPMENT_DELAYED,
    source: "seed",
    source_id: IDS.shipment,
    actor_id: IDS.supplier,
    entity_type: "shipment",
    entity_id: IDS.shipment,
    payload: { expectedAt: SHIP_EXPECTED_ISO, delayedTo: SHIP_DELAYED_ISO, deltaDays: 2 },
    occurred_at: SUPPLIER_MSG_ISO,
    received_at: now,
    confidence: 1,
    idempotent: true,
  });
  ensureDelayException(db);
}

function insertCommitment(
  db: DatabaseSync,
  id: string,
  description: string,
  deadline: string,
  status: string,
  evidence: string,
) {
  run(
    db,
    `INSERT OR IGNORE INTO commitments
      (id, actor, actor_entity_id, action, description, deadline, status, source_event_id, evidence, confidence, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      "company",
      IDS.company,
      description.toLowerCase().replaceAll(" ", "_"),
      description,
      deadline,
      status,
      null,
      evidence,
      0.95,
      "seed",
      DEMO_NOW_ISO,
    ],
  );
}

function insertExpectation(
  db: DatabaseSync,
  id: string,
  commitmentId: string,
  description: string,
  dueAt: string,
  status: string,
  actual: string,
) {
  run(
    db,
    `INSERT OR IGNORE INTO expectations (id, commitment_id, description, due_at, status, actual, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, commitmentId, description, dueAt, status, actual, DEMO_NOW_ISO, DEMO_NOW_ISO],
  );
}

function ensureDelayException(db: DatabaseSync) {
  if (one(db, "SELECT id FROM exceptions WHERE id = ?", [IDS.excDelay])) return;
  const totals = orderAmountsFromDb(db);
  const impact = {
    customersAffected: totals.customers,
    opportunitiesAffected: 0,
    revenueAssociated: totals.revenue,
    currency: "DZD",
    cashTimingAffected: totals.cash > 0,
    cashTimingAmount: totals.cash,
    affectedOrders: totals.orders,
    urgency: "high",
    notes: `Supplier delay +2 days. ${totals.orders} orders / ${totals.customers} customers. Associated revenue calculated from order amounts. Cash timing calculated from open invoices.`,
  };
  const evidence = {
    source: "Supplier conversation",
    quote: SUPPLIER_QUOTE,
    expected: `SH-204 received ${SHIP_EXPECTED_ISO}`,
    actual: `Supplier moved arrival to ${SHIP_DELAYED_ISO} (+2 days)`,
    deal: `${totals.revenue.toLocaleString("en-US")} DZD`,
    confidence: 0.96,
    path: ["Atlas Supply", "Shipment SH-204", "RK-7 kit", "Order A", "Oran Fresh"],
    kind: "OBSERVED_FACT",
  };
  run(
    db,
    `INSERT OR IGNORE INTO exceptions
      (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.excDelay,
      "Supplier shipment delayed — three customer orders exposed",
      "shipment_delay",
      IDS.expectShip,
      IDS.shipment,
      "NEEDS_YOU",
      "critical",
      "high",
      JSON.stringify(impact),
      JSON.stringify(evidence),
      0.96,
      "open",
      DEMO_NOW_ISO,
    ],
  );
}

export const SUPPLIER_DELAY_QUOTE = SUPPLIER_QUOTE;
