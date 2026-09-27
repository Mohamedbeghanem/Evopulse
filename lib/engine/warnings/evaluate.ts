import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../../db";
import { buildContextSignature, valueBand } from "../../learning";
import { IDS } from "../../ids";
import type { EntityRow, EvidencePack, Impact } from "../../types";
import {
  DEFAULT_MAX_DEPTH,
  dependencyEdges,
  traverseDependencies,
  type DependencyEdge,
} from "../graph";
import { assessBuffer, formatHours, hoursBetween, type BufferState } from "./buffer";
import { toWarningView } from "./present";
import {
  DELIVERY_CONFIDENCE,
  INACTIVITY_APPROACH_HOURS,
  INACTIVITY_CONFIDENCE,
  INACTIVITY_WINDOW_HOURS,
} from "./scenario";
import type {
  EvidenceHop,
  WarningChild,
  WarningEvidence,
  WarningKind,
  WarningLearningContext,
  WarningRow,
  WarningSeverity,
  WarningStatus,
  WarningView,
} from "./types";

const evaluating = new WeakSet<DatabaseSync>();

type Draft = {
  id: string;
  status: WarningStatus;
  severity: WarningSeverity;
  bufferState: BufferState;
  kind: WarningKind;
  entityType: string;
  entityId: string;
  entityLabel: string;
  headline: string;
  summary: string;
  explanation: string;
  availableHours: number | null;
  requiredHours: number | null;
  shortfallHours: number | null;
  bufferHours: number | null;
  deadlineAt: string | null;
  projectedAt: string | null;
  valueAmount: number;
  currency: string;
  cashAmount: number;
  confidence: number;
  source: string;
  sourceEventId: string | null;
  domain: string;
  exceptionId: string | null;
  evidence: WarningEvidence;
  children: WarningChild[];
  learning: WarningLearningContext;
};

export function listWarningRows(db: DatabaseSync): WarningRow[] {
  return all<WarningRow>(db, "SELECT * FROM warnings ORDER BY created_at ASC");
}

export function getWarningRow(db: DatabaseSync, warningId: string): WarningRow | undefined {
  return one<WarningRow>(db, "SELECT * FROM warnings WHERE id = ?", [warningId]);
}

export function listWarningViews(db: DatabaseSync): WarningView[] {
  return listWarningRows(db).map(toWarningView);
}

export function getWarningView(db: DatabaseSync, warningId: string): WarningView | undefined {
  const row = getWarningRow(db, warningId);
  return row ? toWarningView(row) : undefined;
}

/**
 * Recompute early warnings.
 * With startId, walk only that node's dependency neighborhood.
 * Without it, start from shipment and opportunity roots (on-demand / demo / tests).
 */
export function evaluateEarlyWarnings(
  db: DatabaseSync,
  now: string,
  options?: { startId?: string },
): WarningView[] {
  if (evaluating.has(db)) return listWarningViews(db);
  evaluating.add(db);
  try {
    const edges = dependencyEdges(db);
    if (options?.startId) evaluateFromNode(db, now, options.startId, edges);
    else evaluateRoots(db, now, edges);
    return listWarningViews(db);
  } finally {
    evaluating.delete(db);
  }
}

function evaluateRoots(db: DatabaseSync, now: string, edges: DependencyEdge[]) {
  const roots = all<EntityRow>(
    db,
    "SELECT * FROM entities WHERE type IN ('shipment', 'opportunity') ORDER BY id",
  );
  for (const root of roots) {
    if (root.type === "shipment") evaluateShipment(db, root, now, edges);
    else evaluateInactivity(db, root, now);
  }
}

