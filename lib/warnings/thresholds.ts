/**
 * Centralized early-warning thresholds. UI must not invent these.
 * Values are minutes. An LLM must never classify buffer state.
 */
export const WARNING_THRESHOLDS = {
  TIGHT_MARGIN_MINUTES: 4 * 60,
  CRITICAL_SHORTFALL_MINUTES: 24 * 60,
  HIGH_VALUE_DZD: 250000,
} as const;

export const DEFAULT_DOWNSTREAM_DURATIONS = {
  processing_minutes: 6 * 60,
  preparation_minutes: 4 * 60,
  transport_minutes: 8 * 60,
} as const;
