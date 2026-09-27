import type { DatabaseSync } from "node:sqlite";
import { z } from "zod";
import { id } from "../ids";
import { stateFingerprint } from "./fingerprint";
import { metricsFor, project } from "./propagate";
import { loadSnapshot, relevantSlice } from "./source";
import { daysBetween, formatSimDay, shiftDays } from "./time";
import type {
  BusinessSnapshot,
  CountDelta,
  EntityChange,
  EvidencePath,
  EvidenceStep,
  NodeProjection,
  Projection,
  ProjectionMetrics,
  Scenario,
  SimulationDelta,
  SimulationResult,
} from "./types";

export const scenarioSchema = z.object({
  type: z.literal("supplier_delay"),
  targetId: z.string().min(1),
  days: z.number().int().min(1).max(30),
});

export class SimulationError extends Error {}

/**
 * Run a what-if scenario against the live Business Twin.
 *
 * Isolation model: read-only snapshot → deep clone of the relevant slice →
 * scenario applied to the clone → in-memory propagation. Nothing is written.
 * A content hash of every table is taken before and after to prove it.
 */
export function runSimulation(db: DatabaseSync, input: unknown): SimulationResult {
  const scenario = parseScenario(input);
  const before = stateFingerprint(db);
  const result = simulateSnapshot(loadSnapshot(db), scenario);
  const after = stateFingerprint(db);
  return {
    ...result,
    isolation: {
      fingerprintBefore: before.hash,
      fingerprintAfter: after.hash,
      unchanged: before.hash === after.hash,
      tablesChecked: after.tables,
    },
  };
}

export function parseScenario(input: unknown): Scenario {
  const parsed = scenarioSchema.safeParse(input);
  if (!parsed.success) {
    throw new SimulationError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  }
  return parsed.data;
}

/** Pure core: snapshot in, comparison out. Never mutates `snapshot`. */
export function simulateSnapshot(snapshot: BusinessSnapshot, scenario: Scenario): Omit<SimulationResult, "isolation"> {
  const origin = snapshot.nodes.find((n) => n.id === scenario.targetId);
  if (!origin) throw new SimulationError(`Unknown scenario target: ${scenario.targetId}`);
  if (origin.type !== "shipment" || !origin.attrs.expectedAt) {
    throw new SimulationError(`${origin.label} is not a shipment with an expected arrival`);
  }

  const baselineState = relevantSlice(snapshot, origin.id);
  const simulatedState = applyScenario(structuredClone(baselineState), scenario);

  const baseline = project(baselineState);
  const simulated = project(simulatedState);
  const baselineMetrics = metricsFor(baselineState, baseline, origin.id);
  const simulatedMetrics = metricsFor(simulatedState, simulated, origin.id);

  return {
    id: id("sim"),
    mode: "SIMULATION",
    scenario,
    source: snapshot.source,
    asOf: snapshot.asOf,
    scope: {
      nodes: baselineState.nodes.length,
      edges: baselineState.edges.length,
      origin: { id: origin.id, label: origin.label },
    },
    baseline: baselineMetrics,
    simulated: simulatedMetrics,
    delta: buildDelta(baselineMetrics, simulatedMetrics, baseline, simulated),
    changes: buildChanges(baselineState, baseline, simulated, origin.id),
  };
}

function applyScenario(state: BusinessSnapshot, scenario: Scenario): BusinessSnapshot {
  const target = state.nodes.find((n) => n.id === scenario.targetId)!;
  target.attrs.expectedAt = shiftDays(target.attrs.expectedAt!, scenario.days);
  return state;
}

function countDelta<T extends { id: string }>(base: T[], sim: T[]): CountDelta<T> {
  const baseIds = new Set(base.map((x) => x.id));
  return {
    baseline: base.length,
    simulated: sim.length,
    delta: sim.length - base.length,
    added: sim.filter((x) => !baseIds.has(x.id)),
  };
}