function evaluateFromNode(db: DatabaseSync, now: string, startId: string, edges: DependencyEdge[]) {
  const start = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [startId]);
  if (!start) return;

  if (start.type === "shipment") {
    evaluateShipment(db, start, now, edges);
    return;
  }

  if (start.type === "order" || start.type === "payment" || start.type === "supplier") {
    const neighborhood = [
      ...traverseDependencies(edges, startId, { maxDepth: DEFAULT_MAX_DEPTH, direction: "upstream" }),
      ...traverseDependencies(edges, startId, { maxDepth: DEFAULT_MAX_DEPTH, direction: "downstream" }),
    ];
    const ids = [...new Set(neighborhood.map((node) => node.id))];
    const entities = loadEntities(db, ids);
    for (const entity of entities.values()) {
      if (entity.type === "shipment") evaluateShipment(db, entity, now, edges);
    }
    return;
  }

  const opportunity = resolveOpportunity(db, start);
  if (opportunity) evaluateInactivity(db, opportunity, now);
}

function evaluateShipment(db: DatabaseSync, shipment: EntityRow, now: string, edges: DependencyEdge[]) {
  const payload = parsePayload(shipment.payload);
  const projected = stringField(payload, "projectedArrival");
  if (!projected) return;

  const downstream = traverseDependencies(edges, shipment.id, {
    maxDepth: DEFAULT_MAX_DEPTH,
    direction: "downstream",
  });
  const entities = loadEntities(db, downstream.map((node) => node.id));
  const children: WarningChild[] = [];

  for (const node of downstream) {
    const entity = entities.get(node.id);
    if (!entity || entity.type !== "order") continue;
    const body = parsePayload(entity.payload);
    const deadline = stringField(body, "deadline");
    if (!deadline) continue;
    const availableHours = hoursBetween(now, deadline);
    const requiredHours = hoursBetween(now, projected);
    const assessment = assessBuffer(availableHours, requiredHours);
    children.push({
      entityId: entity.id,
      entityType: entity.type,
      label: entity.name,
      state: assessment.state,
      availableHours,
      requiredHours,
      shortfallHours: assessment.shortfallHours,
      bufferHours: assessment.bufferHours,
      valueAmount: numberField(body, "amount"),
      currency: stringField(body, "currency") || "DZD",
      customer: stringField(body, "customer") || entity.name,
      deadlineAt: deadline,
    });
  }

  const warningId = `wrn_${shipment.id}`;
  const existing = getWarningRow(db, warningId);
  if (!children.length) {
    if (existing && existing.status === "ACTIVE") resolveDraft(db, existing, now, "No downstream orders remain.");
    return;
  }

  const atRisk = children.filter((child) => child.state === "AT_RISK");
  const failed = atRisk.filter((child) => Date.parse(now) >= Date.parse(child.deadlineAt));
  const early = atRisk.filter((child) => Date.parse(now) < Date.parse(child.deadlineAt));
  const currency = children[0]?.currency || "DZD";
  const cascade = children.reduce((sum, child) => sum + child.valueAmount, 0);
  const focus = early[0] ? worstChild(early) : failed[0] ? worstChild(failed) : worstChild(children);
  const event = latestDelayEvent(db, shipment.id);
  const path = pathHops(downstream.find((node) => node.id === focus.entityId)?.path ?? [shipment.id], entities, shipment);
  const evidence = buildEvidence(event, path, "Supplier delay", DELIVERY_CONFIDENCE);
  const cashAmount = cashDownstream(downstream, entities, new Set((early.length ? early : failed).map((child) => child.entityId)));

  if (!atRisk.length) {
    if (!existing) return;
    saveWarning(db, {
      ...baseDelivery(warningId, shipment, focus, children, evidence, cascade, cashAmount, currency),
      projectedAt: projected,
      status: "RESOLVED",
      severity: "MONITORING",
      bufferState: focus.state,
      summary: "Customer delivery fits the current projection.",
      explanation:
        "The projected arrival is no longer after the customer deadlines. The buffer is positive, so this early warning is resolved.",
      exceptionId: existing.exception_id,
      learning: learningContext(existing, {
        warningId,
        problem_type: "delivery_shortfall",
        entity_type: shipment.type,
        entity_id: shipment.id,
        valueAmount: cascade,
        silenceBand: "deadline",
        exceptionId: existing.exception_id,
      }),
    }, now);
    return;
  }

  let exceptionId: string | null = existing?.exception_id ?? null;
  if (failed.length) {
    exceptionId = ensureDeliveryException(db, warningId, failed, shipment, evidence, cascade, cashAmount, currency, now);
  }

  const status: WarningStatus = early.length ? "ACTIVE" : "TRANSITIONED";
  const worst = early.length ? worstChild(early) : worstChild(failed);
  const severity: WarningSeverity = early.length
    ? worst.shortfallHours >= 4 || cascade >= 500000
      ? "CRITICAL"
      : "HIGH"
    : "CRITICAL";

  const failedLabels = failed.map((child) => child.label).join(", ");
  const explanation = early.length
    ? failed.length
      ? `${failedLabels} passed the deadline and ${failed.length === 1 ? "is" : "are"} recorded as an exception. This warning remains only for deliveries that have not failed.`
      : `${worst.label} depends on ${shipment.name}. The shipment is projected ${formatHours(worst.shortfallHours)} after the customer deadline. Failure has not occurred.`
    : `The deadline for ${worst.label} has passed and the shipment is still late. This is an exception, not an early warning.`;

  saveWarning(db, {
    ...baseDelivery(warningId, shipment, worst, children, evidence, cascade, cashAmount, currency),
    projectedAt: projected,
    status,
    severity,
    bufferState: "AT_RISK",
    summary: "Customer delivery may miss current expectation.",
    explanation,
    exceptionId,
    learning: learningContext(existing, {
      warningId,
      problem_type: "delivery_shortfall",
      entity_type: shipment.type,
      entity_id: shipment.id,
      valueAmount: cascade,
      silenceBand: "deadline",
      exceptionId,
    }),
  }, now);
}

