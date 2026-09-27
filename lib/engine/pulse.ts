import type { DatabaseSync } from "node:sqlite";
import { all, one } from "../db";
import { IDS } from "../ids";
import { projectAttention } from "../attention";
import { ExceptionAutopilotService } from "../autopilot";
import { EarlyWarningEngine } from "../warnings";
import { businessTwin } from "./twin";
import { detectFromClock } from "./matcher";
import { canonicalExceptionType } from "./exception-types";
import type {
  Attention,
  EntityRow,
  EvidencePack,
  ExceptionRow,
  ExpectationRow,
  Impact,
} from "../types";

export function detectExceptions(db: DatabaseSync, now: string) {
  detectFromClock(db, now);
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
  const attention = projectAttention(db, now);
  const counts = {
    NEEDS_YOU: exceptions.filter((e) => e.attention === "NEEDS_YOU").length,
    MONITORING: exceptions.filter((e) => e.attention === "MONITORING").length,
    HANDLED: exceptions.filter((e) => e.attention === "HANDLED").length,
    HEALTHY: exceptions.filter((e) => e.attention === "HEALTHY").length,
  };
  const impactTotal = attention.needsMe.reduce((sum, item) => sum + (item.impact.associatedRevenue || 0), 0);
  const opportunity = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [IDS.opportunity]);
  const contact = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [IDS.contact]);
  const company = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [IDS.company]);
  const delay = attention.needsMe.find((item) => item.sourceExceptionId === IDS.excDelay);
  const otherNeed = attention.needsMe.filter((item) => item.sourceExceptionId !== IDS.excDelay);
  const headline =
    delay && otherNeed.length
      ? "2 critical situations require attention"
      : impactTotal > 0
        ? `${impactTotal.toLocaleString("en-US")} DZD requires attention`
        : attention.needsMe.length
          ? attention.needsMe[0].title
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
    attention,
    autopilot: ExceptionAutopilotService.for(db).evaluateSituation(now),
  };
}

export function serializeException(row: ExceptionRow) {
  return {
    ...row,
    kind: canonicalExceptionType(row.kind),
    type: canonicalExceptionType(row.kind),
    detected_at: row.detected_at || row.created_at,
    impact: JSON.parse(row.impact_json) as Impact,
    evidence: JSON.parse(row.evidence_json) as EvidencePack,
    attention: row.attention as Attention,
  };
}
