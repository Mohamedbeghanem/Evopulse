/** Seeded delivery clock. Shortfall is projected arrival minus Order A's deadline (4h). */
export const SHIPMENT_PROJECTED_ISO = "2026-10-01T22:00:00+01:00";
export const ORDER_A_DEADLINE_ISO = "2026-10-01T18:00:00+01:00";
export const ORDER_B_DEADLINE_ISO = "2026-10-02T00:00:00+01:00";
export const ORDER_C_DEADLINE_ISO = "2026-10-02T18:00:00+01:00";

export const ORDER_VALUES = {
  A: 320000,
  B: 280000,
  C: 250000,
} as const;

export const CASH_TIMING_AMOUNT = 540000;

/** Silence that has not reached this window is not a failure. */
export const INACTIVITY_WINDOW_HOURS = 96;
/** Raise an early warning only once the window is this close. */
export const INACTIVITY_APPROACH_HOURS = 24;

export const HIGH_CONFIDENCE = 0.8;
export const DELIVERY_CONFIDENCE = 0.9;
export const INACTIVITY_CONFIDENCE = 0.8;

export const SHIPMENT_DELAY_QUOTE =
  "Your shipment will arrive Thursday 22:00 instead of Monday.";
