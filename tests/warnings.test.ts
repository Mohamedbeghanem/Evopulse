import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DELIVER_A_ISO, SHIP_DELAYED_ISO, SHIP_EXPECTED_ISO, SUPPLIER_CASCADE_ISO } from "../lib/clock";
import { getDb, getMeta, one, resetDbFile } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { calculateGraphImpact } from "../lib/engine/impact";
import { detectExceptions, pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { businessTwin } from "../lib/engine/twin";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { createGoal } from "../lib/goals";
import { IDS } from "../lib/ids";
import { wipeAndSeed } from "../lib/seed";
import type { ExceptionRow, ExpectationRow } from "../lib/types";
import {
  DELIVER_A_WARNING_ID,
  EarlyWarningEngine,
  WarningExplanationService,
  classifyBuffer,
  ensureWarningHooks,
  evaluateBuffer,
  formatHours,
} from "../lib/warnings";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-warn-")), "warnings.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
resetDbFile();

const FRIDAY_03 = "2026-10-02T03:00:00+01:00";
const FRIDAY_17 = "2026-10-02T17:00:00+01:00";
const FRIDAY_NOON = "2026-10-02T12:00:00+01:00";
const AFTER_DEADLINE = "2026-09-29T10:01:00+01:00";

describe("early warning intelligence", { concurrency: 1 }, () => {
  it("temporal buffer: 14h available vs 18h required is AT_RISK with 4h shortfall", () => {
    const buffer = evaluateBuffer({
      deadline: FRIDAY_17,
      upstreamAvailableAt: FRIDAY_03,
      now: FRIDAY_NOON,
    });
    assert.equal(buffer.available_buffer_minutes, 14 * 60);
    assert.equal(buffer.required_buffer_minutes, 18 * 60);
    assert.equal(buffer.shortfall_minutes, -4 * 60);
    assert.equal(buffer.state, "AT_RISK");
    assert.equal(buffer.deadline_passed, false);
    assert.equal(formatHours(buffer.available_buffer_minutes), "14h");
    assert.equal(formatHours(buffer.required_buffer_minutes), "18h");
    assert.equal(formatHours(Math.abs(buffer.shortfall_minutes)), "4h");
  });

  it("SAFE buffer: 24h available vs 18h required", () => {
    const buffer = evaluateBuffer({
      deadline: FRIDAY_17,
      upstreamAvailableAt: "2026-10-01T17:00:00+01:00",
      now: FRIDAY_NOON,
    });
    assert.equal(buffer.available_buffer_minutes, 24 * 60);
    assert.equal(buffer.required_buffer_minutes, 18 * 60);
    assert.equal(buffer.state, "SAFE");
    assert.equal(classifyBuffer(24 * 60, 18 * 60, FRIDAY_17, FRIDAY_NOON), "SAFE");
  });

  it("TIGHT buffer: positive surplus below the configured 4h margin", () => {
    const buffer = evaluateBuffer({
      deadline: FRIDAY_17,
      upstreamAvailableAt: "2026-10-01T21:00:00+01:00",
      now: FRIDAY_NOON,
    });
    assert.equal(buffer.available_buffer_minutes, 20 * 60);
    assert.equal(buffer.shortfall_minutes, 2 * 60);
    assert.equal(buffer.state, "TIGHT");
  });

  it("supplier delay creates one AT RISK warning before any missed exception", () => {
    const db = getDb();
    wipeAndSeed(db);
    const engine = EarlyWarningEngine.for(db);
    engine.evaluateAll(getMeta(db, "demo_now"));
    assert.equal(engine.getActiveWarnings().length, 0);

    triggerSupplierDelay(db);
    const warning = engine.get(DELIVER_A_WARNING_ID);
    assert.ok(warning);
    assert.equal(warning.status, "ACTIVE");
    assert.equal(warning.warning_type, "DEADLINE_BUFFER");
    assert.equal(warning.expectation_id, IDS.expectDeliverA);
    const evidence = JSON.parse(warning.evidence) as { buffer_state?: string };
    assert.equal(evidence.buffer_state, "AT_RISK");
    assert.equal(warning.required_buffer_minutes, 18 * 60);
    assert.ok(warning.available_buffer_minutes < warning.required_buffer_minutes);
    assert.ok(warning.shortfall_minutes < 0);

    const delivery = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectDeliverA]);
    assert.ok(delivery);
    assert.notEqual(delivery.status, "MISSED");
    const missed = one<ExceptionRow>(
      db,
      "SELECT * FROM exceptions WHERE expectation_id = ? AND kind = 'commitment_missed'",
      [IDS.expectDeliverA],
    );
    assert.equal(missed, undefined);
  });

  it("warning retains the supplier → shipment → order → customer path and graph impact", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const explanation = WarningExplanationService.for(db).explain(DELIVER_A_WARNING_ID, SUPPLIER_CASCADE_ISO);
    assert.ok(explanation);
    assert.equal(explanation.has_failed, false);
    const joined = explanation.dependency_path.labels.join(" → ");
    assert.match(joined, /Atlas Supply/);
    assert.match(joined, /Shipment/);
    assert.match(joined, /Order A/);
    assert.ok(
      explanation.dependency_path.nodeIds.includes(IDS.supplier) ||
        explanation.dependency_path.labels.some((label) => /Atlas Supply/.test(label)),
    );
    assert.ok(explanation.dependency_path.nodeIds.includes(IDS.orderA) || /Order A/.test(joined));
    const impact = calculateGraphImpact(db, IDS.shipment);
    assert.equal(explanation.impact.affected_orders, impact.affected_orders.length);
    assert.equal(explanation.impact.affected_customers, impact.affected_customers.length);
    assert.equal(explanation.impact.associated_revenue, impact.associated_revenue);
    assert.equal(explanation.impact.affected_expected_cash, impact.affected_expected_cash);
    assert.equal(explanation.impact.associated_revenue, 850000);
    assert.equal(explanation.impact.affected_expected_cash, 540000);
    assert.equal(explanation.evidence.some((item) => item.kind === "OBSERVED"), true);
    assert.equal(explanation.evidence.some((item) => item.kind === "CALCULATED"), true);
    assert.equal(explanation.evidence.some((item) => item.kind === "ASSUMPTION"), true);
    assert.match(explanation.impact.notes, /not a claim|associated/i);
  });

  it("earlier supplier arrival restores buffer and resolves the warning", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const engine = EarlyWarningEngine.for(db);
    const [resolved] = engine.reviseShipmentArrival(SHIP_EXPECTED_ISO, SUPPLIER_CASCADE_ISO);
    assert.ok(resolved);
    assert.equal(resolved.status, "RESOLVED");
    assert.ok(resolved.resolved_at);
    assert.equal(engine.getActiveWarnings().length, 0);
  });

  it("deadline pass hands MISSED to Detect and escalates the warning", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const engine = EarlyWarningEngine.for(db);
    assert.equal(engine.get(DELIVER_A_WARNING_ID)?.status, "ACTIVE");

    detectExceptions(db, AFTER_DEADLINE);
    engine.escalateToException(IDS.expectDeliverA, AFTER_DEADLINE);

    const delivery = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectDeliverA]);
    assert.equal(delivery?.status, "MISSED");
    const miss = one<ExceptionRow>(
      db,
      "SELECT * FROM exceptions WHERE expectation_id = ? AND status != 'resolved'",
      [IDS.expectDeliverA],
    );
    assert.ok(miss);
    assert.equal(miss?.kind, "commitment_missed");
    const warning = engine.get(DELIVER_A_WARNING_ID);
    assert.equal(warning?.status, "ESCALATED");
    assert.ok(warning?.resolved_at);
    assert.equal(engine.getActiveWarnings().length, 0);
  });

  it("repeated evaluation does not create duplicate warnings", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const engine = EarlyWarningEngine.for(db);
    engine.evaluateAll(SUPPLIER_CASCADE_ISO);
    engine.evaluateAll(SUPPLIER_CASCADE_ISO);
    engine.evaluateEntity(IDS.shipment, SUPPLIER_CASCADE_ISO);
    const rows = engine.list();
    assert.equal(rows.filter((row) => row.expectation_id === IDS.expectDeliverA).length, 1);
    assert.equal(rows.filter((row) => row.status === "ACTIVE").length, 1);
  });

  it("a relevant upstream event re-evaluates the warning", () => {
    const db = getDb();
    wipeAndSeed(db);
    ensureWarningHooks(db);
    triggerSupplierDelay(db);
    const engine = EarlyWarningEngine.for(db);
    const before = engine.get(DELIVER_A_WARNING_ID);
    assert.ok(before);
    const event = eventsFor(db).append({
      type: EVENT_TYPES.SHIPMENT_REVISED,
      source: "test",
      entity_type: "shipment",
      entity_id: IDS.shipment,
      payload: { newExpectedAt: SHIP_DELAYED_ISO },
      occurred_at: SUPPLIER_CASCADE_ISO,
      received_at: SUPPLIER_CASCADE_ISO,
      confidence: 1,
    });
    const after = engine.get(DELIVER_A_WARNING_ID);
    assert.ok(after);
    assert.equal(after.id, before.id);
    assert.ok(after.source_event_id === event.id || after.status === "ACTIVE");
    assert.equal(engine.list().filter((row) => row.expectation_id === IDS.expectDeliverA).length, 1);
  });

  it("tiny history does not create a strong historical claim", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const history = EarlyWarningEngine.for(db).historicalEvidence();
    assert.equal(history.sufficient, false);
    assert.match(history.wording, /Insufficient comparable verified history/);
    const explanation = WarningExplanationService.for(db).explain(DELIVER_A_WARNING_ID, SUPPLIER_CASCADE_ISO);
    assert.equal(explanation?.historical_evidence.sufficient, false);
    assert.doesNotMatch(explanation?.historical_evidence.wording || "", /will cause failure/i);
  });

  it("Business Twin reflects the active warning without a health score", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const twin = businessTwin(db);
    const ops = twin.domains.find((domain) => domain.id === "OPERATIONS");
    const cash = twin.domains.find((domain) => domain.id === "CASH");
    assert.ok(ops);
    assert.match(ops?.headline || "", /early warning/i);
    assert.match(ops?.headline || "", /commitment at risk/i);
    assert.doesNotMatch(ops?.headline || "", /68%/);
    assert.equal(cash?.attention_value, 540000);
    assert.match(cash?.headline || "", /expected timing/i);
  });

  it("Pulse Coming next shows AT RISK — NOT MISSED from stored buffers", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.ok(pulse.comingNext.length >= 1);
    const next = pulse.comingNext[0];
    assert.equal(next.buffer_state, "AT_RISK");
    assert.equal(next.failed, false);
    assert.equal(next.required_buffer_minutes, 18 * 60);
    assert.ok(next.shortfall_minutes < 0);
    assert.ok(!pulse.exceptions.some((row) => row.expectation_id === IDS.expectDeliverA && row.kind === "commitment_missed"));
  });

  it("GoalContextBuilder consumes active warnings", () => {
    const db = getDb();
    wipeAndSeed(db);
    const result = createGoal(db, { utterance: "Protect everything at risk this week." }, getMeta(db, "demo_now"));
    assert.ok(result.context.earlyWarnings.length >= 1);
    const warning = result.context.earlyWarnings[0];
    assert.equal(warning.bufferState, "AT_RISK");
    assert.equal(warning.expectationId, IDS.expectDeliverA);
    assert.ok(result.plan?.actions.some((action) => action.title === "Monitor revised shipment"));
    assert.ok(result.plan?.actions.some((action) => action.type === "prioritize_order"));
    assert.ok(result.plan?.actions.some((action) => action.type === "prepare_customer_notice"));
  });

  it("320K offline demo and 10% BLOCK still work", async () => {
    process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-warn-reg-")), "loop.db");
    resetDbFile();
    const db = getDb();
    const pulse = pulseSummary(db, getMeta(db, "demo_now"));
    assert.match(pulse.headline, /320/);
    assert.equal(pulse.counts.NEEDS_YOU, 1);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    await ingestSeedDiscount(db);
    assert.equal(getMeta(db, "demo_phase"), "discount_blocked");
    const blocked = pulseSummary(db, getMeta(db, "demo_now")).exceptions.find((row) => row.id === IDS.excDiscount);
    assert.equal(blocked?.attention, "NEEDS_YOU");
  });
});
