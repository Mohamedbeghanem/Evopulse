import type { PatternStatus } from "./types";

/**
 * Centralized learning-confidence thresholds.
 * Observation count owns the status. An LLM must never assign these.
 *
 * RELIABLE_PATTERN is not permission to auto-execute.
 * CANDIDATE_AUTOMATION / APPROVED_AUTOMATION require policy + human approval.
 */
export const LEARNING_THRESHOLDS = {
  INSUFFICIENT_DATA_MAX: 4,
  EMERGING_PATTERN_MAX: 14,
  RELIABLE_PATTERN_MIN: 15,
} as const;

export const AUTOMATION_STATUSES = new Set<PatternStatus>([
  "CANDIDATE_AUTOMATION",
  "APPROVED_AUTOMATION",
]);

export function patternStatusFromObservations(observations: number): PatternStatus {
  if (observations <= 0) return "OBSERVED";
  if (observations <= LEARNING_THRESHOLDS.INSUFFICIENT_DATA_MAX) return "INSUFFICIENT_DATA";
  if (observations <= LEARNING_THRESHOLDS.EMERGING_PATTERN_MAX) return "EMERGING_PATTERN";
  return "RELIABLE_PATTERN";
}

/** 0–0.9 from sample size only. Never a health score or a forecast. */
export function confidenceFromObservations(observations: number): number {
  if (observations <= 0) return 0;
  return Math.min(0.9, Math.round((observations / 20) * 100) / 100);
}

export function successRate(successes: number, observations: number): number {
  if (observations <= 0) return 0;
  return Math.round((successes / observations) * 1000) / 1000;
}

export function formatObservedRate(successes: number, observations: number): string {
  if (observations <= 0) return "no recorded outcomes";
  const pct = Math.round((successes / observations) * 100);
  return `${pct}% observed success rate across ${observations} recorded outcomes`;
}
