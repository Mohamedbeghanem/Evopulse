import type { DatabaseSync } from "node:sqlite";
import {
  DELIVER_A_ISO,
  SHIP_DELAYED_ISO,
  SHIP_EXPECTED_ISO,
  SUPPLIER_CASCADE_ISO,
  SUPPLIER_MSG_ISO,
} from "../clock";
import { getMeta, one, run, setMeta } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { graphFor } from "../graph";
import { id, IDS } from "../ids";
import type { ExceptionRow, ExpectationRow } from "../types";
import { EarlyWarningEngine, ensureWarningHooks } from "../warnings";
import { calculateGraphImpact } from "./impact";
import { SEED_MESSAGE_SUPPLIER } from "./seed-graph";

export function triggerSupplierDelay(db: DatabaseSync) {
  if (getMeta(db, "supplier_phase", "stable") === "delayed") {
    return summarizeDelay(db);
  }

  const events = eventsFor(db);
  const graph = graphFor(db);

  const message = events.append({
    id: IDS.evtSupplierMsg,
    type: EVENT_TYPES.MESSAGE_RECEIVED,
    source: "supplier-inbox",
    source_id: IDS.supplier,
    actor_id: IDS.supplier,
    entity_type: "supplier",
    entity_id: IDS.supplier,
    payload: { text: SEED_MESSAGE_SUPPLIER, from: "Atlas Supply" },
    occurred_at: SUPPLIER_MSG_ISO,
    received_at: SUPPLIER_MSG_ISO,
    confidence: 1,
    idempotent: true,
  });

  events.append({
    id: IDS.evtShipDelayed,
    type: EVENT_TYPES.SHIPMENT_DELAYED,
    source: "ingest",
    source_id: message.id,
    actor_id: IDS.supplier,
    entity_type: "shipment",
    entity_id: IDS.shipment,
    payload: {
      text: SEED_MESSAGE_SUPPLIER,
      originalExpectedAt: SHIP_EXPECTED_ISO,
      newExpectedAt: SHIP_DELAYED_ISO,
      deltaDays: 2,
      ref: "SH-204",
    },
    occurred_at: SUPPLIER_MSG_ISO,
    received_at: SUPPLIER_MSG_ISO,
    confidence: 0.96,
    idempotent: true,
  });

  const prior = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectShip]);
  const originalDue = prior?.due_at || SHIP_EXPECTED_ISO;
  run(
    db,
    `INSERT INTO expectation_changes
      (id, expectation_id, source_event_id, original_due_at, new_due_at, delta_days, reason, confidence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id("ech"),
      IDS.expectShip,
      IDS.evtShipDelayed,
      originalDue,
      SHIP_DELAYED_ISO,
      2,
      SEED_MESSAGE_SUPPLIER,
      0.96,
      SUPPLIER_MSG_ISO,
    ],
  );
  run(db, "UPDATE expectations SET due_at = ?, expected_at = ?, status = ?, actual = ?, updated_at = ? WHERE id = ?", [
    SHIP_DELAYED_ISO,
    SHIP_DELAYED_ISO,
    "AT_RISK",
    "Supplier moved arrival Monday → Wednesday (+2 days)",
    SUPPLIER_MSG_ISO,
    IDS.expectShip,
  ]);
  run(db, "UPDATE commitments SET deadline = ?, status = ? WHERE id = ?", [
    SHIP_DELAYED_ISO,
    "at_risk",
    IDS.commitShip,
  ]);
  run(db, "UPDATE expectations SET status = ?, actual = ?, updated_at = ? WHERE id = ?", [
    "AT_RISK",
    "Blocked by SH-204 arriving Wednesday — Tuesday delivery at risk",
    SUPPLIER_MSG_ISO,
    IDS.expectDeliverA,
  ]);
  run(db, "UPDATE commitments SET status = ? WHERE id = ?", ["at_risk", IDS.commitDeliverA]);
  run(db, "UPDATE entities SET payload = ? WHERE id = ?", [
    JSON.stringify({
      expectedAt: SHIP_DELAYED_ISO,
      originalExpectedAt: SHIP_EXPECTED_ISO,
      status: "delayed",
      ref: "SH-204",
      deltaDays: 2,
    }),
    IDS.shipment,
  ]);
  graph.upsertNode({
    id: IDS.shipment,
    type: "shipment",
    entity_id: IDS.shipment,
    label: "Shipment SH-204",
    metadata: {
      expectedAt: SHIP_DELAYED_ISO,
      originalExpectedAt: SHIP_EXPECTED_ISO,
      status: "delayed",
      ref: "SH-204",
      deltaDays: 2,
    },
  });
  graph.upsertNode({
    id: IDS.commitDeliverA,
    type: "commitment",
    entity_id: IDS.commitDeliverA,
    label: "Deliver Order A to Oran Fresh Tuesday",
    metadata: { status: "at_risk" },
  });

  const impact = calculateGraphImpact(db, IDS.shipment);
  const evidence = {
    source: "Supplier conversation",
    quote: SEED_MESSAGE_SUPPLIER,
    expected: "Monday 28 Sep 09:00",
    actual: "Wednesday 30 Sep 09:00",
    deal: `${impact.associated_revenue.toLocaleString("en-US")} DZD associated`,
    confidence: 0.96,
    shipmentId: IDS.shipment,
    deltaDays: 2,
    kind: "observed_fact",
  };

  run(
    db,
    `INSERT INTO exceptions
      (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       attention = 'NEEDS_YOU',
       status = 'open',
       impact_json = excluded.impact_json,
       evidence_json = excluded.evidence_json`,
    [
      IDS.excDelay,
      "Supplier delay — SH-204 Monday → Wednesday",
      "delivery_delay",
      IDS.expectShip,
      IDS.shipment,
      "NEEDS_YOU",
      "high",
      "high",
      JSON.stringify({
        customersAffected: impact.affected_customers.length,
        opportunitiesAffected: 0,
        revenueAssociated: impact.associated_revenue,
        currency: "DZD",
        cashTimingAffected: impact.affected_expected_cash > 0,
        affectedExpectedCash: impact.affected_expected_cash,
        urgency: "high",
        notes: impact.notes,
      }),
      JSON.stringify(evidence),
      0.96,
      "open",
      SUPPLIER_CASCADE_ISO,
    ],
  );

  events.append({
    id: IDS.evtExceptionDelay,
    type: EVENT_TYPES.EXCEPTION_CREATED,
    source: "pulse-engine",
    source_id: IDS.excDelay,
    actor_id: IDS.supplier,
    entity_type: "shipment",
    entity_id: IDS.shipment,
    payload: { kind: "delivery_delay", exceptionId: IDS.excDelay, deltaDays: 2 },
    occurred_at: SUPPLIER_CASCADE_ISO,
    received_at: SUPPLIER_CASCADE_ISO,
    confidence: 0.96,
    idempotent: true,
  });

  events.append({
    id: IDS.evtCascade,
    type: "dependency.cascade",
    source: "impact-engine",
    source_id: IDS.shipment,
    actor_id: IDS.supplier,
    entity_type: "shipment",
    entity_id: IDS.shipment,
    payload: {
      note: "Dependency cascade detected",
      affectedOrders: impact.affected_orders.length,
      associatedRevenue: impact.associated_revenue,
      affectedExpectedCash: impact.affected_expected_cash,
    },
    occurred_at: SUPPLIER_CASCADE_ISO,
    received_at: SUPPLIER_CASCADE_ISO,
    confidence: 1,
    idempotent: true,
  });

  const orderEventIds: Record<string, string> = {
    [IDS.orderA]: IDS.evtOrderA,
    [IDS.orderB]: IDS.evtOrderB,
    [IDS.orderC]: IDS.evtOrderC,
  };
  const orderEvents = Object.entries(orderEventIds).map(([orderId, eventId]) => {
    const node = graph.getNode(orderId);
    const raw = node?.metadata.amount;
    const amount = typeof raw === "number" ? raw : Number(raw || 0);
    return [eventId, orderId, amount] as const;
  });
  for (const [eventId, orderId, amount] of orderEvents) {
    events.append({
      id: eventId,
      type: EVENT_TYPES.ORDER_AFFECTED,
      source: "impact-engine",
      source_id: orderId,
      actor_id: IDS.supplier,
      entity_type: "order",
      entity_id: orderId,
      payload: { amount, currency: "DZD", via: "SH-204" },
      occurred_at: SUPPLIER_CASCADE_ISO,
      received_at: SUPPLIER_CASCADE_ISO,
      confidence: 1,
      idempotent: true,
    });
  }

  setMeta(db, "supplier_phase", "delayed");
  setMeta(db, "demo_now", SUPPLIER_CASCADE_ISO);
  ensureWarningHooks(db);
  EarlyWarningEngine.for(db).evaluateEntity(IDS.shipment, SUPPLIER_CASCADE_ISO, IDS.evtShipDelayed);
  return summarizeDelay(db);
}

export function summarizeDelay(db: DatabaseSync) {
  const exception = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [IDS.excDelay]);
  const expectation = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectShip]);
  const change = one<{
    original_due_at: string;
    new_due_at: string;
    delta_days: number;
    reason: string;
    source_event_id: string | null;
    created_at: string;
    confidence: number;
  }>(
    db,
    "SELECT * FROM expectation_changes WHERE expectation_id = ? ORDER BY created_at DESC",
    [IDS.expectShip],
  );
  const impact = calculateGraphImpact(db, IDS.shipment);
  return {
    exception,
    expectation,
    change,
    impact,
    deliveryAtRisk: one(db, "SELECT * FROM commitments WHERE id = ?", [IDS.commitDeliverA]),
    originalExpected: SHIP_EXPECTED_ISO,
    newExpected: SHIP_DELAYED_ISO,
    customerDelivery: DELIVER_A_ISO,
    message: SEED_MESSAGE_SUPPLIER,
  };
}