function baseDelivery(
  warningId: string,
  shipment: EntityRow,
  focus: WarningChild,
  children: WarningChild[],
  evidence: WarningEvidence,
  cascade: number,
  cashAmount: number,
  currency: string,
): Omit<Draft, "status" | "severity" | "bufferState" | "summary" | "explanation" | "exceptionId" | "learning"> {
  return {
    id: warningId,
    kind: "delivery_shortfall",
    entityType: shipment.type,
    entityId: shipment.id,
    entityLabel: shipment.name,
    headline: `${focus.label} delivery`,
    availableHours: focus.availableHours,
    requiredHours: focus.requiredHours,
    shortfallHours: focus.shortfallHours,
    bufferHours: focus.bufferHours,
    deadlineAt: focus.deadlineAt,
    projectedAt: null,
    valueAmount: cascade,
    currency,
    cashAmount,
    confidence: evidence.confidence,
    source: "Supplier delay",
    sourceEventId: evidence.eventId,
    domain: "operations",
    evidence,
    children,
  };
}

function evaluateInactivity(db: DatabaseSync, opportunity: EntityRow, now: string) {
  const payload = parsePayload(opportunity.payload);
  const contactId = stringField(payload, "contactId");
  const activity = latestCustomerActivity(db, opportunity.id, contactId);
  if (!activity) return;

  const silenceHours = Math.max(0, hoursBetween(activity.occurred_at, now));
  const remaining = INACTIVITY_WINDOW_HOURS - silenceHours;
  const amount = numberField(payload, "amount") || 320000;
  const currency = stringField(payload, "currency") || "DZD";
  const warningId = `wrn_${opportunity.id}`;
  const existing = getWarningRow(db, warningId);
  const openMiss = one<{ id: string; title: string }>(
    db,
    "SELECT id, title FROM exceptions WHERE opportunity_id = ? AND status != 'resolved' AND (warning_id IS NULL OR warning_id != ?) LIMIT 1",
    [opportunity.id, warningId],
  );

  const evidence: WarningEvidence = {
    source: "Historical pattern",
    quote: "No next action is inside the 4-day inactivity window.",
    eventId: activity.id,
    eventType: activity.type,
    occurredAt: activity.occurred_at,
    path: [{ id: opportunity.id, type: opportunity.type, label: opportunity.name }],
    confidence: INACTIVITY_CONFIDENCE,
  };

  const otherProblem = openMiss
    ? ` The open exception “${openMiss.title}” is a commitment that already failed. This warning is the inactivity window, which is a different problem.`
    : "";

  if (remaining <= 0) {
    const exceptionId = ensureInactivityException(db, warningId, opportunity, amount, currency, now, evidence);
    saveWarning(db, {
      id: warningId,
      status: "TRANSITIONED",
      severity: "HIGH",
      bufferState: "AT_RISK",
      kind: "inactivity_window",
      entityType: opportunity.type,
      entityId: opportunity.id,
      entityLabel: opportunity.name,
      headline: `Opportunity ${formatCompact(amount)}`,
      summary: "The inactivity window has been crossed.",
      explanation: `Silence reached the 4-day window. This is an exception, not an early warning.${otherProblem}`,
      availableHours: silenceHours,
      requiredHours: INACTIVITY_WINDOW_HOURS,
      shortfallHours: Math.abs(remaining),
      bufferHours: remaining,
      deadlineAt: null,
      projectedAt: null,
      valueAmount: amount,
      currency,
      cashAmount: 0,
      confidence: INACTIVITY_CONFIDENCE,
      source: "Historical pattern",
      sourceEventId: activity.id,
      domain: "customers",
      exceptionId,
      evidence,
      children: [],
      learning: learningContext(existing, {
        warningId,
        problem_type: "inactivity_window",
        entity_type: opportunity.type,
        entity_id: opportunity.id,
        valueAmount: amount,
        silenceBand: "3-7d",
        exceptionId,
      }),
    }, now);
    return;
  }

  if (remaining > INACTIVITY_APPROACH_HOURS) {
    if (existing && existing.status === "ACTIVE") {
      resolveDraft(db, existing, now, "Customer activity is outside the approach window. This early warning is resolved.");
    }
    return;
  }

  saveWarning(db, {
    id: warningId,
    status: "ACTIVE",
    severity: "MONITORING",
    bufferState: "TIGHT",
    kind: "inactivity_window",
    entityType: opportunity.type,
    entityId: opportunity.id,
    entityLabel: opportunity.name,
    headline: `Opportunity ${formatCompact(amount)}`,
    summary: "Approaching a historically problematic inactivity window.",
    explanation: `No customer activity for ${formatHours(silenceHours)}. The window is ${formatHours(INACTIVITY_WINDOW_HOURS)}, with ${formatHours(remaining)} remaining. Failure has not occurred.${otherProblem}`,
    availableHours: silenceHours,
    requiredHours: INACTIVITY_WINDOW_HOURS,
    shortfallHours: 0,
    bufferHours: remaining,
    deadlineAt: null,
    projectedAt: null,
    valueAmount: amount,
    currency,
    cashAmount: 0,
    confidence: INACTIVITY_CONFIDENCE,
    source: "Historical pattern",
    sourceEventId: activity.id,
    domain: "customers",
    exceptionId: null,
    evidence,
    children: [],
    learning: learningContext(existing, {
      warningId,
      problem_type: "inactivity_window",
      entity_type: opportunity.type,
      entity_id: opportunity.id,
      valueAmount: amount,
      silenceBand: "3-7d",
      exceptionId: null,
    }),
  }, now);
}

