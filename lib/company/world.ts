import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { EVENT_TYPES, eventsFor } from "../events";
import { graphFor } from "../graph";
import { IDS } from "../ids";

const CREATED = "2026-09-14T10:00:00+01:00";

/** Extra distribution entities. None sit on Atlas Supply → SH-204 → RK-7. */
export const WORLD = {
  supplierMed: "ent_medequip",
  supplierSahara: "ent_sahara",
  productMonitors: "ent_product_pm4",
  productVent: "ent_product_vx2",
  productKits: "ent_product_kit",
  customers: [
    "ent_cust_d",
    "ent_cust_e",
    "ent_cust_f",
    "ent_cust_g",
    "ent_cust_h",
    "ent_cust_i",
    "ent_cust_j",
    "ent_cust_k",
    "ent_cust_l",
  ],
  orders: ["ent_order_d", "ent_order_e", "ent_order_f", "ent_order_g", "ent_order_h"],
  invoices: ["ent_inv_d", "ent_inv_e", "ent_inv_f"],
} as const;

function run(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
  db.prepare(sql).run(...params);
}

/**
 * Completes the hackathon distribution world on top of the canonical Atlas graph.
 * Extra orders/invoices must not descend from SH-204 or the 850K / 540K impact changes.
 */
export function expandDistributionWorld(db: DatabaseSync) {
  const graph = graphFor(db);
  const events = eventsFor(db);

  const entities: [string, string, string, Record<string, unknown>][] = [
    [WORLD.supplierMed, "supplier", "MedEquip Import", { city: "Algiers", role: "imaging and monitors" }],
    [WORLD.supplierSahara, "supplier", "Sahara Logistics", { city: "Algiers", role: "inbound freight" }],
    [WORLD.productMonitors, "product", "Patient monitor PM-4", { sku: "PM-4", inventory: 8 }],
    [WORLD.productVent, "product", "Ventilator VX-2", { sku: "VX-2", inventory: 2 }],
    [WORLD.productKits, "product", "Field kit FK-1", { sku: "FK-1", inventory: 40 }],
    [WORLD.customers[0], "customer", "CHU Mustapha", { city: "Algiers" }],
    [WORLD.customers[1], "customer", "Blida Hospital", { city: "Blida" }],
    [WORLD.customers[2], "customer", "Tizi Ouzou Pharmacy", { city: "Tizi Ouzou" }],
    [WORLD.customers[3], "customer", "Annaba Clinic", { city: "Annaba" }],
    [WORLD.customers[4], "customer", "Bejaia Lab", { city: "Béjaïa" }],
    [WORLD.customers[5], "customer", "Tipaza Medical", { city: "Tipaza" }],
    [WORLD.customers[6], "customer", "Boumerdes Care", { city: "Boumerdès" }],
    [WORLD.customers[7], "customer", "Relizane Health", { city: "Relizane" }],
    [WORLD.customers[8], "customer", "Mostaganem Hospital", { city: "Mostaganem" }],
    [
      WORLD.orders[0],
      "order",
      "Order D — CHU Mustapha monitors",
      { amount: 190000, currency: "DZD", dueAt: "2026-10-10T17:00:00+01:00", status: "active" },
    ],
    [
      WORLD.orders[1],
      "order",
      "Order E — Blida Hospital ventilators",
      { amount: 210000, currency: "DZD", dueAt: "2026-10-14T17:00:00+01:00", status: "active" },
    ],
    [
      WORLD.orders[2],
      "order",
      "Order F — Tizi Pharmacy kits",
      { amount: 85000, currency: "DZD", dueAt: "2026-10-08T17:00:00+01:00", status: "active" },
    ],
    [
      WORLD.orders[3],
      "order",
      "Order G — Annaba Clinic beds",
      { amount: 140000, currency: "DZD", dueAt: "2026-10-16T17:00:00+01:00", status: "active" },
    ],
    [
      WORLD.orders[4],
      "order",
      "Order H — Bejaia Lab reagents",
      { amount: 95000, currency: "DZD", dueAt: "2026-10-12T17:00:00+01:00", status: "active" },
    ],
    [WORLD.invoices[0], "invoice", "Invoice D", { amount: 190000, currency: "DZD", dueAt: "2026-10-20T17:00:00+01:00" }],
    [WORLD.invoices[1], "invoice", "Invoice E", { amount: 210000, currency: "DZD", dueAt: "2026-10-22T17:00:00+01:00" }],
    [WORLD.invoices[2], "invoice", "Invoice F", { amount: 85000, currency: "DZD", dueAt: "2026-10-18T17:00:00+01:00" }],
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
      metadata: { ...payload, name, scenario: "distribution-world" },
    });
  }

  graph.upsertNode({
    id: IDS.company,
    type: "company",
    entity_id: IDS.company,
    label: "Atlas Medical Distribution",
    metadata: { city: "Algiers", sector: "medical-equipment-distribution" },
  });

  const edges: [string, string, string, string][] = [
    ["ge_med_pm4", WORLD.supplierMed, WORLD.productMonitors, "supplies"],
    ["ge_med_vx2", WORLD.supplierMed, WORLD.productVent, "supplies"],
    ["ge_sah_kit", WORLD.supplierSahara, WORLD.productKits, "supplies"],
    ["ge_pm4_od", WORLD.productMonitors, WORLD.orders[0], "required_by"],
    ["ge_vx2_oe", WORLD.productVent, WORLD.orders[1], "required_by"],
    ["ge_kit_of", WORLD.productKits, WORLD.orders[2], "required_by"],
    ["ge_kit_og", WORLD.productKits, WORLD.orders[3], "required_by"],
    ["ge_pm4_oh", WORLD.productMonitors, WORLD.orders[4], "required_by"],
    ["ge_od_cd", WORLD.orders[0], WORLD.customers[0], "belongs_to"],
    ["ge_oe_ce", WORLD.orders[1], WORLD.customers[1], "belongs_to"],
    ["ge_of_cf", WORLD.orders[2], WORLD.customers[2], "belongs_to"],
    ["ge_og_cg", WORLD.orders[3], WORLD.customers[3], "belongs_to"],
    ["ge_oh_ch", WORLD.orders[4], WORLD.customers[4], "belongs_to"],
    ["ge_od_id", WORLD.orders[0], WORLD.invoices[0], "produces"],
    ["ge_oe_ie", WORLD.orders[1], WORLD.invoices[1], "produces"],
    ["ge_of_if", WORLD.orders[2], WORLD.invoices[2], "produces"],
    ["ge_co_med", IDS.company, WORLD.supplierMed, "buys_from"],
    ["ge_co_sah", IDS.company, WORLD.supplierSahara, "buys_from"],
    ["ge_co_atlas", IDS.company, IDS.supplier, "buys_from"],
  ];
  for (const [id, source, target, relationship] of edges) {
    graph.upsertEdge({ id, source_node_id: source, target_node_id: target, relationship, confidence: 1 });
  }

  const extraOrders: [string, string, number, string][] = [
    [WORLD.orders[0], "Order D — CHU Mustapha monitors", 190000, WORLD.customers[0]],
    [WORLD.orders[1], "Order E — Blida Hospital ventilators", 210000, WORLD.customers[1]],
    [WORLD.orders[2], "Order F — Tizi Pharmacy kits", 85000, WORLD.customers[2]],
    [WORLD.orders[3], "Order G — Annaba Clinic beds", 140000, WORLD.customers[3]],
    [WORLD.orders[4], "Order H — Bejaia Lab reagents", 95000, WORLD.customers[4]],
  ];
  for (const [orderId, name, amount, customerId] of extraOrders) {
    events.append({
      id: `evt_${orderId}`,
      type: EVENT_TYPES.ORDER_CREATED,
      source: "seed",
      source_id: orderId,
      actor_id: IDS.company,
      entity_type: "order",
      entity_id: orderId,
      payload: { name, amount, currency: "DZD", customerId },
      occurred_at: CREATED,
      received_at: CREATED,
      confidence: 1,
      idempotent: true,
    });
  }

  const extraInvoices: [string, number][] = [
    [WORLD.invoices[0], 190000],
    [WORLD.invoices[1], 210000],
    [WORLD.invoices[2], 85000],
  ];
  for (const [invoiceId, amount] of extraInvoices) {
    events.append({
      id: `evt_${invoiceId}`,
      type: EVENT_TYPES.PAYMENT_EXPECTED,
      source: "seed",
      source_id: invoiceId,
      actor_id: IDS.company,
      entity_type: "invoice",
      entity_id: invoiceId,
      payload: { amount, currency: "DZD" },
      occurred_at: CREATED,
      received_at: CREATED,
      confidence: 1,
      idempotent: true,
    });
  }
}

export function countEntities(db: DatabaseSync, type: string): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM entities WHERE type = ?").get(type) as { c: number };
  return row.c;
}

export function companyCensus(db: DatabaseSync) {
  return {
    company: countEntities(db, "company"),
    suppliers: countEntities(db, "supplier"),
    customers: countEntities(db, "customer"),
    orders: countEntities(db, "order"),
    invoices: countEntities(db, "invoice"),
    commitments: (db.prepare("SELECT COUNT(*) AS c FROM commitments").get() as { c: number }).c,
  };
}
