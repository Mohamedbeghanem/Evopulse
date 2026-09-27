/** Canonical business event types. Every inbound signal becomes one of these (or a dotted extension). */
export const EVENT_TYPES = {
  MESSAGE_RECEIVED: "message.received",
  COMMITMENT_CREATED: "commitment.created",
  COMMITMENT_FULFILLED: "commitment.fulfilled",
  COMMITMENT_MISSED: "commitment.missed",
  QUOTE_SENT: "quote.sent",
  DEAL_CREATED: "deal.created",
  DEAL_WON: "deal.won",
  DEAL_LOST: "deal.lost",
  PAYMENT_EXPECTED: "payment.expected",
  PAYMENT_RECEIVED: "payment.received",
  SHIPMENT_EXPECTED: "shipment.expected",
  SHIPMENT_ARRIVED: "shipment.arrived",
  SHIPMENT_DELAYED: "shipment.delayed",
  ORDER_CREATED: "order.created",
  ORDER_DELIVERED: "order.delivered",
  CUSTOMER_DECISION: "customer.decision",
  ORDER_AFFECTED: "order.affected",
  EXCEPTION_CREATED: "exception.created",
  TASK_COMPLETED: "task.completed",
  CUSTOMER_REPLIED: "customer.replied",
  POLICY_BLOCKED: "policy.blocked",
  ACTION_EXECUTED: "action.executed",
  TIME_ADVANCED: "time.advanced",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export const KNOWN_EVENT_TYPES = new Set<string>(Object.values(EVENT_TYPES));

/** Dotted type: namespace.action (extra segments allowed, e.g. quote.sent). */
export const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]+)+$/;

export type BusinessEvent = {
  id: string;
  type: string;
  source: string;
  source_id: string | null;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  received_at: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type EventInput = {
  id?: string;
  type: string;
  source: string;
  source_id?: string | null;
  actor_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  payload?: Record<string, unknown>;
  occurred_at?: string;
  received_at?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  /** If true, return the existing row when (source, source_id, type) already exists. */
  idempotent?: boolean;
};

export type EventListFilters = {
  type?: string;
  entity_type?: string;
  entity_id?: string;
  source?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export type EventHandler = (event: BusinessEvent) => void | Promise<void>;

export type ReplayResult = {
  replayed: BusinessEvent[];
  skipped: string[];
  note: string;
};
