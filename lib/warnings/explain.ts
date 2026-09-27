import type { DatabaseSync } from "node:sqlite";
import { one } from "../db";
import { calculateGraphImpact } from "../engine/impact";
import { eventsFor } from "../events";
import { IDS } from "../ids";
import type { ExpectationRow } from "../types";
import { EarlyWarningEngine } from "./engine";
import { evaluateBuffer, formatHours } from "./time";
import type { WarningEvidenceItem, WarningExplanation } from "./types";

export class WarningExplanationService {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new WarningExplanationService(db);
  }

  explain(warningId: string, now: string): WarningExplanation | null {
    const engine = EarlyWarningEngine.for(this.db);
    const row = engine.get(warningId);
    if (!row) return null;
    const summary = engine.summarize(row);
    const expectation = row.expectation_id
      ? one<ExpectationRow>(this.db, "SELECT * FROM expectations WHERE id = ?", [row.expectation_id])
      : undefined;
    const evidenceJson = safeJson(row.evidence);
    const upstream = String(evidenceJson.upstream_available_at || "");
    const deadline = expectation?.due_at || String(evidenceJson.deadline || "");
    const durations = (evidenceJson.durations as { processing_minutes?: number; preparation_minutes?: number; transport_minutes?: number }) || {};
    const buffer = evaluateBuffer({
      deadline: deadline || now,
      upstreamAvailableAt: upstream || now,
      now,
      durations,
    });
    const impact = calculateGraphImpact(this.db, IDS.shipment);
    const path = engine.dependencyPath();
    const history = engine.historicalEvidence();
    const sourceEvents = eventsFor(this.db)
      .list({ entity_id: IDS.shipment })
      .filter((event) => event.type === "shipment.delayed" || event.type === "shipment.revised" || event.type === "shipment.expected")
      .map((event) => ({ id: event.id, type: event.type, occurred_at: event.occurred_at }));

    const evidence: WarningEvidenceItem[] = [
      {
        kind: "OBSERVED",
        statement: String(evidenceJson.observed || "Upstream shipment timing was recorded."),
        source_type: "event",
        source_id: row.source_event_id || IDS.evtShipDelayed,
      },
      {
        kind: "DEPENDENCY",
        statement: `Order A depends on Shipment SH-204 via ${path.labels.join(" → ")}.`,
        source_type: "graph",
        source_id: IDS.shipment,
      },
      {
        kind: "CALCULATED",
        statement: String(evidenceJson.calculated || `${formatHours(buffer.available_buffer_minutes)} available vs ${formatHours(buffer.required_buffer_minutes)} required.`),
      },
      {
        kind: "ASSUMPTION",
        statement: `Transport remains ${durations.transport_minutes ?? 480} minutes. Processing ${durations.processing_minutes ?? 360} minutes. Preparation ${durations.preparation_minutes ?? 240} minutes.`,
      },
      {
        kind: "HISTORICAL",
        statement: history.wording,
      },
    ];

    return {
      warning: summary,
      has_failed: summary.failed,
      source_events: sourceEvents,
      expectation: expectation
        ? {
            id: expectation.id,
            description: expectation.description,
            due_at: expectation.due_at,
            status: expectation.status,
          }
        : null,
      dependency_path: path,
      current_state: {
        now,
        upstream_available_at: buffer.upstream_available_at,
        deadline: buffer.deadline,
        buffer,
      },
      available_buffer: formatHours(row.available_buffer_minutes),
      required_buffer: formatHours(row.required_buffer_minutes),
      shortfall: formatHours(Math.abs(row.shortfall_minutes)),
      impact: {
        affected_orders: impact.affected_orders.length,
        affected_customers: impact.affected_customers.length,
        associated_revenue: impact.associated_revenue,
        affected_expected_cash: impact.affected_expected_cash,
        currency: impact.currency,
        notes: impact.notes,
      },
      assumptions: [
        "Current processing / preparation / transport durations remain unchanged.",
        "No alternate inventory is assumed.",
      ],
      historical_evidence: {
        wording: history.wording,
        observations: history.observations,
        sufficient: history.sufficient,
      },
      classification: buffer.state,
      evidence,
      simulation: {
        warning_id: row.id,
        root_entity_id: IDS.shipment,
        deadline: buffer.deadline,
        available_buffer_minutes: row.available_buffer_minutes,
        required_buffer_minutes: row.required_buffer_minutes,
        dependency_path: path.labels,
        impact_associated_revenue: impact.associated_revenue,
      },
    };
  }
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
