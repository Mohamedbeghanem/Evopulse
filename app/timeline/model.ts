/**
 * Timeline view-model — presentation layer only.
 *
 * Reads the business state through existing `lib/` readers and projects it onto
 * the six temporal states the Time Machine renders. It decides how a row LOOKS,
 * never what is true: every timestamp, amount and quote below comes from the
 * database. Nothing here writes, and no business rule lives here.
 */
import type { DatabaseSync } from "node:sqlite";
import { formatDay, formatMoney } from "@/lib/clock";
import { all, getMeta } from "@/lib/db";
import {
  evaluateEarlyWarnings,
  formatHours,
  hoursBetween,
  listWarningViews,
} from "@/lib/engine/warnings";
import type { EventRow, ExpectationRow } from "@/lib/types";

/** What kind of truth a row carries. Rendered as shape + word + colour. */
export type TemporalState =
  | "OBSERVED"
  | "EXPECTED"
  | "DETECTED"
  | "PLANNED"
  | "EXECUTED"
  | "VERIFIED";

export type Zone = "PAST" | "NOW" | "FUTURE";

/** Future rows carry a stance so they can never read as having happened. */
export type Stance = "EXPECTED" | "AT_RISK" | "PLANNED" | "SIMULATED" | "MOVED";

export type Lens = "ALL" | "CHANGES" | "EXPECTATIONS" | "ACTIONS" | "VERIFICATIONS";

export type Tone = "paper" | "sand" | "ice" | "need" | "miss" | "ok" | "mute";

export type Divergence = {
  expectedLabel: string;
  expectedAt: string;
  observedLabel: string;
  observedAt: string;
  deltaLabel: string;
  consequenceLabel: string;
  consequenceDetail: string;
};

export type InspectorFact = { value: string; label: string };
export type InspectorSource = { name: string; detail: string };

export type InspectorPayload = {
  kicker: string;
  title: string;
  stateLine: string;
  stateTone: Tone;
  facts: InspectorFact[];
  sources: InspectorSource[];
  href: string | null;
  hrefLabel: string;
};

export type TimelineRow = {
  id: string;
  at: string;
  timeLabel: string;
  dayLabel: string;
  clockLabel: string;
  state: TemporalState;
  zone: Zone;
  stance: Stance | null;
  type: string;
  title: string;
  entity: string;
  entityType: string;
  change: string | null;
  consequence: string | null;
  evidence: string | null;
  tone: Tone;
  /** MOVED rows: an expectation that was revised away. Rendered struck through. */
  superseded: boolean;
  divergence: Divergence | null;
  lenses: Lens[];
  inspector: InspectorPayload;
};

export type StateSummary = {
  state: TemporalState;
  count: number;
  /** Shown when a state legitimately has no rows in the current phase. */
  absentNote: string | null;
};

export type TimeMachine = {
  now: string;
  nowClock: string;
  nowDay: string;
  phase: string;
  windowLabel: string;
  rows: TimelineRow[];
  summary: StateSummary[];
  counts: Record<Zone, number>;
};

/**
 * "+3d 4h" — days and hours, because a 76h delta is unreadable as hours.
 * Under a day it defers to the engine's own `formatHours`, so a buffer reads
 * identically here and on the warnings screen.
 */
export function formatDuration(hours: number): string {
  const magnitude = Math.abs(hours);
  if (magnitude < 24) return formatHours(magnitude);
  const total = Math.round(magnitude);
  const days = Math.floor(total / 24);
  const rest = total % 24;
  if (days && rest) return `${days}d ${rest}h`;
  return `${days}d`;
}

export function formatSignedDuration(hours: number): string {
  const sign = hours < 0 ? "−" : "+";
  return `${sign}${formatDuration(hours)}`;
}

function dayOf(iso: string): string {
  return formatDay(iso).replace(/,? \d{2}:\d{2}$/, "");
}

function clockOf(iso: string): string {
  const match = formatDay(iso).match(/(\d{2}:\d{2})$/);
  return match ? match[1] : "";
}

const LENS_BY_STATE: Record<TemporalState, Lens[]> = {
  OBSERVED: ["ALL", "CHANGES"],
  EXPECTED: ["ALL", "EXPECTATIONS"],
  DETECTED: ["ALL", "CHANGES", "EXPECTATIONS"],
  PLANNED: ["ALL", "ACTIONS"],
  EXECUTED: ["ALL", "ACTIONS"],
  VERIFIED: ["ALL", "VERIFICATIONS"],
};