function ensureDeliveryException(
  db: DatabaseSync,
  warningId: string,
  failed: WarningChild[],
  shipment: EntityRow,
  evidence: WarningEvidence,
  cascade: number,
  cashAmount: number,
  currency: string,
  now: string,
): string {
  const existing = one<{ id: string }>(
    db,
    "SELECT id FROM exceptions WHERE warning_id = ? AND status != 'resolved' LIMIT 1",
    [warningId],
  );
  if (existing) return existing.id;

  const worst = worstChild(failed);
  const exceptionId = `exc_${warningId}`;
  const impact: Impact = {
    customersAffected: failed.length,
    opportunitiesAffected: 0,
    revenueAssociated: failed.reduce((sum, child) => sum + child.valueAmount, 0),
    currency,
    cashTimingAffected: cashAmount > 0,
    urgency: "high",
    notes: `Transitioned from early warning ${warningId}. ${shipment.name} was still late when the deadline passed. Cascade exposure ${cascade.toLocaleString("en-US")} ${currency}.`,
  };
  const pack: EvidencePack = {
    source: evidence.source,
    quote: evidence.quote,
    expected: `${worst.label} by ${worst.deadlineAt}`,
    actual: `Deadline passed. Shipment still projected after the deadline. Live record for warning ${warningId}.`,
    deal: `${cascade.toLocaleString("en-US")} ${currency}`,
    confidence: evidence.confidence,
  };
  run(
    db,
    `INSERT INTO exceptions
      (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at, warning_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exceptionId,
      `Delivery missed — ${worst.label}`,
      "delivery_missed",
      null,
      null,
      "NEEDS_YOU",
      "critical",
      "high",
      JSON.stringify(impact),
      JSON.stringify(pack),
      evidence.confidence,
      "open",
      now,
      warningId,
    ],
  );
  return exceptionId;
}

function ensureInactivityException(
  db: DatabaseSync,
  warningId: string,
  opportunity: EntityRow,
  amount: number,
  currency: string,
  now: string,
  evidence: WarningEvidence,
): string {
  const existing = one<{ id: string }>(
    db,
    "SELECT id FROM exceptions WHERE warning_id = ? AND status != 'resolved' LIMIT 1",
    [warningId],
  );
  if (existing) return existing.id;
  const exceptionId = `exc_${warningId}`;
  const impact: Impact = {
    customersAffected: 1,
    opportunitiesAffected: 1,
    revenueAssociated: amount,
    currency,
    cashTimingAffected: false,
    urgency: "medium",
    notes: `Transitioned from early warning ${warningId}. The 4-day inactivity window was crossed.`,
  };
  const pack: EvidencePack = {
    source: evidence.source,
    quote: evidence.quote,
    expected: "A next action before the 4-day inactivity window",
    actual: `Window crossed. This exception is the live record for warning ${warningId}.`,
    deal: `${amount.toLocaleString("en-US")} ${currency}`,
    confidence: evidence.confidence,
  };
  run(
    db,
    `INSERT INTO exceptions
      (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at, warning_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exceptionId,
      `Inactivity window crossed — ${opportunity.name}`,
      "inactivity_window",
      null,
      opportunity.id,
      "NEEDS_YOU",
      "high",
      "medium",
      JSON.stringify(impact),
      JSON.stringify(pack),
      evidence.confidence,
      "open",
      now,
      warningId,
    ],
  );
  return exceptionId;
}

