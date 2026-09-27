import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { id, IDS } from "../ids";
import { calculateImpact } from "./impact";
import { refreshExpectations } from "./expectations";
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
        isOurs
          ? "Our commitment missed — revised proposal never sent"
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
  }
}

export function pulseSummary(db: DatabaseSync, now: string) {
  detectExceptions(db, now);
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

  return {
    now,
    greeting: "Good morning.",
    headline: impactTotal > 0 ? `${impactTotal.toLocaleString("en-US")} DZD requires attention` : "Nothing needs you",
    counts,
    exceptions: exceptions.map(serializeException),
    opportunity,
    contact,
    company,
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
