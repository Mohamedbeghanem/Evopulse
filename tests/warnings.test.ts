import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DEMO_NOW_ISO } from "../lib/clock";
import { all, getDb, one, run } from "../lib/db";
import { assessBuffer } from "../lib/engine/warnings/buffer";
import {
  buildGoalContext,
  businessTwin,
  comingNext,
  evaluateEarlyWarnings,
  getWarningView,
} from "../lib/engine/warnings";
import {
  ORDER_A_DEADLINE_ISO,
  ORDER_B_DEADLINE_ISO,
  ORDER_C_DEADLINE_ISO,
  SHIPMENT_PROJECTED_ISO,
} from "../lib/engine/warnings/scenario";
import { dependencyEdges, traverseDependencies } from "../lib/engine/graph";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";
import type { EntityRow, ExceptionRow } from "../lib/types";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-warn-")), "warnings.db");

function payloadOf(db: ReturnType<typeof getDb>, id: string): Record<string, unknown> {
  const row = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [id]);
  return JSON.parse(row?.payload || "{}") as Record<string, unknown>;
}

function writePayload(db: ReturnType<typeof getDb>, id: string, payload: Record<string, unknown>) {
  run(db, "UPDATE entities SET payload = ? WHERE id = ?", [JSON.stringify(payload), id]);
}

function restoreCanonical(db: ReturnType<typeof getDb>) {
  run(db, "DELETE FROM exceptions WHERE warning_id IS NOT NULL");
  const shipment = payloadOf(db, IDS.shipment);
  shipment.projectedArrival = SHIPMENT_PROJECTED_ISO;
  writePayload(db, IDS.shipment, shipment);
  for (const [id, deadline] of [
    [IDS.orderA, ORDER_A_DEADLINE_ISO],
    [IDS.orderB, ORDER_B_DEADLINE_ISO],
    [IDS.orderC, ORDER_C_DEADLINE_ISO],
  ] as const) {
    const body = payloadOf(db, id);
    body.deadline = deadline;
    writePayload(db, id, body);
  }
  evaluateEarlyWarnings(db, DEMO_NOW_ISO);
}

