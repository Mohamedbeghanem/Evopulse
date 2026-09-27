import { formatHours } from "./buffer";
import type { WarningRow, WarningView } from "./types";

export function formatCompactAmount(amount: number): string {
  if (Math.abs(amount) >= 1000 && amount % 1000 === 0) return `${Math.round(amount / 1000)}K`;
  return amount.toLocaleString("en-US");
}

export function toWarningView(row: WarningRow): WarningView {
  const children = JSON.parse(row.children_json) as WarningView["children"];
  const evidence = JSON.parse(row.evidence_json) as WarningView["evidence"];
  const learning = JSON.parse(row.context_json) as WarningView["learning"];
  const failed = row.status === "TRANSITIONED";
  const timeLabel =
    row.kind === "inactivity_window"
      ? "Approaching historically problematic inactivity window"
      : row.shortfall_hours && row.shortfall_hours > 0
        ? `${formatHours(row.shortfall_hours)} projected shortfall`
        : "Buffer positive";
  const valueLabel =
    row.kind === "delivery_shortfall"
      ? `${formatCompactAmount(row.value_amount)} cascade`
      : formatCompactAmount(row.value_amount);

  return {
    id: row.id,
    status: row.status,
    severity: row.severity,
    bufferState: row.buffer_state,
    kind: row.kind,
    entityType: row.entity_type,
    entityId: row.entity_id,
    entityLabel: row.entity_label,
    headline: row.headline,
    summary: row.summary,
    explanation: row.explanation,
    failed,
    failedAnswer: failed
      ? "Yes. The deadline passed, so this is an exception."
      : "No.",
    source: row.source,
    confidence: row.confidence,
    availableHours: row.available_hours,
    requiredHours: row.required_hours,
    shortfallHours: row.shortfall_hours,
    bufferHours: row.buffer_hours,
    deadlineAt: row.deadline_at,
    projectedAt: row.projected_at,
    valueAmount: row.value_amount,
    currency: row.currency,
    cashAmount: row.cash_amount,
    valueLabel,
    timeLabel,
    children,
    evidence,
    learning,
    exceptionId: row.exception_id,
    domain: row.domain,
    scenario:
      row.kind === "delivery_shortfall"
        ? {
            entityType: row.entity_type,
            entityId: row.entity_id,
            question: "What if shipment is another +2 days late?",
            deltaDays: 2,
          }
        : null,
  };
}

export function groupActiveWarnings(views: WarningView[]) {
  const active = views.filter((warning) => warning.status === "ACTIVE");
  return {
    CRITICAL: active.filter((warning) => warning.severity === "CRITICAL"),
    HIGH: active.filter((warning) => warning.severity === "HIGH"),
    MONITORING: active.filter((warning) => warning.severity === "MONITORING"),
  };
}

export function comingNext(views: WarningView[]) {
  return views
    .filter((warning) => warning.status === "ACTIVE")
    .map((warning) => ({
      id: warning.id,
      headline: warning.headline,
      line: warning.timeLabel,
      valueLabel: warning.valueLabel,
      href: `/warnings/${warning.id}`,
    }));
}
