import { parseIso } from "../clock";
import { DEFAULT_DOWNSTREAM_DURATIONS, WARNING_THRESHOLDS } from "./thresholds";
import type { BufferCalculation, BufferState, DownstreamDurations } from "./types";

export function minutesBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 60000);
}

export function calculateAvailableBuffer(deadline: string, upstreamAvailableAt: string): number {
  return minutesBetween(upstreamAvailableAt, deadline);
}

export function calculateRequiredBuffer(durations: Partial<DownstreamDurations> = {}): number {
  const processing = durations.processing_minutes ?? DEFAULT_DOWNSTREAM_DURATIONS.processing_minutes;
  const preparation = durations.preparation_minutes ?? DEFAULT_DOWNSTREAM_DURATIONS.preparation_minutes;
  const transport = durations.transport_minutes ?? DEFAULT_DOWNSTREAM_DURATIONS.transport_minutes;
  return processing + preparation + transport;
}

export function classifyBuffer(
  availableMinutes: number,
  requiredMinutes: number,
  deadline: string,
  now: string,
): BufferState {
  const deadlinePassed = minutesBetween(now, deadline) < 0;
  if (deadlinePassed) return "MISSED";
  const surplus = availableMinutes - requiredMinutes;
  if (surplus < 0) return "AT_RISK";
  if (surplus < WARNING_THRESHOLDS.TIGHT_MARGIN_MINUTES) return "TIGHT";
  return "SAFE";
}

export function evaluateBuffer(input: {
  deadline: string;
  upstreamAvailableAt: string;
  now: string;
  durations?: Partial<DownstreamDurations>;
}): BufferCalculation {
  const durations: DownstreamDurations = {
    processing_minutes: input.durations?.processing_minutes ?? DEFAULT_DOWNSTREAM_DURATIONS.processing_minutes,
    preparation_minutes: input.durations?.preparation_minutes ?? DEFAULT_DOWNSTREAM_DURATIONS.preparation_minutes,
    transport_minutes: input.durations?.transport_minutes ?? DEFAULT_DOWNSTREAM_DURATIONS.transport_minutes,
  };
  const available = calculateAvailableBuffer(input.deadline, input.upstreamAvailableAt);
  const required = calculateRequiredBuffer(durations);
  const state = classifyBuffer(available, required, input.deadline, input.now);
  return {
    deadline: input.deadline,
    upstream_available_at: input.upstreamAvailableAt,
    now: input.now,
    available_buffer_minutes: available,
    required_buffer_minutes: required,
    shortfall_minutes: available - required,
    surplus_minutes: available - required,
    durations,
    state,
    deadline_passed: state === "MISSED",
  };
}

export function formatHours(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  const abs = Math.abs(rounded);
  const label = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${rounded < 0 ? "−" : ""}${label}h`;
}