function buildDelta(
  base: ProjectionMetrics,
  sim: ProjectionMetrics,
  baseProj: Projection,
  simProj: Projection,
): SimulationDelta {
  const commitmentsMissed = countDelta(base.commitmentsMissed, sim.commitmentsMissed);
  const ordersLate = countDelta(base.ordersLate, sim.ordersLate);
  const customersAffected = countDelta(base.customersAffected, sim.customersAffected);
  const invoicesMoved = Object.values(simProj.nodes)
    .filter((p) => p.type === "invoice" && p.inPeriod === false && baseProj.nodes[p.id]?.inPeriod === true)
    .map((p) => ({ id: p.id, label: p.label, amount: p.amount ?? 0 }));
  const movedToNextPeriod = base.cashInPeriod - sim.cashInPeriod;
  const money = (n: number) => `${n.toLocaleString("en-US")} ${sim.currency}`;

  const headline: string[] = [];
  const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (commitmentsMissed.delta) headline.push(`${signed(commitmentsMissed.delta)} commitments missed`);
  if (customersAffected.delta)
    headline.push(`${signed(customersAffected.delta)} customer deadline${Math.abs(customersAffected.delta) === 1 ? "" : "s"} affected`);
  if (movedToNextPeriod > 0) headline.push(`${money(movedToNextPeriod)} cash moves into next period`);
  if (!headline.length) headline.push("No deadline or cash-period change — slack absorbs this delay");

  return {
    shipmentShiftDays: daysBetween(base.shipmentArrival, sim.shipmentArrival),
    commitmentsMissed,
    ordersLate,
    customersAffected,
    revenueAtRisk: { baseline: base.revenueAtRisk, simulated: sim.revenueAtRisk, delta: sim.revenueAtRisk - base.revenueAtRisk },
    cash: {
      inPeriodBaseline: base.cashInPeriod,
      inPeriodSimulated: sim.cashInPeriod,
      movedToNextPeriod,
      invoicesMoved,
    },
    headline,
  };
}

const TYPE_RANK: Record<string, number> = {
  supplier: 0,
  shipment: 1,
  product: 2,
  order: 3,
  commitment: 4,
  customer: 5,
  invoice: 6,
  cash: 7,
};

function buildChanges(state: BusinessSnapshot, base: Projection, sim: Projection, originId: string): EntityChange[] {
  const changes: EntityChange[] = [];
  for (const node of state.nodes) {
    const b = base.nodes[node.id];
    const s = sim.nodes[node.id];
    if (!b || !s) continue;
    const moved = b.at !== s.at;
    const flipped = b.late !== s.late || b.inPeriod !== s.inPeriod;
    if (!moved && !flipped) continue;
    changes.push({
      id: node.id,
      type: node.type,
      label: node.label,
      baseline: { at: b.at, late: b.late },
      simulated: { at: s.at, late: s.late },
      shiftDays: daysBetween(b.at, s.at),
      consequence: consequenceFor(state, b, s),
      why: evidencePath(state, base, sim, node.id, originId),
    });
  }
  return changes.sort((x, y) => (TYPE_RANK[x.type] ?? 9) - (TYPE_RANK[y.type] ?? 9));
}