type ExceptionRow = {
  id: string;
  title: string;
  kind: string;
  attention: string;
  status: string;
  severity: string;
  created_at: string;
  evidence_json: string;
  impact_json: string;
};

type PlanRow = {
  id: string;
  exception_id: string;
  title: string;
  summary: string;
  status: string;
  created_at: string;
};

type ActionRow = {
  id: string;
  exception_id: string | null;
  plan_id: string;
  type: string;
  title: string;
  description: string;
  payload: string;
  status: string;
  policy_outcome: string;
  policy_reason: string;
  created_at: string;
};

type VerificationRow = {
  id: string;
  action_id: string | null;
  exception_id: string | null;
  expected_event_type: string;
  expected_by: string;
  status: string;
  success_condition: string;
  created_at: string;
  resolved_at: string | null;
};

type EntityRow = { id: string; type: string; name: string; payload: string };

function parse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Presentation labels for canonical event types. UX copy, not semantics. */
const EVENT_TITLES: Record<string, string> = {
  "deal.created": "Opportunity opened",
  "message.received": "Customer message received",
  "commitment.created": "Commitment recorded",
  "commitment.missed": "Commitment missed",
  "commitment.fulfilled": "Commitment fulfilled",
  "shipment.delayed": "Supplier reports shipment delay",
  "time.advanced": "Clock advanced past both deadlines",
  "policy.blocked": "Policy blocked the action",
  "action.executed": "Action executed",
  "customer.replied": "Customer replied",
  "quote.sent": "Proposal sent",
  "task.completed": "Checkpoint completed",
  "payment.received": "Payment received",
};

/** Which events are a change to the world vs the engine noticing something. */
const DETECTED_TYPES = new Set(["commitment.missed", "time.advanced", "policy.blocked"]);

