import type { DatabaseSync } from "node:sqlite";
import { DEMO_NOW_ISO } from "../../clock";
import { one } from "../../db";
import { EVENT_TYPES, eventsFor } from "../../events";
import { IDS } from "../../ids";
import { evaluateEarlyWarnings } from "./evaluate";
import {
  CASH_TIMING_AMOUNT,
  DELIVERY_CONFIDENCE,
  ORDER_A_DEADLINE_ISO,
  ORDER_B_DEADLINE_ISO,
  ORDER_C_DEADLINE_ISO,
  ORDER_VALUES,
  SHIPMENT_DELAY_QUOTE,
  SHIPMENT_PROJECTED_ISO,
} from "./scenario";

function insertEntity(
  db: DatabaseSync,
  id: string,
  type: string,
  name: string,
  payload: Record<string, unknown>,
  createdAt: string,
) {
  db.prepare(
    `INSERT OR REPLACE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, type, name, JSON.stringify(payload), createdAt);
}

function insertDependency(
  db: DatabaseSync,
  id: string,
  fromId: string,
  fromType: string,
  toId: string,
  toType: string,
  description: string,
) {
  db.prepare(
    `INSERT OR REPLACE INTO dependencies (id, from_id, from_type, to_id, to_type, description) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, fromId, fromType, toId, toType, description);
}

/** Supplier → shipment → three orders → one cash timing. One warning, not three alerts. */
export function seedWarningScenario(db: DatabaseSync) {
  const createdAt = "2026-09-20T09:00:00+01:00";
  insertEntity(db, IDS.supplier, "supplier", "Nord Components", { city: "Oran" }, createdAt);
  insertEntity(db, IDS.customerHorizon, "customer", "Horizon Foods", {}, createdAt);
  insertEntity(db, IDS.customerSable, "customer", "Sable Clinic", {}, createdAt);
  insertEntity(
    db,
    IDS.shipment,
    "shipment",
    "Shipment NC-14",
    {
      projectedArrival: SHIPMENT_PROJECTED_ISO,
      supplierId: IDS.supplier,
      quote: SHIPMENT_DELAY_QUOTE,
    },
    createdAt,
  );
  insertEntity(
    db,
    IDS.orderA,
    "order",
    "Order A",
    {
      deadline: ORDER_A_DEADLINE_ISO,
      amount: ORDER_VALUES.A,
      currency: "DZD",
      customer: "Atlas Retail",
      customerId: IDS.company,
    },
    createdAt,
  );
  insertEntity(
    db,
    IDS.orderB,
    "order",
    "Order B",
    {
      deadline: ORDER_B_DEADLINE_ISO,
      amount: ORDER_VALUES.B,
      currency: "DZD",
      customer: "Horizon Foods",
      customerId: IDS.customerHorizon,
    },
    createdAt,
  );
  insertEntity(
    db,
    IDS.orderC,
    "order",
    "Order C",
    {
      deadline: ORDER_C_DEADLINE_ISO,
      amount: ORDER_VALUES.C,
      currency: "DZD",
      customer: "Sable Clinic",
      customerId: IDS.customerSable,
    },
    createdAt,
  );
  insertEntity(
    db,
    IDS.payment540,
    "payment",
    "Expected cash on Order A",
    { amount: CASH_TIMING_AMOUNT, currency: "DZD", orderId: IDS.orderA },
    createdAt,
  );

  insertDependency(db, IDS.depShipSupplier, IDS.shipment, "shipment", IDS.supplier, "supplier", "Shipment depends on Nord Components");
  insertDependency(db, IDS.depOrderA, IDS.orderA, "order", IDS.shipment, "shipment", "Order A delivery depends on shipment NC-14");
  insertDependency(db, IDS.depOrderB, IDS.orderB, "order", IDS.shipment, "shipment", "Order B delivery depends on shipment NC-14");
  insertDependency(db, IDS.depOrderC, IDS.orderC, "order", IDS.shipment, "shipment", "Order C delivery depends on shipment NC-14");
  insertDependency(db, IDS.depPayOrderA, IDS.payment540, "payment", IDS.orderA, "order", "540K cash timing depends on Order A");

  eventsFor(db).append({
    id: IDS.evtShipmentDelayed,
    type: EVENT_TYPES.SHIPMENT_DELAYED,
    source: "supplier",
    source_id: IDS.shipment,
    actor_id: IDS.supplier,
    entity_type: "shipment",
    entity_id: IDS.shipment,
    payload: {
      projectedArrival: SHIPMENT_PROJECTED_ISO,
      quote: SHIPMENT_DELAY_QUOTE,
      previousArrival: "2026-09-28T18:00:00+01:00",
    },
    occurred_at: "2026-09-27T07:40:00+01:00",
    received_at: DEMO_NOW_ISO,
    confidence: DELIVERY_CONFIDENCE,
    idempotent: true,
  });

  evaluateEarlyWarnings(db, DEMO_NOW_ISO);
}

export function ensureWarningScenario(db: DatabaseSync) {
  const existing = one<{ id: string }>(db, "SELECT id FROM entities WHERE id = ?", [IDS.shipment]);
  if (existing) return;
  seedWarningScenario(db);
}
