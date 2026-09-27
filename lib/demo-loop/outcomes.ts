import type { DatabaseSync } from "node:sqlite";
import { all } from "../db";

/**
 * Before/after outcome metrics, derived only from engine state:
 * - exposure: each situation's impact_json (associated revenue and expected cash timing kept apart)
 * - timing: when the engine detected it vs the deadline in the data when it would otherwise surface
 * - protected: value of situations HANDLED through a SUCCESS verification (0 until verified)
 */

export type OutcomeSituation = {
  exceptionId: string;
  title: string;
  kind: string;
  attention: string;
  status: string;
  opportunityId: string | null;
  associatedRevenue: number;
  expectedCashTiming: number | null;
  detectedAt: string;
  wouldSurfaceAt: string | null;
  surfaceBasis: string;
  /** Positive: detected this many minutes before the deadline. Negative: detected after it was due. */
  leadMinutes: number | null;
  verified: boolean;
  pendingVerification: boolean;
};

export type PulseOutcome = {
  currency: string;
  exposure: OutcomeSituation[];
  protected: {
    associatedRevenue: number;
    expectedCashTiming: number;
    verifiedSituations: number;
    pendingVerification: number;
  };
};

type ExceptionRow = {
  id: string;
  title: string;
  kind: string;
  attention: string;
  status: string;
  expectation_id: string | null;
  opportunity_id: string | null;
  impact_json: string;
  created_at: string;
  detected_at: string | null;
};

export function pulseOutcome(db: DatabaseSync): PulseOutcome {
  const exceptions = all<ExceptionRow>(
    db,
    `SELECT id, title, kind, attention, status, expectation_id, opportunity_id, impact_json, created_at, detected_at
     FROM exceptions WHERE status != 'dismissed' ORDER BY created_at, id`,
  );
  const verifications = all<{ exception_id: string; status: string }>(db, "SELECT exception_id, status FROM verifications");
  const warnings = tableExists(db, "early_warnings")
    ? all<{ expected_failure_at: string; expectation_id: string | null }>(
        db,
        "SELECT expected_failure_at, expectation_id FROM early_warnings WHERE warning_type = 'DEADLINE_BUFFER' ORDER BY expected_failure_at",
      )
    : [];
  let currency = "DZD";

  const exposure = exceptions
    .map((row): OutcomeSituation | null => {
      const impact = parse(row.impact_json);
      const associatedRevenue = num(impact.revenueAssociated);
      if (!associatedRevenue) return null;
      if (typeof impact.currency === "string") currency = impact.currency;
      const detectedAt = row.detected_at || row.created_at;
      const { at, basis } = surfaceDeadline(db, row, warnings);
      const verified =
        row.attention === "HANDLED" &&
        row.status === "resolved" &&
        verifications.some((v) => v.exception_id === row.id && v.status === "SUCCESS");
      return {
        exceptionId: row.id,
        title: row.title,
        kind: row.kind,
        attention: row.attention,
        status: row.status,
        opportunityId: row.opportunity_id,
        associatedRevenue,
        expectedCashTiming: impact.affectedExpectedCash === undefined ? null : num(impact.affectedExpectedCash),
        detectedAt,
        wouldSurfaceAt: at,
        surfaceBasis: basis,
        leadMinutes: at ? Math.round((Date.parse(at) - Date.parse(detectedAt)) / 60_000) : null,
        verified,
        pendingVerification: !verified && verifications.some((v) => v.exception_id === row.id && v.status === "PENDING"),
      };
    })
    .filter((item): item is OutcomeSituation => Boolean(item))
    .sort((a, b) => b.associatedRevenue - a.associatedRevenue || a.exceptionId.localeCompare(b.exceptionId));

  // Two situations on the same opportunity (missed proposal + blocked discount) protect one deal, not two.
  const perOpportunity = new Map<string, number>();
  let expectedCashTiming = 0;
  for (const item of exposure.filter((entry) => entry.verified)) {
    const key = item.opportunityId || item.exceptionId;
    perOpportunity.set(key, Math.max(perOpportunity.get(key) || 0, item.associatedRevenue));
    expectedCashTiming += item.expectedCashTiming || 0;
  }
  return {
    currency,
    exposure,
    protected: {
      associatedRevenue: [...perOpportunity.values()].reduce((sum, value) => sum + value, 0),
      expectedCashTiming,
      verifiedSituations: exposure.filter((entry) => entry.verified).length,
      pendingVerification: exposure.filter((entry) => entry.pendingVerification).length,
    },
  };
}

/** The deadline in the data when this problem would surface on its own. */
function surfaceDeadline(
  db: DatabaseSync,
  row: ExceptionRow,
  warnings: { expected_failure_at: string; expectation_id: string | null }[],
): { at: string | null; basis: string } {
  if (row.kind === "delivery_delay" && warnings.length) {
    const warning = warnings[0];
    const expectation = warning.expectation_id ? expectationById(db, warning.expectation_id) : null;
    return {
      at: warning.expected_failure_at,
      basis: expectation ? `Customer deadline: ${expectation.description}` : "Customer delivery deadline",
    };
  }
  if (row.expectation_id) {
    const expectation = expectationById(db, row.expectation_id);
    if (expectation) return { at: expectation.due_at, basis: `Commitment due: ${expectation.description}` };
  }
  return { at: null, basis: "No deadline recorded for this situation" };
}

function expectationById(db: DatabaseSync, id: string) {
  return all<{ description: string; due_at: string }>(db, "SELECT description, due_at FROM expectations WHERE id = ?", [id])[0] || null;
}

function tableExists(db: DatabaseSync, name: string) {
  return all(db, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [name]).length > 0;
}

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function parse(raw: string | null | undefined): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}