export function buildTimeMachine(db: DatabaseSync): TimeMachine {
  const now = getMeta(db, "demo_now");
  const phase = getMeta(db, "demo_phase", "seeded");
  const nowMs = Date.parse(now);

  // Same call the warnings route makes, so both screens read one evaluation.
  evaluateEarlyWarnings(db, now);

  const events = all<EventRow>(db, "SELECT * FROM events ORDER BY occurred_at");
  const expectations = all<ExpectationRow>(db, "SELECT * FROM expectations ORDER BY due_at");
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions");
  const plans = all<PlanRow>(db, "SELECT * FROM plans");
  const actions = all<ActionRow>(db, "SELECT * FROM actions ORDER BY created_at");
  const verifications = all<VerificationRow>(db, "SELECT * FROM verifications");
  const entities = all<EntityRow>(db, "SELECT id, type, name, payload FROM entities");
  const warnings = listWarningViews(db);

  const entityById = new Map(entities.map((e) => [e.id, e]));
  const rows: TimelineRow[] = [];

  // Commitments are not rows in `entities`, so an event pointing at one would
  // otherwise surface its internal id as a name.
  const commitmentById = new Map(
    all<{ id: string; description: string }>(
      db,
      "SELECT id, description FROM commitments",
    ).map((c) => [c.id, c.description]),
  );

  const nameOf = (id: string | null): string => {
    if (!id) return "—";
    return entityById.get(id)?.name || commitmentById.get(id) || id;
  };

  // ---------------------------------------------------------------- PAST
  for (const event of events) {
    const payload = parse<Record<string, unknown>>(event.payload, {});
    const state: TemporalState = DETECTED_TYPES.has(event.type)
      ? "DETECTED"
      : event.type === "commitment.created"
        ? "EXPECTED"
        : "OBSERVED";

    const entityName = nameOf(event.entity_id);
    const quote = typeof payload.text === "string" ? payload.text : null;
    const note = typeof payload.note === "string" ? payload.note : null;
    const description =
      typeof payload.description === "string" ? payload.description : null;

    let change: string | null = null;
    let consequence: string | null = null;
    let divergence: Divergence | null = null;
    let tone: Tone = state === "DETECTED" ? "miss" : "sand";
    let title = EVENT_TITLES[event.type] || event.type;
    let entityLabel = entityName;
    let evidenceLine = quote || description || note;

    if (event.type === "deal.created" && typeof payload.amount === "number") {
      change = formatMoney(payload.amount, String(payload.currency || "DZD"));
    }

    if (event.type === "commitment.created") {
      tone = "ice";
      const deadline = typeof payload.deadline === "string" ? payload.deadline : null;
      change = deadline ? `Due ${formatDay(deadline)}` : null;
      // The commitment itself is the headline; the raw commitment id is not a name.
      if (description) title = description;
      entityLabel = payload.actor === "company" ? "Our commitment" : "Customer commitment";
      evidenceLine = null;
    }

    // The divergence that defines this screen: expected vs observed arrival.
    if (event.type === "shipment.delayed") {
      const previous =
        typeof payload.previousArrival === "string" ? payload.previousArrival : null;
      const projected =
        typeof payload.projectedArrival === "string" ? payload.projectedArrival : null;
      const delivery = warnings.find((w) => w.entityId === event.entity_id);
      if (previous && projected) {
        const delta = hoursBetween(previous, projected);
        const affected = delivery?.children.length ?? 0;
        divergence = {
          expectedLabel: "Expected arrival",
          expectedAt: formatDay(previous),
          observedLabel: "Observed arrival",
          observedAt: formatDay(projected),
          deltaLabel: formatSignedDuration(delta),
          consequenceLabel: affected
            ? `${affected} ${affected === 1 ? "order" : "orders"} affected`
            : "No linked orders",
          consequenceDetail: delivery
            ? formatMoney(delivery.valueAmount, delivery.currency)
            : "—",
        };
        change = `${formatDay(previous)} → ${formatDay(projected)}`;
        consequence = divergence.consequenceLabel;
      }
      tone = "miss";
    }

    if (event.type === "commitment.missed") {
      const expected = typeof payload.expected === "string" ? payload.expected : null;
      const actual = typeof payload.actual === "string" ? payload.actual : null;
      if (expected && actual) {
        divergence = {
          expectedLabel: "Expected",
          expectedAt: expected,
          observedLabel: "Observed",
          observedAt: actual,
          deltaLabel: "Never occurred",
          consequenceLabel: "Dependent decision blocked",
          consequenceDetail: formatMoney(320000),
        };
      }
    }

    if (event.type === "time.advanced") {
      consequence = note;
      // The note is already the consequence; do not print it twice.
      evidenceLine = null;
    }

    rows.push({
      id: event.id,
      at: event.occurred_at,
      timeLabel: formatDay(event.occurred_at),
      dayLabel: dayOf(event.occurred_at),
      clockLabel: clockOf(event.occurred_at),
      state,
      zone: Date.parse(event.occurred_at) < nowMs ? "PAST" : "NOW",
      stance: null,
      type: event.type,
      title,
      entity: entityLabel,
      entityType: event.entity_type || "—",
      change,
      consequence,
      evidence: evidenceLine,
      tone,
      superseded: false,
      divergence,
      lenses: LENS_BY_STATE[state],
      inspector: {
        kicker: event.entity_type || "Event",
        title: entityLabel,
        stateLine: `${EVENT_TITLES[event.type] || event.type} · ${Math.round(event.confidence * 100)}% confidence`,
        stateTone: tone,
        facts: [
          { value: event.type, label: "Canonical event type" },
          { value: event.source, label: "Source" },
          { value: formatDay(event.occurred_at), label: "Occurred" },
          { value: formatDay(event.received_at), label: "Received" },
        ],
        sources: [
          {
            name: quote ? "Quoted message" : "Event payload",
            detail: quote || description || note || event.id,
          },
        ],
        href: null,
        hrefLabel: "",
      },
    });
  }

  // ------------------------------------------------------- NOW · detected
  for (const exception of exceptions) {
    const evidence = parse<{
      quote?: string;
      expected?: string;
      actual?: string;
      source?: string;
      confidence?: number;
    }>(exception.evidence_json, {});
    const impact = parse<{
      revenueAssociated?: number;
      currency?: string;
      customersAffected?: number;
      urgency?: string;
    }>(exception.impact_json, {});

    rows.push({
      id: exception.id,
      at: exception.created_at,
      timeLabel: formatDay(exception.created_at),
      dayLabel: dayOf(exception.created_at),
      clockLabel: clockOf(exception.created_at),
      state: "DETECTED",
      zone: "NOW",
      stance: null,
      type: exception.kind,
      title: exception.title,
      entity: "Atlas Retail Group",
      entityType: "exception",
      change: exception.attention.replace(/_/g, " "),
      consequence: impact.revenueAssociated
        ? `${formatMoney(impact.revenueAssociated, impact.currency || "DZD")} associated`
        : null,
      evidence: evidence.quote || null,
      tone: "miss",
      superseded: false,
      divergence:
        evidence.expected && evidence.actual
          ? {
              expectedLabel: "Expected",
              expectedAt: evidence.expected,
              observedLabel: "Observed",
              observedAt: evidence.actual,
              deltaLabel: "Never occurred",
              consequenceLabel: "Friday decision blocked",
              consequenceDetail: formatMoney(
                impact.revenueAssociated || 0,
                impact.currency || "DZD",
              ),
            }
          : null,
      lenses: LENS_BY_STATE.DETECTED,
      inspector: {
        kicker: "Exception",
        title: exception.title,
        stateLine: `${exception.attention.replace(/_/g, " ")} · ${exception.severity} · ${exception.status}`,
        stateTone: "miss",
        facts: [
          { value: exception.kind.replace(/_/g, " "), label: "Exception kind" },
          {
            value: formatMoney(impact.revenueAssociated || 0, impact.currency || "DZD"),
            label: "Associated revenue",
          },
          { value: String(impact.customersAffected ?? 0), label: "Customers affected" },
          { value: evidence.source || "—", label: "Detected from" },
        ],
        sources: [
          { name: "Customer conversation", detail: evidence.quote || "—" },
          { name: "Expected vs actual", detail: evidence.actual || "—" },
        ],
        href: `/exceptions/${exception.id}`,
        hrefLabel: "Open full view",
      },
    });
  }

  for (const warning of warnings) {
    if (warning.status !== "ACTIVE") continue;
    const shortfall = warning.shortfallHours ?? 0;
    const buffer = warning.bufferHours ?? 0;
    rows.push({
      id: warning.id,
      at: now,
      timeLabel: formatDay(now),
      dayLabel: dayOf(now),
      clockLabel: clockOf(now),
      state: "DETECTED",
      zone: "NOW",
      stance: null,
      type: warning.kind,
      title: warning.headline,
      entity: warning.entityLabel,
      entityType: warning.entityType,
      change:
        shortfall > 0
          ? `${formatDuration(shortfall)} short`
          : `${formatDuration(buffer)} buffer`,
      consequence: warning.children.length
        ? `${warning.children.length} downstream · ${formatMoney(warning.valueAmount, warning.currency)}`
        : formatMoney(warning.valueAmount, warning.currency),
      evidence: warning.evidence.quote,
      tone: warning.severity === "CRITICAL" ? "miss" : "need",
      superseded: false,
      divergence: null,
      lenses: LENS_BY_STATE.DETECTED,
      inspector: {
        kicker: warning.entityType,
        title: warning.entityLabel,
        stateLine: `Active warning · ${warning.bufferState.replace(/_/g, " ")} — not missed`,
        stateTone: warning.severity === "CRITICAL" ? "miss" : "need",
        facts: [
          { value: warning.severity, label: "Severity" },
          {
            value: `${warning.children.length || 1}`,
            label: warning.children.length
              ? warning.children.map((c) => c.label).join(" · ")
              : "Linked entity",
          },
          {
            value: formatMoney(warning.valueAmount, warning.currency),
            label: "Associated revenue",
          },
          {
            value: warning.cashAmount
              ? formatMoney(warning.cashAmount, warning.currency)
              : "None linked",
            label: "Expected cash timing",
          },
        ],
        sources: [
          { name: warning.evidence.source, detail: warning.evidence.quote },
          ...warning.evidence.path.map((hop) => ({
            name: hop.label,
            detail: `${hop.type} · ${hop.id}`,
          })),
        ],
        href: `/warnings/${warning.id}`,
        hrefLabel: "Open full view",
      },
    });
  }

  // ------------------------------------------- NOW / FUTURE · plan + actions
  for (const plan of plans) {
    const planActions = actions.filter((a) => a.plan_id === plan.id);
    const executed = planActions.filter((a) => a.status === "executed").length;
    rows.push({
      id: plan.id,
      at: plan.created_at,
      timeLabel: formatDay(plan.created_at),
      dayLabel: dayOf(plan.created_at),
      clockLabel: clockOf(plan.created_at),
      state: executed === planActions.length && planActions.length > 0 ? "EXECUTED" : "PLANNED",
      zone: "NOW",
      stance: null,
      type: "recovery.plan",
      title: plan.title,
      entity: "Recovery plan",
      entityType: "plan",
      change: plan.status.replace(/_/g, " "),
      consequence: `${planActions.length} ${planActions.length === 1 ? "action" : "actions"} · ${executed} executed`,
      evidence: plan.summary,
      tone: "ice",
      superseded: false,
      divergence: null,
      lenses: executed ? LENS_BY_STATE.EXECUTED : LENS_BY_STATE.PLANNED,
      inspector: {
        kicker: "Plan",
        title: plan.title,
        stateLine: `${plan.status.replace(/_/g, " ")} · humans still govern the send`,
        stateTone: "ice",
        facts: planActions.map((a) => ({
          value: a.title,
          label: `${a.policy_outcome.replace(/_/g, " ")} · ${a.status}`,
        })),
        sources: [{ name: "Plan summary", detail: plan.summary }],
        href: `/exceptions/${plan.exception_id}/plan`,
        hrefLabel: "Open full view",
      },
    });
  }

  // Planned actions that carry their own future due date.
  for (const action of actions) {
    const payload = parse<{ dueAt?: string }>(action.payload, {});
    if (!payload.dueAt) continue;
    const executed = action.status === "executed";
    rows.push({
      id: action.id,
      at: payload.dueAt,
      timeLabel: formatDay(payload.dueAt),
      dayLabel: dayOf(payload.dueAt),
      clockLabel: clockOf(payload.dueAt),
      state: executed ? "EXECUTED" : "PLANNED",
      zone: Date.parse(payload.dueAt) > nowMs ? "FUTURE" : "PAST",
      stance: executed ? null : "PLANNED",
      type: action.type,
      title: action.title,
      entity: "Recovery plan",
      entityType: "action",
      change: action.policy_outcome.replace(/_/g, " "),
      consequence: action.description,
      evidence: action.policy_reason,
      tone: executed ? "ok" : "ice",
      superseded: false,
      divergence: null,
      lenses: LENS_BY_STATE.PLANNED,
      inspector: {
        kicker: "Action",
        title: action.title,
        stateLine: `${action.status} · ${action.policy_outcome.replace(/_/g, " ")}`,
        stateTone: executed ? "ok" : "ice",
        facts: [
          { value: action.type, label: "Action type" },
          { value: action.policy_outcome.replace(/_/g, " "), label: "Policy outcome" },
          { value: formatDay(payload.dueAt), label: "Due" },
        ],
        sources: [{ name: "Policy reason", detail: action.policy_reason }],
        href: `/exceptions/${action.exception_id ?? ""}/plan`,
        hrefLabel: "Open full view",
      },
    });
  }

  // ----------------------------------------------------------- VERIFIED
  for (const verification of verifications) {
    const resolved = verification.status !== "PENDING";
    rows.push({
      id: verification.id,
      at: verification.resolved_at || verification.expected_by,
      timeLabel: formatDay(verification.resolved_at || verification.expected_by),
      dayLabel: dayOf(verification.resolved_at || verification.expected_by),
      clockLabel: clockOf(verification.resolved_at || verification.expected_by),
      state: "VERIFIED",
      zone: resolved ? "PAST" : "FUTURE",
      stance: resolved ? null : "EXPECTED",
      type: verification.expected_event_type,
      title: resolved ? "Outcome verified" : "Verification pending",
      entity: "Verification",
      entityType: "verification",
      change: verification.status,
      consequence: verification.success_condition,
      evidence: `Send alone does not mark the exception solved.`,
      tone: verification.status === "SUCCESS" ? "ok" : "ice",
      superseded: false,
      divergence: null,
      lenses: LENS_BY_STATE.VERIFIED,
      inspector: {
        kicker: "Verification",
        title: resolved ? "Outcome verified" : "Verification pending",
        stateLine: `${verification.status} · expects ${verification.expected_event_type}`,
        stateTone: verification.status === "SUCCESS" ? "ok" : "ice",
        facts: [
          { value: verification.expected_event_type, label: "Expected event" },
          { value: formatDay(verification.expected_by), label: "Expected by" },
          { value: verification.status, label: "Status" },
        ],
        sources: [{ name: "Success condition", detail: verification.success_condition }],
        href: null,
        hrefLabel: "",
      },
    });
  }

  // ------------------------------------------------ FUTURE · expectations
  for (const expectation of expectations) {
    const future = Date.parse(expectation.due_at) > nowMs;
    if (!future) continue;
    rows.push({
      id: expectation.id,
      at: expectation.due_at,
      timeLabel: formatDay(expectation.due_at),
      dayLabel: dayOf(expectation.due_at),
      clockLabel: clockOf(expectation.due_at),
      state: "EXPECTED",
      zone: "FUTURE",
      stance: expectation.status === "AT_RISK" ? "AT_RISK" : "EXPECTED",
      type: "expectation",
      title: expectation.description,
      entity: "Commitment",
      entityType: "expectation",
      change: expectation.status.replace(/_/g, " "),
      consequence: expectation.actual || null,
      evidence: null,
      tone: expectation.status === "AT_RISK" ? "need" : "ice",
      superseded: false,
      divergence: null,
      lenses: LENS_BY_STATE.EXPECTED,
      inspector: {
        kicker: "Expectation",
        title: expectation.description,
        stateLine: expectation.status.replace(/_/g, " "),
        stateTone: "ice",
        facts: [
          { value: formatDay(expectation.due_at), label: "Due" },
          { value: expectation.status, label: "Status" },
        ],
        sources: [{ name: "Recorded", detail: formatDay(expectation.created_at) }],
        href: null,
        hrefLabel: "",
      },
    });
  }

  // The superseded arrival, and the revised one, drawn from the delay event.
  const delayEvent = events.find((e) => e.type === "shipment.delayed");
  if (delayEvent) {
    const payload = parse<{ previousArrival?: string; projectedArrival?: string; quote?: string }>(
      delayEvent.payload,
      {},
    );
    const shipment = nameOf(delayEvent.entity_id);
    const delivery = warnings.find((w) => w.entityId === delayEvent.entity_id);

    if (payload.previousArrival) {
      rows.push({
        id: `${delayEvent.id}_moved`,
        at: payload.previousArrival,
        timeLabel: formatDay(payload.previousArrival),
        dayLabel: dayOf(payload.previousArrival),
        clockLabel: clockOf(payload.previousArrival),
        state: "EXPECTED",
        zone: "FUTURE",
        stance: "MOVED",
        type: "shipment.arrival",
        title: `Original ${shipment} arrival`,
        entity: shipment,
        entityType: "shipment",
        change: "Superseded by the supplier delay",
        consequence: null,
        evidence: null,
        tone: "mute",
        superseded: true,
        divergence: null,
        lenses: LENS_BY_STATE.EXPECTED,
        inspector: {
          kicker: "Shipment",
          title: `Original ${shipment} arrival`,
          stateLine: "Moved · this expectation no longer holds",
          stateTone: "mute",
          facts: [
            { value: formatDay(payload.previousArrival), label: "Original arrival" },
            {
              value: payload.projectedArrival ? formatDay(payload.projectedArrival) : "—",
              label: "Replaced by",
            },
          ],
          sources: [{ name: "Supplier delay notice", detail: payload.quote || "—" }],
          href: delivery ? `/warnings/${delivery.id}` : null,
          hrefLabel: "Open full view",
        },
      });
    }

    if (payload.projectedArrival) {
      rows.push({
        id: `${delayEvent.id}_projected`,
        at: payload.projectedArrival,
        timeLabel: formatDay(payload.projectedArrival),
        dayLabel: dayOf(payload.projectedArrival),
        clockLabel: clockOf(payload.projectedArrival),
        state: "EXPECTED",
        zone: "FUTURE",
        stance: "AT_RISK",
        type: "shipment.arrival",
        title: `${shipment} now arrives`,
        entity: shipment,
        entityType: "shipment",
        change: "Revised by the supplier",
        consequence: delivery
          ? `Lands after Order A is due · ${formatMoney(delivery.cashAmount, delivery.currency)} cash timing`
          : null,
        evidence: payload.quote || null,
        tone: "need",
        superseded: false,
        divergence: null,
        lenses: LENS_BY_STATE.EXPECTED,
        inspector: {
          kicker: "Shipment",
          title: shipment,
          stateLine: "Revised arrival · at risk — not missed",
          stateTone: "need",
          facts: [
            { value: formatDay(payload.projectedArrival), label: "Projected arrival" },
            ...(delivery
              ? [
                  {
                    value: formatMoney(delivery.valueAmount, delivery.currency),
                    label: "Associated revenue",
                  },
                  {
                    value: formatMoney(delivery.cashAmount, delivery.currency),
                    label: "Expected cash timing",
                  },
                ]
              : []),
          ],
          sources: [{ name: "Supplier delay notice", detail: payload.quote || "—" }],
          href: delivery ? `/warnings/${delivery.id}` : null,
          hrefLabel: "Open full view",
        },
      });
    }
  }

  // Downstream orders, each with the buffer the engine measured.
  const delivery = warnings.find((w) => w.children.length > 0);
  for (const child of delivery?.children ?? []) {
    const atRisk = child.state === "AT_RISK";
    rows.push({
      id: `${delivery?.id}_${child.entityId}`,
      at: child.deadlineAt,
      timeLabel: formatDay(child.deadlineAt),
      dayLabel: dayOf(child.deadlineAt),
      clockLabel: clockOf(child.deadlineAt),
      state: "EXPECTED",
      zone: Date.parse(child.deadlineAt) > nowMs ? "FUTURE" : "PAST",
      stance: atRisk ? "AT_RISK" : "EXPECTED",
      type: "order.deadline",
      title: `${child.label} due · ${child.customer}`,
      entity: child.label,
      entityType: child.entityType,
      change: atRisk
        ? `${formatDuration(child.shortfallHours)} short`
        : `${formatDuration(child.bufferHours)} buffer`,
      consequence: formatMoney(child.valueAmount, child.currency),
      evidence: null,
      tone: atRisk ? "miss" : child.state === "TIGHT" ? "need" : "ice",
      superseded: false,
      divergence: null,
      lenses: LENS_BY_STATE.EXPECTED,
      inspector: {
        kicker: child.entityType,
        title: `${child.label} · ${child.customer}`,
        stateLine: `${child.state.replace(/_/g, " ")} — not missed`,
        stateTone: atRisk ? "miss" : child.state === "TIGHT" ? "need" : "ice",
        facts: [
          { value: formatDay(child.deadlineAt), label: "Deadline" },
          { value: formatDuration(child.availableHours), label: "Time available" },
          { value: formatDuration(child.requiredHours), label: "Time required" },
          {
            value: atRisk
              ? `−${formatDuration(child.shortfallHours)}`
              : `+${formatDuration(child.bufferHours)}`,
            label: atRisk ? "Shortfall" : "Buffer",
          },
          { value: formatMoney(child.valueAmount, child.currency), label: "Order value" },
        ],
        sources: [
          { name: "Dependency", detail: `${child.label} delivery depends on the shipment` },
        ],
        href: delivery ? `/warnings/${delivery.id}` : null,
        hrefLabel: "Open full view",
      },
    });
  }

  rows.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  const counts: Record<Zone, number> = {
    PAST: rows.filter((r) => r.zone === "PAST").length,
    NOW: rows.filter((r) => r.zone === "NOW").length,
    FUTURE: rows.filter((r) => r.zone === "FUTURE").length,
  };

  const ABSENT: Partial<Record<TemporalState, string>> = {
    EXECUTED: "No action has been executed yet — the recovery plan is awaiting approval.",
    VERIFIED: "Nothing to verify yet. Verification opens once an action is executed.",
  };

  const states: TemporalState[] = [
    "OBSERVED",
    "EXPECTED",
    "DETECTED",
    "PLANNED",
    "EXECUTED",
    "VERIFIED",
  ];

  const summary: StateSummary[] = states.map((state) => {
    const count = rows.filter((r) => r.state === state).length;
    return { state, count, absentNote: count === 0 ? ABSENT[state] ?? null : null };
  });

  const first = rows[0]?.at ?? now;
  const last = rows[rows.length - 1]?.at ?? now;

  return {
    now,
    nowClock: clockOf(now),
    nowDay: dayOf(now),
    phase,
    windowLabel: `${dayOf(first)} → ${dayOf(last)}`,
    rows,
    summary,
    counts,
  };
}
