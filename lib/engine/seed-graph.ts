import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { CASH_DUE_ISO, DELIVER_A_ISO, DEMO_NOW_ISO, SHIP_EXPECTED_ISO } from "../clock";
import { EVENT_TYPES, eventsFor } from "../events";
import { graphFor } from "../graph";
import { IDS } from "../ids";
import { upsertExpectation } from "./expectations";

function run(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
  db.prepare(sql).run(...params);
}

const CREATED = "2026-09-12T10:00:00+01:00";

/** Customer delivery deadlines and lead times (days after RK-7 is in stock). Read by the simulator. */
const DELIVER_B_ISO = "2026-10-02T17:00:00+01:00";
const DELIVER_C_ISO = "2026-10-06T17:00:00+01:00";

export const SEED_MESSAGE_SUPPLIER = "Your shipment will arrive Wednesday instead of Monday.";

/** Persisted supplier graph. Amounts live on entities — impact sums them. */
export function seedSupplierGraph(db: DatabaseSync) {
  const graph = graphFor(db);
  const now = DEMO_NOW_ISO;

  const entities: [string, string, string, Record<string, unknown>][] = [
    [IDS.supplier, "supplier", "Atlas Supply", { city: "Algiers", role: "racking supplier" }],
    [
      IDS.shipment,
      "shipment",
      "Shipment SH-204",
      { expectedAt: SHIP_EXPECTED_ISO, status: "expected", ref: "SH-204" },
    ],
    [IDS.product, "product", "Pallet racking kit RK-7", { sku: "RK-7", inventory: 3 }],
    [
      IDS.orderA,
      "order",
      "Order A — Oran Fresh",
      { amount: 320000, currency: "DZD", dueAt: DELIVER_A_ISO, leadDays: 1 },
    ],
    [
      IDS.orderB,
      "order",
      "Order B — Constantine Clinic",
      { amount: 280000, currency: "DZD", dueAt: DELIVER_B_ISO, leadDays: 1 },
    ],
    [
      IDS.orderC,
      "order",
      "Order C — Sétif Depot",
      { amount: 250000, currency: "DZD", dueAt: DELIVER_C_ISO, leadDays: 2 },
    ],
    [IDS.customerA, "customer", "Oran Fresh Market", { city: "Oran" }],
    [IDS.customerB, "customer", "Constantine Clinic", { city: "Constantine" }],
    [IDS.customerC, "customer", "Sétif Depot", { city: "Sétif" }],
    [IDS.invoiceA, "invoice", "Invoice A", { amount: 200000, currency: "DZD", dueAt: CASH_DUE_ISO }],
    [IDS.invoiceB, "invoice", "Invoice B", { amount: 180000, currency: "DZD", dueAt: CASH_DUE_ISO }],
    [IDS.invoiceC, "invoice", "Invoice C", { amount: 160000, currency: "DZD", dueAt: CASH_DUE_ISO }],
    [IDS.cashWeek, "cash", "Expected cash — week of 28 Sep", { amount: 540000, currency: "DZD", dueAt: CASH_DUE_ISO }],
  ];

  for (const [id, type, name, payload] of entities) {
    run(db, `INSERT OR REPLACE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`, [
      id,
      type,
      name,
      JSON.stringify(payload),
      CREATED,
    ]);
    graph.upsertNode({
      id,
      type,
      entity_id: id,
      label: name,
      metadata: { ...payload, name },
    });
  }

  graph.upsertNode({
    id: IDS.opportunity,
    type: "opportunity",
    entity_id: IDS.opportunity,
    label: "Atlas Q4 warehouse fit-out",
    metadata: { amount: 320000, currency: "DZD", scenario: "proposal" },
  });
  graph.upsertNode({
    id: IDS.commitOurs,
    type: "commitment",
    entity_id: IDS.commitOurs,
    label: "Send the revised 320,000 DZD proposal",
    metadata: { scenario: "proposal" },
  });

  const edges: [string, string, string, string][] = [
    ["ge_sup_ship", IDS.supplier, IDS.shipment, "supplies"],
    ["ge_ship_prod", IDS.shipment, IDS.product, "contains"],
    ["ge_prod_oa", IDS.product, IDS.orderA, "required_by"],
    ["ge_prod_ob", IDS.product, IDS.orderB, "required_by"],
    ["ge_prod_oc", IDS.product, IDS.orderC, "required_by"],
    ["ge_oa_ca", IDS.orderA, IDS.customerA, "belongs_to"],
    ["ge_ob_cb", IDS.orderB, IDS.customerB, "belongs_to"],
    ["ge_oc_cc", IDS.orderC, IDS.customerC, "belongs_to"],
    ["ge_oa_ia", IDS.orderA, IDS.invoiceA, "produces"],
    ["ge_ob_ib", IDS.orderB, IDS.invoiceB, "produces"],
    ["ge_oc_ic", IDS.orderC, IDS.invoiceC, "produces"],
    ["ge_ia_cash", IDS.invoiceA, IDS.cashWeek, "expected_payment"],
    ["ge_ib_cash", IDS.invoiceB, IDS.cashWeek, "expected_payment"],
    ["ge_ic_cash", IDS.invoiceC, IDS.cashWeek, "expected_payment"],
    ["ge_ship_cmt", IDS.shipment, IDS.commitShip, "related_to"],
    ["ge_ship_deliver", IDS.shipment, IDS.commitDeliverA, "affects"],
    ["ge_oa_deliver", IDS.orderA, IDS.commitDeliverA, "depends_on"],
  ];
  for (const [id, source, target, relationship] of edges) {
    graph.upsertEdge({ id, source_node_id: source, target_node_id: target, relationship, confidence: 1 });
  }

  run(
    db,
    `INSERT OR REPLACE INTO commitments
      (id, actor, actor_entity_id, action, description, deadline, status, source_event_id, evidence, confidence, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.commitShip,
      "company",
      IDS.supplier,
      "receive_shipment",
      "Receive shipment SH-204 Monday",
      SHIP_EXPECTED_ISO,
      "open",
      IDS.evtShipExpected,
      "Seeded inbound shipment from Atlas Supply",
      0.95,
      "seed",
      CREATED,
    ],
  );
  run(
    db,
    `INSERT OR REPLACE INTO commitments
      (id, actor, actor_entity_id, action, description, deadline, status, source_event_id, evidence, confidence, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.commitDeliverA,
      "company",
      IDS.customerA,
      "deliver_order",
      "Deliver Order A to Oran Fresh Tuesday",
      DELIVER_A_ISO,
      "open",
      null,
      "Customer delivery depends on SH-204 arriving Monday",
      0.91,
      "seed",
      CREATED,
    ],
  );
  graph.upsertNode({
    id: IDS.commitShip,
    type: "commitment",
    entity_id: IDS.commitShip,
    label: "Receive shipment SH-204 Monday",
    metadata: { status: "open" },
  });
  graph.upsertNode({
    id: IDS.commitDeliverA,
    type: "commitment",
    entity_id: IDS.commitDeliverA,
    label: "Deliver Order A to Oran Fresh Tuesday",
    metadata: { status: "open" },
  });

  upsertExpectation(db, {
    id: IDS.expectShip,
    commitment_id: IDS.commitShip,
    description: "Shipment SH-204 arrives Monday",
    due_at: SHIP_EXPECTED_ISO,
    status: "ON_TRACK",
    created_at: CREATED,
    updated_at: now,
    type: "event",
    entity_id: IDS.shipment,
    expected_event: "shipment.arrived",
    expected_at: SHIP_EXPECTED_ISO,
    source_type: "commitment",
    source_id: IDS.commitShip,
    confidence: 0.95,
    condition: { event_type: "shipment.arrived" },
  });
  upsertExpectation(db, {
    id: IDS.expectDeliverA,
    commitment_id: IDS.commitDeliverA,
    description: "Order A delivered to Oran Fresh Tuesday",
    due_at: DELIVER_A_ISO,
    status: "ON_TRACK",
    created_at: CREATED,
    updated_at: now,
    type: "event",
    entity_id: IDS.orderA,
    expected_event: "order.delivered",
    expected_at: DELIVER_A_ISO,
    source_type: "commitment",
    source_id: IDS.commitDeliverA,
    confidence: 0.91,
    condition: { event_type: "order.delivered" },
  });
  // Order A delivery depends on SH-204 arriving, so Pulse re-derives "at risk" when SH-204 is due after Tuesday.
  run(
    db,
    `INSERT OR REPLACE INTO dependencies (id, from_id, from_type, to_id, to_type, description) VALUES (?, ?, ?, ?, ?, ?)`,
    ["dep_deliver_a_on_ship", IDS.expectDeliverA, "expectation", IDS.expectShip, "expectation", "Order A delivery depends on shipment SH-204 arriving"],
  );

  eventsFor(db).append({
    id: IDS.evtShipExpected,
    type: EVENT_TYPES.SHIPMENT_EXPECTED,
    source: "seed",
    source_id: IDS.shipment,
    actor_id: IDS.supplier,
    entity_type: "shipment",
    entity_id: IDS.shipment,
    payload: { expectedAt: SHIP_EXPECTED_ISO, ref: "SH-204" },
    occurred_at: CREATED,
    received_at: CREATED,
    confidence: 0.95,
    idempotent: true,
  });

  run(db, "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ["supplier_phase", "stable"]);
}