function consequenceFor(state: BusinessSnapshot, b: NodeProjection, s: NodeProjection): string {
  const from = formatSimDay(b.at);
  const to = formatSimDay(s.at);
  const due = formatSimDay(s.dueAt);
  switch (s.type) {
    case "shipment":
      return `Arrival moves ${from} → ${to} (simulation only)`;
    case "product":
      return `Stock available ${from} → ${to}`;
    case "order":
      if (s.late && !b.late) return `Delivery ${from} → ${to} — now breaches its delivery deadline`;
      if (s.late) return `Delivery ${from} → ${to} — already late, now later`;
      return `Delivery ${from} → ${to} — still inside its deadline`;
    case "commitment":
      if (s.late && !b.late) return `Newly MISSED — completes ${to}, deadline ${due}`;
      if (s.late) return `Already missed in baseline — slips further to ${to} (deadline ${due})`;
      return `Completes ${to} — deadline ${due} still met`;
    case "customer":
      return s.late && !b.late ? "Delivery deadline newly breached" : s.late ? "Already affected in baseline" : "Deadline still met";
    case "invoice": {
      const cash = state.nodes.find((n) => n.type === "cash");
      if (b.inPeriod && s.inPeriod === false)
        return `Cash expected ${from} → ${to} — moves out of ${cash?.label ?? "this period"}`;
      return `Cash expected ${from} → ${to}`;
    }
    case "cash":
      return `Latest contributing invoice ${from} → ${to}`;
    default:
      return `${from} → ${to}`;
  }
}

/**
 * WHY: follow the critical-input pointers of the simulated projection back to
 * the scenario origin. Every step is a real edge in the snapshot.
 */
function evidencePath(
  state: BusinessSnapshot,
  base: Projection,
  sim: Projection,
  nodeId: string,
  originId: string,
): EvidencePath {
  const byId = new Map(state.nodes.map((n) => [n.id, n]));
  // Each chain entry carries the edge INTO it.
  const chain: { id: string; edgeId: string | null; relationship: string | null }[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = nodeId;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const critical: NodeProjection["critical"] = cursor === originId ? null : (sim.nodes[cursor]?.critical ?? null);
    chain.unshift({ id: cursor, edgeId: critical?.edgeId ?? null, relationship: critical?.relationship ?? null });
    cursor = critical?.from;
  }
  const steps: EvidenceStep[] = chain.map((c) => {
    const node = byId.get(c.id)!;
    return {
      nodeId: c.id,
      label: node.label,
      type: node.type,
      relationship: c.relationship,
      edgeId: c.edgeId,
      baselineAt: base.nodes[c.id]?.at ?? null,
      simulatedAt: sim.nodes[c.id]?.at ?? null,
    };
  });

  // Prepend whoever the scenario origin depends on (e.g. the supplier), via its real edge.
  if (steps[0]?.nodeId === originId) {
    const upstream = state.edges.find((e) => e.to === originId && byId.get(e.from)?.type === "supplier");
    if (upstream) {
      steps[0] = { ...steps[0], relationship: upstream.relationship, edgeId: upstream.id };
      steps.unshift({
        nodeId: upstream.from,
        label: byId.get(upstream.from)!.label,
        type: "supplier",
        relationship: null,
        edgeId: null,
        baselineAt: null,
        simulatedAt: null,
      });
    }
  }

  const explanation = steps
    .map((step) => {
      const when =
        step.baselineAt || step.simulatedAt
          ? step.baselineAt === step.simulatedAt
            ? ` (${formatSimDay(step.simulatedAt)})`
            : ` (${formatSimDay(step.baselineAt)} → ${formatSimDay(step.simulatedAt)})`
          : "";
      return `${step.relationship ? `—${step.relationship}→ ` : ""}${step.label}${when}`;
    })
    .join(" ");
  return { steps, explanation };
}

/** Shipments available as scenario targets, for the simulator UI. */
export function simulationTargets(db: DatabaseSync) {
  const snapshot = loadSnapshot(db);
  return {
    source: snapshot.source,
    asOf: snapshot.asOf,
    shipments: snapshot.nodes
      .filter((n) => n.type === "shipment" && n.attrs.expectedAt)
      .map((n) => {
        const supplierEdge = snapshot.edges.find((e) => e.to === n.id);
        const supplier = supplierEdge ? snapshot.nodes.find((x) => x.id === supplierEdge.from) : undefined;
        return {
          id: n.id,
          label: n.label,
          supplier: supplier?.label ?? null,
          expectedAt: n.attrs.expectedAt!,
          originalExpectedAt: n.attrs.originalExpectedAt ?? null,
        };
      }),
  };
}
