import type { DatabaseSync } from "node:sqlite";
import { all, one, run } from "../db";
import { id } from "../ids";
import {
  confidenceFromObservations,
  formatObservedRate,
  patternStatusFromObservations,
  successRate,
} from "./confidence";
import { buildContextSignature, isLearningCompatibleKind, SEED_FOLLOWUP_SIGNATURE } from "./context";
import type {
  ContextFields,
  HistoricallyStronger,
  LearnedPatternRow,
  OutcomeRow,
  StrategyEvidence,
  StrategyEvidenceBundle,
} from "./types";

const STRATEGY_LABELS: Record<string, string> = {
  personalized_followup: "Personalized follow-up",
  generic_followup: "Generic follow-up",
  call_first: "Call first",
};

export function strategyLabel(strategy: string): string {
  return STRATEGY_LABELS[strategy] || strategy.replaceAll("_", " ");
}

export class StrategyMemory {
  constructor(private readonly db: DatabaseSync) {}

  static for(db: DatabaseSync) {
    return new StrategyMemory(db);
  }

  listOutcomes(contextSignature: string): OutcomeRow[] {
    return all<OutcomeRow>(
      this.db,
      "SELECT * FROM outcomes WHERE context_signature = ? ORDER BY created_at, id",
      [contextSignature],
    );
  }

  aggregateByStrategy(contextSignature: string): StrategyEvidence[] {
    const rows = this.listOutcomes(contextSignature);
    const grouped = new Map<string, OutcomeRow[]>();
    for (const row of rows) {
      const list = grouped.get(row.strategy) || [];
      list.push(row);
      grouped.set(row.strategy, list);
    }

    const evidence: StrategyEvidence[] = [];
    for (const [strategy, group] of grouped) {
      const observations = group.length;
      const successes = group.filter((r) => Number(r.success) === 1).length;
      const failures = observations - successes;
      const rate = successRate(successes, observations);
      const status = patternStatusFromObservations(observations);
      const synthetic = group.filter((r) => isSyntheticOutcome(r)).length;
      evidence.push({
        strategy,
        label: strategyLabel(strategy),
        observations,
        successes,
        failures,
        success_rate: rate,
        pattern_status: status,
        confidence: confidenceFromObservations(observations),
        evidence: `${strategyLabel(strategy)} had a ${formatObservedRate(successes, observations)}.`,
        synthetic_observations: synthetic,
      });
    }

    evidence.sort((a, b) => {
      if (b.success_rate !== a.success_rate) return b.success_rate - a.success_rate;
      return b.observations - a.observations;
    });
    return evidence;
  }

  getStrategyEvidence(context: ContextFields | string): StrategyEvidenceBundle {
    const signature = typeof context === "string" ? context : buildContextSignature(context);
    const strategies = this.aggregateByStrategy(signature);
    const stronger = pickHistoricallyStronger(strategies);
    return {
      context_signature: signature,
      compatible: signature === SEED_FOLLOWUP_SIGNATURE || strategies.length > 0,
      strategies,
      historically_stronger_strategy: stronger,
      note: "Rates are aggregated from stored outcome rows. They are observations, not predictions, and they do not override policy.",
    };
  }

  refreshPatterns(contextSignature: string, now: string): LearnedPatternRow[] {
    const aggregates = this.aggregateByStrategy(contextSignature);
    const upserted: LearnedPatternRow[] = [];
    for (const item of aggregates) {
      const existing = one<LearnedPatternRow>(
        this.db,
        "SELECT * FROM learned_patterns WHERE context_signature = ? AND strategy = ? AND pattern_type = ?",
        [contextSignature, item.strategy, "strategy_performance"],
      );
      const first = existing?.first_observed_at || now;
      if (existing) {
        run(
          this.db,
          `UPDATE learned_patterns
           SET observations = ?, successes = ?, failures = ?, success_rate = ?, confidence = ?,
               status = ?, last_updated_at = ?, metadata = ?
           WHERE id = ?`,
          [
            item.observations,
            item.successes,
            item.failures,
            item.success_rate,
            item.confidence,
            item.pattern_status,
            now,
            JSON.stringify({ derived_from_rows: true, synthetic_observations: item.synthetic_observations }),
            existing.id,
          ],
        );
        upserted.push(this.getPattern(existing.id)!);
      } else {
        const rowId = id("pat");
        run(
          this.db,
          `INSERT INTO learned_patterns
            (id, pattern_type, context_signature, strategy, observations, successes, failures,
             success_rate, confidence, status, first_observed_at, last_updated_at, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rowId,
            "strategy_performance",
            contextSignature,
            item.strategy,
            item.observations,
            item.successes,
            item.failures,
            item.success_rate,
            item.confidence,
            item.pattern_status,
            first,
            now,
            JSON.stringify({ derived_from_rows: true, synthetic_observations: item.synthetic_observations }),
          ],
        );
        upserted.push(this.getPattern(rowId)!);
      }
    }
    return upserted;
  }

  getPattern(patternId: string): LearnedPatternRow | undefined {
    return one<LearnedPatternRow>(this.db, "SELECT * FROM learned_patterns WHERE id = ?", [patternId]);
  }

  listPatterns(contextSignature?: string): LearnedPatternRow[] {
    if (contextSignature) {
      return all<LearnedPatternRow>(
        this.db,
        "SELECT * FROM learned_patterns WHERE context_signature = ? ORDER BY success_rate DESC",
        [contextSignature],
      );
    }
    return all<LearnedPatternRow>(this.db, "SELECT * FROM learned_patterns ORDER BY success_rate DESC");
  }
}

export function pickHistoricallyStronger(strategies: StrategyEvidence[]): HistoricallyStronger | null {
  const ranked = strategies.filter((s) => s.observations > 0);
  if (ranked.length === 0) return null;
  const best = ranked[0];
  const allSynthetic = best.synthetic_observations === best.observations;
  const caseWord = allSynthetic ? "comparable synthetic cases" : "comparable recorded cases";
  return {
    strategy: best.strategy,
    label: best.label,
    observations: best.observations,
    success_rate: best.success_rate,
    wording: `${best.label} has the strongest recorded outcome in ${best.observations} ${caseWord}.`,
  };
}

export function evidenceForCompatibleKind(
  db: DatabaseSync,
  kind: string,
  signature = SEED_FOLLOWUP_SIGNATURE,
): StrategyEvidenceBundle | null {
  if (!isLearningCompatibleKind(kind)) return null;
  return StrategyMemory.for(db).getStrategyEvidence(signature);
}

function isSyntheticOutcome(row: OutcomeRow): boolean {
  return (
    (row.exception_id || "").startsWith("syn_") ||
    (row.id || "").startsWith("syn_out_") ||
    (row.business_effect || "").includes("synthetic")
  );
}
