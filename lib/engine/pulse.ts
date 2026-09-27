import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { id, IDS } from "../ids";
import { calculateImpact } from "./impact";
import { businessTwin } from "./twin";
import { refreshExpectations } from "./expectations";
import { ExceptionAutopilotService } from "../autopilot";
import { EarlyWarningEngine } from "../warnings";
import type {
  Attention,
  CommitmentRow,
  EntityRow,
  EvidencePack,
  ExceptionRow,
  ExpectationRow,
  Impact,
} from "../types";

export function detectExceptions(db: DatabaseSync, now: string) {
  refreshExpectations(db, now);
  const missed = all<ExpectationRow>(
    db,
    "SELECT * FROM expectations WHERE status = 'MISSED'",
  );

  for (const exp of missed) {
    const existing = one<ExceptionRow>(
      db,
      "SELECT * FROM exceptions WHERE expectation_id = ? AND status != 'resolved'",
      [exp.id],
    );
    if (existing) continue;

    const commitment = one<CommitmentRow>(db, "SELECT * FROM commitments WHERE id = ?", [exp.commitment_id]);
    if (commitment?.actor !== "company") continue;
    const impact = calculateImpact(db);
    const evidence: EvidencePack = {
      source: "Customer conversation",
      quote: commitment?.evidence || "",
      expected: exp.description,
      actual: exp.actual || "No fulfilment event recorded",
      deal: `${impact.revenueAssociated.toLocaleString("en-US")} ${impact.currency}`,
      confidence: commitment?.confidence ?? 0.9,
    };

    const isOurs = commitment?.actor === "company";
    run(
      db,
      `INSERT INTO exceptions
        (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        exp.id === IDS.expectOurs ? IDS.excMissed : id("exc"),
        exp.id === IDS.expectOurs
          ? "Our commitment missed — revised proposal never sent"
          : isOurs
            ? `Commitment missed — ${commitment?.description || exp.description}`
            : "Customer decision blocked by our missed proposal",
        "commitment_missed",
        exp.id,
        IDS.opportunity,
        "NEEDS_YOU",
        "critical",
        "high",
        JSON.stringify(impact),
        JSON.stringify(evidence),
        evidence.confidence,
        "open",
        now,
      ],
    );
    eventsFor(db).append({
      type: EVENT_TYPES.COMMITMENT_MISSED,
      source: "pulse-engine",
      source_id: exp.id,
      actor_id: commitment?.actor_entity_id || IDS.company,
      entity_type: "commitment",
      entity_id: commitment?.id || exp.commitment_id,
      payload: {
        expectationId: exp.id,
        expected: exp.description,
        actual: exp.actual || "No fulfilment event recorded",
      },
      occurred_at: exp.due_at,
      received_at: now,
      confidence: evidence.confidence,
      idempotent: true,
    });
  }
}

export function pulseSummary(db: DatabaseSync, now: string) {
  detectExceptions(db, now);
  const warningEngine = EarlyWarningEngine.for(db);
  for (const warning of warningEngine.getActiveWarnings()) {
    if (!warning.expectation_id) continue;
    const due = one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [warning.expectation_id]);
    if (due && new Date(due.due_at).getTime() < new Date(now).getTime()) {
      warningEngine.escalateToException(warning.expectation_id, now);
    }
  }
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions ORDER BY created_at DESC");
  const counts = {
    NEEDS_YOU: exceptions.filter((e) => e.attention === "NEEDS_YOU").length,
    MONITORING: exceptions.filter((e) => e.attention === "MONITORING").length,
    HANDLED: exceptions.filter((e) => e.attention === "HANDLED").length,
    HEALTHY: exceptions.filter((e) => e.attention === "HEALTHY").length,
  };
  const needYou = exceptions.filter((e) => e.attention === "NEEDS_YOU");
  const impactTotal = needYou.reduce((sum, e) => {
    const impact = JSON.parse(e.impact_json) as Impact;
    return sum + (impact.revenueAssociated || 0);
  }, 0);
  const opportunity = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [IDS.opportunity]);
  const contact = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [IDS.contact]);
  const company = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [IDS.company]);
  const delay = needYou.find((e) => e.id === IDS.excDelay);
  const otherNeed = needYou.filter((e) => e.id !== IDS.excDelay);
  const headline =
    delay && otherNeed.length
      ? "2 critical situations require attention"
      : impactTotal > 0
        ? `${impactTotal.toLocaleString("en-US")} DZD requires attention`
        : "Nothing needs you";

  return {
    now,
    greeting: "Good morning.",
    headline,
    counts,
    exceptions: exceptions.map(serializeException),
    opportunity,
    contact,
    company,
    twin: businessTwin(db),
    supplierPhase: one<{ value: string }>(db, "SELECT value FROM meta WHERE key = ?", ["supplier_phase"])?.value || "stable",
    comingNext: warningEngine.getActiveWarnings().map((row) => warningEngine.summarize(row)),
    autopilot: ExceptionAutopilotService.for(db).evaluateSituation(now),
  };
}

export function serializeException(row: ExceptionRow) {
  return {
    ...row,
    impact: JSON.parse(row.impact_json) as Impact,
    evidence: JSON.parse(row.evidence_json) as EvidencePack,
    attention: row.attention as Attention,
  };
}
