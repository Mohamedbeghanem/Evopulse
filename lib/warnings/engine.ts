import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { refreshExpectations } from "../engine/expectations";
import { calculateGraphImpact } from "../engine/impact";
import { EVENT_TYPES, eventsFor } from "../events";
import { getDownstream, graphFor, pathTo } from "../graph";
import { id, IDS } from "../ids";
import { LEARNING_THRESHOLDS } from "../learning/confidence";
import type { CommitmentRow, EntityRow, EventRow, ExpectationRow } from "../types";
import { WARNING_THRESHOLDS } from "./thresholds";
import { evaluateBuffer, formatHours } from "./time";
import type {
  BufferState,
  DownstreamDurations,
  ReasonCode,
  WarningRow,
  WarningSeverity,
  WarningStatus,
  WarningSummary,
} from "./types";

export const DELIVER_A_WARNING_ID = "ewn_deliver_order_a";

const REEVAL_TYPES = new Set([
  "shipment.delayed",
  "shipment.expected",
  "shipment.revised",
  "shipment.arrived",
  "order.affected",
  "order.updated",
  "commitment.updated",
  "delivery.completed",
  "expectation.revised",
  "customer.confirmed",
  "customer.replied",
  "payment.expected_changed",
]);

export class EarlyWarningEngine {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new EarlyWarningEngine(db);
  }

  evaluateExpectation(expectationId: string, now: string, sourceEventId?: string | null): WarningRow | null {
    const expectation = one<ExpectationRow>(this.db, "SELECT * FROM expectations WHERE id = ?", [expectationId]);
    if (!expectation) return null;
    const commitment = one<CommitmentRow>(this.db, "SELECT * FROM commitments WHERE id = ?", [
      expectation.commitment_id,
    ]);
    if (!commitment || commitment.action !== "deliver_order") return null;

    const upstream = this.upstreamAvailability(now);
    const durations = this.durationsFor(commitment);
    const buffer = evaluateBuffer({
      deadline: expectation.due_at,
      upstreamAvailableAt: upstream.at,
      now,
      durations,
    });

    const existing = this.findByExpectation("DEADLINE_BUFFER", expectation.id);
    if (buffer.state === "MISSED") {
      return this.escalateToException(expectation.id, now);
    }
    if (buffer.state === "SAFE") {
      if (existing && (existing.status === "ACTIVE" || existing.status === "MONITORING")) {
        return this.resolveWarning(existing.id, now, "Sufficient buffer restored under current timing assumptions.");
      }
      return existing ?? null;
    }

    const reasons = reasonCodes(buffer.state, upstream.delayed);
    const severity = severityOf(buffer, calculateGraphImpact(this.db, IDS.shipment).associated_revenue);
    const status: WarningStatus = buffer.state === "TIGHT" ? "MONITORING" : "ACTIVE";
    const path = this.dependencyPath();
    const evidence = {
      observed: upstream.delayed
        ? `Supplier revised shipment arrival to ${upstream.at}.`
        : `Shipment still expected ${upstream.at}.`,
      calculated: `${formatHours(buffer.available_buffer_minutes)} available vs ${formatHours(buffer.required_buffer_minutes)} required.`,
      assumption: "Processing, preparation, and transport durations remain unchanged.",
      path: path.labels,
      durations: buffer.durations,
      buffer_state: buffer.state,
      reason_codes: reasons,
      upstream_available_at: upstream.at,
      deadline: expectation.due_at,
    };

    if (existing) {
      if (existing.status === "ESCALATED" || existing.status === "DISMISSED") return existing;
      run(
        this.db,
        `UPDATE early_warnings
         SET status = ?, severity = ?, available_buffer_minutes = ?, required_buffer_minutes = ?,
             shortfall_minutes = ?, source_event_id = COALESCE(?, source_event_id),
             evidence = ?, expected_failure_at = ?, metadata = ?
         WHERE id = ?`,
        [
          status,
          severity,
          buffer.available_buffer_minutes,
          buffer.required_buffer_minutes,
          buffer.shortfall_minutes,
          sourceEventId ?? null,
          JSON.stringify(evidence),
          expectation.due_at,
          JSON.stringify({
            root_entity_id: IDS.shipment,
            delayed: upstream.delayed,
            path: path.labels,
            reason_codes: reasons,
            buffer_state: buffer.state,
          }),
          existing.id,
        ],
      );
      return this.get(existing.id)!;
    }

    const rowId = expectation.id === IDS.expectDeliverA ? DELIVER_A_WARNING_ID : id("ewn");
    run(
      this.db,
      `INSERT INTO early_warnings
        (id, warning_type, entity_type, entity_id, expectation_id, status, severity, detected_at,
         expected_failure_at, available_buffer_minutes, required_buffer_minutes, shortfall_minutes,
         source_event_id, evidence, confidence, resolved_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      [
        rowId,
        "DEADLINE_BUFFER",
        "commitment",
        commitment.id,
        expectation.id,
        status,
        severity,
        now,
        expectation.due_at,
        buffer.available_buffer_minutes,
        buffer.required_buffer_minutes,
        buffer.shortfall_minutes,
        sourceEventId ?? null,
        JSON.stringify(evidence),
        1,
        JSON.stringify({
          root_entity_id: IDS.shipment,
          delayed: upstream.delayed,
          path: path.labels,
          reason_codes: reasons,
          buffer_state: buffer.state,
        }),
      ],
    );
    return this.get(rowId)!;
  }

  evaluateDependencies(entityId: string, now: string, sourceEventId?: string | null): WarningRow[] {
    return this.evaluateEntity(entityId, now, sourceEventId);
  }

  evaluateEntity(entityId: string, now: string, sourceEventId?: string | null): WarningRow[] {
    const expectationIds = new Set<string>();
    if (entityId === IDS.expectDeliverA || entityId === IDS.commitDeliverA || entityId === IDS.orderA) {
      expectationIds.add(IDS.expectDeliverA);
    }
    const { hits } = getDownstream(this.db, entityId, 12);
    for (const hit of hits) {
      if (hit.node.type === "commitment" || hit.node.entity_id === IDS.commitDeliverA) {
        const exp = one<ExpectationRow>(
          this.db,
          "SELECT * FROM expectations WHERE commitment_id = ?",
          [hit.node.entity_id],
        );
        if (exp) expectationIds.add(exp.id);
      }
    }
    if (entityId === IDS.shipment || entityId === IDS.supplier || entityId === IDS.product) {
      expectationIds.add(IDS.expectDeliverA);
    }
    const updated: WarningRow[] = [];
    for (const expectationId of expectationIds) {
      const row = this.evaluateExpectation(expectationId, now, sourceEventId);
      if (row) updated.push(row);
    }
    return updated;
  }

  evaluateFromEvent(event: { id: string; type: string; entity_id: string | null }, now: string): WarningRow[] {
    if (!REEVAL_TYPES.has(event.type) || !event.entity_id) return [];
    return this.evaluateEntity(event.entity_id, now, event.id);
  }

  evaluateAll(now: string): WarningRow[] {
    return this.evaluateEntity(IDS.shipment, now);
  }

  get(warningId: string): WarningRow | undefined {
    return one<WarningRow>(this.db, "SELECT * FROM early_warnings WHERE id = ?", [warningId]);
  }

  getActiveWarnings(): WarningRow[] {
    return all<WarningRow>(
      this.db,
      `SELECT * FROM early_warnings
       WHERE status IN ('ACTIVE', 'MONITORING')
       ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
                shortfall_minutes ASC`,
    );
  }

  list(status?: WarningStatus): WarningRow[] {
    if (status) {
      return all<WarningRow>(this.db, "SELECT * FROM early_warnings WHERE status = ? ORDER BY detected_at DESC", [
        status,
      ]);
    }
    return all<WarningRow>(this.db, "SELECT * FROM early_warnings ORDER BY detected_at DESC");
  }

  resolveWarning(warningId: string, now: string, reason: string): WarningRow {
    const row = this.get(warningId);
    if (!row) throw new Error("Warning not found");
    const meta = { ...safeJson(row.metadata), resolved_reason: reason };
    run(
      this.db,
      `UPDATE early_warnings SET status = ?, resolved_at = ?, metadata = ? WHERE id = ?`,
      ["RESOLVED", now, JSON.stringify(meta), warningId],
    );
    return this.get(warningId)!;
  }

  escalateToException(expectationId: string, now: string): WarningRow | null {
    refreshExpectations(this.db, now);
    const expectation = one<ExpectationRow>(this.db, "SELECT * FROM expectations WHERE id = ?", [expectationId]);
    if (!expectation) return null;
    const warning = this.findByExpectation("DEADLINE_BUFFER", expectationId);
    if (expectation.status !== "MISSED") {
      return warning ?? null;
    }

    const existingExc = one<{ id: string }>(
      this.db,
      "SELECT id FROM exceptions WHERE expectation_id = ? AND status != 'resolved'",
      [expectationId],
    );
    if (!existingExc) {
      const commitment = one<CommitmentRow>(this.db, "SELECT * FROM commitments WHERE id = ?", [
        expectation.commitment_id,
      ]);
      const impact = calculateGraphImpact(this.db, IDS.shipment);
      run(
        this.db,
        `INSERT INTO exceptions
          (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id("exc"),
          `Customer delivery missed — ${commitment?.description || expectation.description}`,
          "commitment_missed",
          expectation.id,
          IDS.orderA,
          "NEEDS_YOU",
          "critical",
          "high",
          JSON.stringify({
            customersAffected: impact.affected_customers.length,
            opportunitiesAffected: 0,
            revenueAssociated: impact.associated_revenue,
            currency: "DZD",
            cashTimingAffected: impact.affected_expected_cash > 0,
            urgency: "high",
            notes: impact.notes,
          }),
          JSON.stringify({
            source: "early-warning-escalation",
            quote: "Deadline passed without fulfilment. Detect/expectation engine owns MISSED.",
            expected: expectation.description,
            actual: expectation.actual || "No fulfilment event recorded",
            deal: `${impact.associated_revenue.toLocaleString("en-US")} DZD associated`,
            confidence: 1,
          }),
          1,
          "open",
          now,
        ],
      );
    }

    if (warning && warning.status !== "ESCALATED") {
      run(
        this.db,
        `UPDATE early_warnings SET status = ?, resolved_at = ?, metadata = ? WHERE id = ?`,
        [
          "ESCALATED",
          now,
          JSON.stringify({ ...safeJson(warning.metadata), escalated_reason: "Deadline passed. Exception owns MISSED." }),
          warning.id,
        ],
      );
      return this.get(warning.id)!;
    }
    return warning ? this.get(warning.id)! : null;
  }

  reviseShipmentArrival(newExpectedAt: string, now: string, sourceEventId?: string | null): WarningRow[] {
    const graph = graphFor(this.db);
    const shipment = one<EntityRow>(this.db, "SELECT * FROM entities WHERE id = ?", [IDS.shipment]);
    const prior = shipment ? safeJson(shipment.payload) : {};
    run(this.db, "UPDATE entities SET payload = ? WHERE id = ?", [
      JSON.stringify({ ...prior, expectedAt: newExpectedAt, status: "revised" }),
      IDS.shipment,
    ]);
    graph.upsertNode({
      id: IDS.shipment,
      type: "shipment",
      entity_id: IDS.shipment,
      label: "Shipment SH-204",
      metadata: { ...prior, expectedAt: newExpectedAt, status: "revised", ref: "SH-204" },
    });
    run(this.db, "UPDATE expectations SET due_at = ?, updated_at = ? WHERE id = ?", [
      newExpectedAt,
      now,
      IDS.expectShip,
    ]);
    run(this.db, "UPDATE commitments SET deadline = ? WHERE id = ?", [newExpectedAt, IDS.commitShip]);
    eventsFor(this.db).append({
      type: EVENT_TYPES.SHIPMENT_REVISED,
      source: "early-warning",
      source_id: IDS.shipment,
      entity_type: "shipment",
      entity_id: IDS.shipment,
      payload: { newExpectedAt, previousExpectedAt: prior.expectedAt || null },
      occurred_at: now,
      received_at: now,
      confidence: 1,
      idempotent: true,
    });
    return this.evaluateEntity(IDS.shipment, now, sourceEventId);
  }

  summarize(row: WarningRow): WarningSummary {
    const meta = safeJson(row.metadata);
    const evidence = safeJson(row.evidence);
    const state = (evidence.buffer_state as BufferState) || (row.shortfall_minutes < 0 ? "AT_RISK" : "TIGHT");
    return {
      id: row.id,
      warning_type: row.warning_type,
      title: "Customer delivery — Order A",
      status: row.status,
      severity: row.severity,
      buffer_state: state,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      expectation_id: row.expectation_id,
      available_buffer_minutes: row.available_buffer_minutes,
      required_buffer_minutes: row.required_buffer_minutes,
      shortfall_minutes: row.shortfall_minutes,
      detected_at: row.detected_at,
      expected_failure_at: row.expected_failure_at,
      reason_codes: Array.isArray(meta.reason_codes) ? (meta.reason_codes as ReasonCode[]) : [],
      failed: row.status === "ESCALATED" || state === "MISSED",
      path_labels: Array.isArray(meta.path) ? (meta.path as string[]) : [],
    };
  }

  historicalEvidence() {
    const delays = all<EventRow>(this.db, "SELECT * FROM events WHERE type = ?", ["shipment.delayed"]);
    const sufficient = delays.length >= LEARNING_THRESHOLDS.RELIABLE_PATTERN_MIN;
    return {
      observations: delays.length,
      sufficient,
      wording: sufficient
        ? `${delays.length} comparable supplier delays recorded. Historical context only — it does not determine this warning.`
        : "Insufficient comparable verified history.",
    };
  }

  dependencyPath() {
    const segments = [
      pathTo(this.db, IDS.supplier, IDS.shipment),
      pathTo(this.db, IDS.shipment, IDS.orderA),
      pathTo(this.db, IDS.orderA, IDS.commitDeliverA),
    ].filter((segment): segment is NonNullable<typeof segment> => Boolean(segment));
    if (segments.length) {
      const nodeIds: string[] = [];
      const labels: string[] = [];
      const relationships: string[] = [];
      for (const segment of segments) {
        for (let i = 0; i < segment.nodeIds.length; i++) {
          const nodeId = segment.nodeIds[i];
          if (nodeIds[nodeIds.length - 1] === nodeId) continue;
          if (i > 0) relationships.push(segment.relationships[i - 1] || "depends_on");
          else if (nodeIds.length) relationships.push("depends_on");
          nodeIds.push(nodeId);
          labels.push(segment.labels[i]);
        }
      }
      return { nodeIds, labels, relationships };
    }
    return {
      nodeIds: [IDS.supplier, IDS.shipment, IDS.orderA, IDS.commitDeliverA],
      labels: ["Atlas Supply", "Shipment SH-204", "Order A — Oran Fresh", "Deliver Order A to Oran Fresh Tuesday"],
      relationships: ["supplies", "contains/required_by", "depends_on"],
    };
  }

  private findByExpectation(type: string, expectationId: string): WarningRow | undefined {
    return one<WarningRow>(
      this.db,
      "SELECT * FROM early_warnings WHERE warning_type = ? AND expectation_id = ?",
      [type, expectationId],
    );
  }

  private upstreamAvailability(now: string): { at: string; delayed: boolean } {
    const shipment = one<EntityRow>(this.db, "SELECT * FROM entities WHERE id = ?", [IDS.shipment]);
    const payload = shipment ? safeJson(shipment.payload) : {};
    const shipExp = one<ExpectationRow>(this.db, "SELECT * FROM expectations WHERE id = ?", [IDS.expectShip]);
    const at = String(payload.expectedAt || shipExp?.due_at || now);
    const delayed = payload.status === "delayed" || payload.status === "revised" || Boolean(payload.deltaDays);
    return { at, delayed };
  }

  private durationsFor(commitment: CommitmentRow): Partial<DownstreamDurations> {
    const order = one<EntityRow>(this.db, "SELECT * FROM entities WHERE id = ?", [IDS.orderA]);
    const payload = order ? safeJson(order.payload) : {};
    const node = graphFor(this.db).getNode(commitment.id);
    const meta = node?.metadata || {};
    return {
      processing_minutes: num(payload.processing_minutes) ?? num(meta.processing_minutes),
      preparation_minutes: num(payload.preparation_minutes) ?? num(meta.preparation_minutes),
      transport_minutes: num(payload.transport_minutes) ?? num(meta.transport_minutes),
    };
  }
}

function reasonCodes(state: BufferState, delayed: boolean): ReasonCode[] {
  const codes: ReasonCode[] = [];
  if (state === "TIGHT") codes.push("BUFFER_TIGHT", "DEADLINE_APPROACHING");
  if (state === "AT_RISK") codes.push("BUFFER_NEGATIVE", "CUSTOMER_COMMITMENT_AT_RISK");
  if (delayed) codes.push("UPSTREAM_DELAY", "DEPENDENCY_AT_RISK", "CASH_TIMING_AT_RISK");
  return codes;
}

function severityOf(buffer: { state: BufferState; shortfall_minutes: number }, associatedRevenue: number): WarningSeverity {
  if (buffer.state === "MISSED") return "CRITICAL";
  if (buffer.state === "AT_RISK") {
    if (Math.abs(buffer.shortfall_minutes) >= WARNING_THRESHOLDS.CRITICAL_SHORTFALL_MINUTES) return "CRITICAL";
    if (associatedRevenue >= WARNING_THRESHOLDS.HIGH_VALUE_DZD) return "HIGH";
    return "HIGH";
  }
  if (buffer.state === "TIGHT") return "MEDIUM";
  return "LOW";
}

function safeJson(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}") as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