function resolveDraft(db: DatabaseSync, existing: WarningRow, now: string, explanation: string) {
  const view = toWarningView(existing);
  saveWarning(db, {
    id: existing.id,
    status: "RESOLVED",
    severity: "MONITORING",
    bufferState: view.bufferState === "AT_RISK" ? "SAFE" : view.bufferState,
    kind: existing.kind,
    entityType: existing.entity_type,
    entityId: existing.entity_id,
    entityLabel: existing.entity_label,
    headline: existing.headline,
    summary: existing.summary,
    explanation,
    availableHours: existing.available_hours,
    requiredHours: existing.required_hours,
    shortfallHours: 0,
    bufferHours: existing.buffer_hours,
    deadlineAt: existing.deadline_at,
    projectedAt: existing.projected_at,
    valueAmount: existing.value_amount,
    currency: existing.currency,
    cashAmount: existing.cash_amount,
    confidence: existing.confidence,
    source: existing.source,
    sourceEventId: existing.source_event_id,
    domain: existing.domain,
    exceptionId: existing.exception_id,
    evidence: view.evidence,
    children: view.children,
    learning: { ...view.learning, exception_id: existing.exception_id },
  }, now);
}

function saveWarning(db: DatabaseSync, draft: Draft, now: string) {
  const existing = getWarningRow(db, draft.id);
  const learning = mergeLearning(existing, draft.learning);
  const resolvedAt =
    draft.status === "ACTIVE" ? null : existing?.resolved_at && existing.status !== "ACTIVE" ? existing.resolved_at : now;
  run(
    db,
    `INSERT INTO warnings (
      id, status, severity, buffer_state, kind, entity_type, entity_id, entity_label, headline, summary, explanation,
      available_hours, required_hours, shortfall_hours, buffer_hours, deadline_at, projected_at, value_amount, currency,
      cash_amount, confidence, source, source_event_id, domain, exception_id, evidence_json, children_json, context_json,
      created_at, updated_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      severity = excluded.severity,
      buffer_state = excluded.buffer_state,
      kind = excluded.kind,
      entity_type = excluded.entity_type,
      entity_id = excluded.entity_id,
      entity_label = excluded.entity_label,
      headline = excluded.headline,
      summary = excluded.summary,
      explanation = excluded.explanation,
      available_hours = excluded.available_hours,
      required_hours = excluded.required_hours,
      shortfall_hours = excluded.shortfall_hours,
      buffer_hours = excluded.buffer_hours,
      deadline_at = excluded.deadline_at,
      projected_at = excluded.projected_at,
      value_amount = excluded.value_amount,
      currency = excluded.currency,
      cash_amount = excluded.cash_amount,
      confidence = excluded.confidence,
      source = excluded.source,
      source_event_id = excluded.source_event_id,
      domain = excluded.domain,
      exception_id = excluded.exception_id,
      evidence_json = excluded.evidence_json,
      children_json = excluded.children_json,
      context_json = excluded.context_json,
      updated_at = excluded.updated_at,
      resolved_at = excluded.resolved_at`,
    [
      draft.id,
      draft.status,
      draft.severity,
      draft.bufferState,
      draft.kind,
      draft.entityType,
      draft.entityId,
      draft.entityLabel,
      draft.headline,
      draft.summary,
      draft.explanation,
      draft.availableHours,
      draft.requiredHours,
      draft.shortfallHours,
      draft.bufferHours,
      draft.deadlineAt,
      draft.projectedAt,
      draft.valueAmount,
      draft.currency,
      draft.cashAmount,
      draft.confidence,
      draft.source,
      draft.sourceEventId,
      draft.domain,
      draft.exceptionId,
      JSON.stringify(draft.evidence),
      JSON.stringify(draft.children),
      JSON.stringify(learning),
      existing?.created_at || now,
      now,
      resolvedAt,
    ],
  );
}