describe("early warnings", { concurrency: 1 }, () => {
  it("marks a 14h available / 18h required buffer as AT_RISK with a 4h shortfall", () => {
    const result = assessBuffer(14, 18);
    assert.equal(result.state, "AT_RISK");
    assert.equal(result.shortfallHours, 4);
    assert.equal(result.highRisk, true);
  });

  it("does not raise a high-risk warning when available time exceeds required time", () => {
    const comfortable = assessBuffer(40, 18);
    assert.equal(comfortable.highRisk, false);
    assert.equal(comfortable.state, "SAFE");
    const thin = assessBuffer(19, 18);
    assert.equal(thin.highRisk, false);
    assert.notEqual(thin.state, "AT_RISK");

    const db = getDb();
    restoreCanonical(db);
    const shipment = payloadOf(db, IDS.shipment);
    shipment.projectedArrival = "2026-09-30T12:00:00+01:00";
    writePayload(db, IDS.shipment, shipment);
    const views = evaluateEarlyWarnings(db, DEMO_NOW_ISO);
    const delivery = views.find((warning) => warning.id === IDS.warnDelivery);
    assert.equal(delivery?.status, "RESOLVED");
    assert.equal(
      views.some((warning) => warning.status === "ACTIVE" && warning.kind === "delivery_shortfall" && warning.bufferState === "AT_RISK"),
      false,
    );
    restoreCanonical(db);
  });

  it("groups the shipment delay as one downstream warning with the graph path", () => {
    const db = getDb();
    restoreCanonical(db);
    const warning = getWarningView(db, IDS.warnDelivery);
    assert.ok(warning);
    assert.equal(warning?.status, "ACTIVE");
    assert.equal(warning?.bufferState, "AT_RISK");
    assert.ok(Math.abs((warning?.shortfallHours || 0) - 4) < 0.01);
    assert.equal(warning?.valueAmount, 850000);
    assert.equal(warning?.cashAmount, 540000);

    const byLabel = Object.fromEntries(warning!.children.map((child) => [child.label, child.state]));
    assert.deepEqual(byLabel, { "Order A": "AT_RISK", "Order B": "TIGHT", "Order C": "SAFE" });
    const deliveryRows = all<{ id: string }>(db, "SELECT id FROM warnings WHERE kind = 'delivery_shortfall'");
    assert.equal(deliveryRows.length, 1);

    const traversed = traverseDependencies(dependencyEdges(db), IDS.shipment, { maxDepth: 6 });
    const orderA = traversed.find((node) => node.id === IDS.orderA);
    assert.ok(orderA);
    assert.deepEqual(warning?.evidence.path.map((hop) => hop.id), orderA?.path);
    assert.equal(warning?.evidence.eventType, EVENT_TYPES.SHIPMENT_DELAYED);

    const missed = all<ExceptionRow>(db, "SELECT * FROM exceptions WHERE warning_id = ?", [IDS.warnDelivery]);
    assert.equal(missed.length, 0);
    assert.equal(warning?.failed, false);
  });

  it("propagates a later shipment delay into the same warning", () => {
    const db = getDb();
    restoreCanonical(db);
    eventsFor(db).append({
      type: EVENT_TYPES.SHIPMENT_DELAYED,
      source: "supplier",
      source_id: "delay-plus",
      actor_id: IDS.supplier,
      entity_type: "shipment",
      entity_id: IDS.shipment,
      payload: { projectedArrival: "2026-10-02T02:00:00+01:00", quote: "Another four hours late." },
      occurred_at: "2026-09-27T09:00:00+01:00",
      received_at: DEMO_NOW_ISO,
      confidence: 0.9,
    });
    const warning = getWarningView(db, IDS.warnDelivery);
    assert.equal(warning?.status, "ACTIVE");
    assert.ok((warning?.shortfallHours || 0) > 4);
    assert.ok(warning?.evidence.path.some((hop) => hop.id === IDS.orderA));
    restoreCanonical(db);
  });

  it("transitions the warning into an exception only after the deadline", () => {
    const db = getDb();
    restoreCanonical(db);
    const before = all<ExceptionRow>(db, "SELECT * FROM exceptions WHERE warning_id = ?", [IDS.warnDelivery]);
    assert.equal(before.length, 0);

    const crossed = "2026-10-01T20:00:00+01:00";
    const views = evaluateEarlyWarnings(db, crossed);
    const warning = views.find((item) => item.id === IDS.warnDelivery);
    assert.equal(warning?.status, "TRANSITIONED");
    assert.equal(warning?.failed, true);
    assert.match(warning?.explanation || "", /exception/i);
    assert.equal(comingNext(views).some((item) => item.id === IDS.warnDelivery), false);

    const created = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [warning?.exceptionId || ""]);
    assert.ok(created);
    assert.equal(created?.warning_id, IDS.warnDelivery);
    assert.equal(created?.kind, "delivery_missed");
    assert.equal(warning?.exceptionId, created?.id);
    assert.notEqual(created?.status, "resolved");

    const again = evaluateEarlyWarnings(db, crossed);
    const duplicates = all<ExceptionRow>(db, "SELECT * FROM exceptions WHERE warning_id = ?", [IDS.warnDelivery]);
    assert.equal(duplicates.length, 1);
    assert.equal(again.find((item) => item.id === IDS.warnDelivery)?.status, "TRANSITIONED");

    restoreCanonical(db);
    const restored = getWarningView(db, IDS.warnDelivery);
    assert.equal(restored?.status, "ACTIVE");
    assert.equal(all<ExceptionRow>(db, "SELECT * FROM exceptions WHERE warning_id = ?", [IDS.warnDelivery]).length, 0);
  });

  it("resolves the warning when the shipment moves back inside the deadlines", () => {
    const db = getDb();
    restoreCanonical(db);
    const shipment = payloadOf(db, IDS.shipment);
    shipment.projectedArrival = "2026-10-01T18:00:00+01:00";
    writePayload(db, IDS.shipment, shipment);
    const views = evaluateEarlyWarnings(db, DEMO_NOW_ISO);
    const warning = views.find((item) => item.id === IDS.warnDelivery);
    assert.equal(warning?.status, "RESOLVED");
    assert.match(warning?.explanation || "", /resolved/i);
    assert.equal(comingNext(views).some((item) => item.id === IDS.warnDelivery), false);
    restoreCanonical(db);
  });

  it("stops traversal at max depth and does not revisit a cycle", () => {
    const chain = Array.from({ length: 10 }, (_, index) => ({
      from_id: `n${index + 1}`,
      to_id: `n${index}`,
    }));
    const limited = traverseDependencies(chain, "n0", { maxDepth: 3 });
    assert.equal(Math.max(...limited.map((node) => node.depth)), 3);
    assert.equal(limited.some((node) => node.id === "n4"), false);

    const cycle = traverseDependencies(
      [
        { from_id: "a", to_id: "b" },
        { from_id: "b", to_id: "a" },
      ],
      "b",
      { maxDepth: 6 },
    );
    assert.deepEqual(cycle.map((node) => node.id).sort(), ["a", "b"]);
  });

  it("keeps an unrelated event off the shipment warning and feeds goal context", () => {
    const db = getDb();
    restoreCanonical(db);
    const before = one<{ updated_at: string }>(db, "SELECT updated_at FROM warnings WHERE id = ?", [IDS.warnDelivery]);
    evaluateEarlyWarnings(db, DEMO_NOW_ISO, { startId: IDS.commitOurs });
    const after = one<{ updated_at: string }>(db, "SELECT updated_at FROM warnings WHERE id = ?", [IDS.warnDelivery]);
    assert.equal(after?.updated_at, before?.updated_at);

    const goal = buildGoalContext(db, DEMO_NOW_ISO);
    assert.match(goal.goal, /Protect everything at risk/);
    assert.ok(goal.exceptions.some((exception) => exception.id === IDS.excMissed));
    assert.ok(goal.earlyWarnings.some((warning) => warning.id === IDS.warnDelivery));
    assert.ok(goal.earlyWarnings.some((warning) => warning.id === IDS.warnInactivity));

    const twin = businessTwin(evaluateEarlyWarnings(db, DEMO_NOW_ISO));
    assert.equal(twin.operations.status, "AT RISK");
    assert.match(twin.operations.line, /1 dependency approaching failure/);
    assert.equal(twin.customers.status, "MONITORING");
    assert.match(twin.customers.line, /2 commitments/);
    assert.equal(twin.cash.status, "MONITORING");
    assert.match(twin.cash.line, /540K/);
  });

  it("preserves warning id on an action so learning can join the chain later", () => {
    const db = getDb();
    restoreCanonical(db);
    eventsFor(db).append({
      type: EVENT_TYPES.ACTION_EXECUTED,
      source: "test",
      source_id: "act_warn_link",
      entity_type: "action",
      entity_id: "act_warn_link",
      payload: { warningId: IDS.warnDelivery, type: "draft_message" },
      occurred_at: DEMO_NOW_ISO,
      received_at: DEMO_NOW_ISO,
      confidence: 1,
    });
    const warning = getWarningView(db, IDS.warnDelivery);
    assert.equal(warning?.learning.warningId, IDS.warnDelivery);
    assert.equal(warning?.learning.action_id, "act_warn_link");
    assert.equal(warning?.learning.verification_id, null);
    assert.equal(warning?.learning.problem_type, "delivery_shortfall");
  });
});
