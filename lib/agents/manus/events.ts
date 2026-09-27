/** Trace events a Manus run emits. Persisted per run and rendered on /agents/manus. */
export const MANUS_EVENT_KINDS = [
  "plan",
  "step_start",
  "step_end",
  "thought",
  "tool_call",
  "tool_result",
  "approval",
  "ask_human",
  "stuck",
  "max_steps",
  "terminate",
  "fallback",
  "info",
] as const;
export type ManusEventKind = (typeof MANUS_EVENT_KINDS)[number];

export type ManusEvent = {
  kind: ManusEventKind;
  /** Plan step index the event belongs to (null for flow-level events). */
  stepIndex: number | null;
  /** Agent step (think/act iteration) within the plan step. */
  agentStep: number | null;
  payload: Record<string, unknown>;
};

export type ManusEventSink = (event: ManusEvent) => void;