export function attachWarningIntervention(
  db: DatabaseSync,
  warningId: string,
  actionId: string,
  now: string,
) {
  const row = getWarningRow(db, warningId);
  if (!row) return;
  const view = toWarningView(row);
  const verification = one<{ id: string }>(db, "SELECT id FROM verifications WHERE action_id = ? LIMIT 1", [actionId]);
  const outcome = one<{ id: string }>(db, "SELECT id FROM outcomes WHERE action_id = ? LIMIT 1", [actionId]);
  view.learning.action_id = actionId;
  view.learning.verification_id = verification?.id ?? view.learning.verification_id;
  view.learning.outcome_id = outcome?.id ?? view.learning.outcome_id;
  run(db, "UPDATE warnings SET context_json = ?, updated_at = ? WHERE id = ?", [
    JSON.stringify(view.learning),
    now,
    warningId,
  ]);
}

function learningContext(
  existing: WarningRow | undefined,
  input: {
    warningId: string;
    problem_type: string;
    entity_type: string;
    entity_id: string;
    valueAmount: number;
    silenceBand: string;
    exceptionId: string | null;
  },
): WarningLearningContext {
  const previous = existing ? (JSON.parse(existing.context_json) as WarningLearningContext) : null;
  return {
    warningId: input.warningId,
    problem_type: input.problem_type,
    context_signature: buildContextSignature({
      problem_type: input.problem_type,
      customer_type: "existing",
      value_band: valueBand(input.valueAmount),
      silence_band: input.silenceBand,
    }),
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    exception_id: input.exceptionId,
    action_id: previous?.action_id ?? null,
    verification_id: previous?.verification_id ?? null,
    outcome_id: previous?.outcome_id ?? null,
  };
}

function mergeLearning(existing: WarningRow | undefined, next: WarningLearningContext): WarningLearningContext {
  if (!existing) return next;
  const previous = JSON.parse(existing.context_json) as WarningLearningContext;
  return {
    ...next,
    action_id: next.action_id ?? previous.action_id,
    verification_id: next.verification_id ?? previous.verification_id,
    outcome_id: next.outcome_id ?? previous.outcome_id,
  };
}

function cashDownstream(
  downstream: { id: string; path: string[] }[],
  entities: Map<string, EntityRow>,
  atRiskOrderIds: Set<string>,
): number {
  let cash = 0;
  for (const node of downstream) {
    const entity = entities.get(node.id);
    if (!entity || entity.type !== "payment") continue;
    if (!node.path.some((hop) => atRiskOrderIds.has(hop))) continue;
    cash += numberField(parsePayload(entity.payload), "amount");
  }
  return cash;
}

function pathHops(path: string[], entities: Map<string, EntityRow>, shipment: EntityRow): EvidenceHop[] {
  return path.map((hop) => {
    const entity = entities.get(hop);
    return {
      id: hop,
      type: entity?.type || (hop === shipment.id ? shipment.type : "entity"),
      label: entity?.name || shipment.name,
    };
  });
}

function buildEvidence(
  event: { id: string; type: string; occurred_at: string; payload: string; confidence: number } | undefined,
  path: EvidenceHop[],
  source: string,
  fallbackConfidence: number,
): WarningEvidence {
  const payload = event ? parsePayload(event.payload) : {};
  return {
    source,
    quote: stringField(payload, "quote") || stringField(payload, "text") || "Shipment projection updated.",
    eventId: event?.id ?? null,
    eventType: event?.type ?? null,
    occurredAt: event?.occurred_at ?? null,
    path,
    confidence: event?.confidence ?? fallbackConfidence,
  };
}

function latestDelayEvent(db: DatabaseSync, shipmentId: string) {
  return one<{ id: string; type: string; occurred_at: string; payload: string; confidence: number }>(
    db,
    "SELECT id, type, occurred_at, payload, confidence FROM events WHERE type = 'shipment.delayed' AND entity_id = ? ORDER BY occurred_at DESC LIMIT 1",
    [shipmentId],
  );
}

function latestCustomerActivity(db: DatabaseSync, opportunityId: string, contactId: string | null) {
  return one<{ id: string; type: string; occurred_at: string }>(
    db,
    `SELECT id, type, occurred_at FROM events
     WHERE type IN ('message.received', 'customer.replied')
       AND (entity_id = ? OR entity_id = ? OR actor_id = ? OR actor_id = ?)
     ORDER BY occurred_at DESC
     LIMIT 1`,
    [opportunityId, contactId || "", opportunityId, contactId || IDS.contact],
  );
}

function resolveOpportunity(db: DatabaseSync, start: EntityRow): EntityRow | undefined {
  if (start.type === "opportunity") return start;
  if (start.type === "contact") {
    return one<EntityRow>(
      db,
      "SELECT * FROM entities WHERE type = 'opportunity' AND payload LIKE ? LIMIT 1",
      [`%${start.id}%`],
    );
  }
  return undefined;
}

function worstChild(children: WarningChild[]): WarningChild {
  return [...children].sort((a, b) => b.shortfallHours - a.shortfallHours || a.label.localeCompare(b.label))[0];
}

function loadEntities(db: DatabaseSync, ids: string[]): Map<string, EntityRow> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = all<EntityRow>(
    db,
    `SELECT * FROM entities WHERE id IN (${unique.map(() => "?").join(",")})`,
    unique,
  );
  return new Map(rows.map((row) => [row.id, row]));
}

function parsePayload(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringField(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length ? value : null;
}

function numberField(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatCompact(amount: number): string {
  if (amount >= 1000 && amount % 1000 === 0) return `${amount / 1000}K`;
  return amount.toLocaleString("en-US");
}
