/**
 * Business Simulation (what-if) engine types.
 *
 * The engine never touches SQLite directly. It works on a `BusinessSnapshot`:
 * a plain, cloneable copy of the relevant slice of the Business Graph.
 */

export type SnapshotSource = "business_graph" | "fixture";

/** Scheduling attributes the propagator understands. Everything is optional. */
export type SimAttrs = {
  /** Source time for a shipment (arrival). */
  expectedAt?: string;
  /** Planned time before any revision (display only). */
  originalExpectedAt?: string;
  /** Deadline: customer delivery commitment, invoice due date, etc. */
  dueAt?: string;
  /** Days added after the latest input is ready (handling / delivery lead). */
  lagDays?: number;
  /** Invoice: days after delivery before cash is expected. */
  paymentTermsDays?: number;
  /** Cash bucket: last instant money counts for this period. */
  periodEnd?: string;
  amount?: number;
  currency?: string;
  /** Commitment / entity status (fulfilled or cancelled commitments are ignored). */
  status?: string;
};

export type SimNode = {
  id: string;
  type: string;
  label: string;
  attrs: SimAttrs;
};

export type SimEdge = {
  id: string;
  from: string;
  to: string;
  relationship: string;
};

export type BusinessSnapshot = {
  source: SnapshotSource;
  /** Business clock the snapshot was taken at. */
  asOf: string;
  nodes: SimNode[];
  edges: SimEdge[];
};

export type Scenario = {
  type: "supplier_delay";
  /** Shipment node id. */
  targetId: string;
  /** Additional delay on top of the current expected arrival. */
  days: number;
};

export type NodeProjection = {
  id: string;
  type: string;
  label: string;
  /** When this node is ready (arrival, delivery, cash expected). null = untimed. */
  at: string | null;
  dueAt: string | null;
  /** Deadline breached (commitment/order) or affected (customer). */
  late: boolean;
  /** Cash node: invoice-level period classification. */
  inPeriod?: boolean;
  amount: number | null;
  /** Predecessor that determined `at` — used for evidence paths. */
  critical: { from: string; edgeId: string; relationship: string } | null;
};

export type Projection = {
  nodes: Record<string, NodeProjection>;
};

export type ProjectionMetrics = {
  shipmentArrival: string | null;
  /** Explicit commitment nodes plus order delivery deadlines without one. */
  commitmentsMissed: { id: string; label: string }[];
  ordersLate: { id: string; label: string; amount: number }[];
  customersAffected: { id: string; label: string }[];
  revenueAtRisk: number;
  cashInPeriod: number;
  cashNextPeriod: number;
  cashPeriodEnd: string | null;
  currency: string;
};

export type EvidenceStep = {
  nodeId: string;
  label: string;
  type: string;
  /** Relationship on the real edge that leads INTO this step (null on the first step). */
  relationship: string | null;
  edgeId: string | null;
  baselineAt: string | null;
  simulatedAt: string | null;
};

export type EvidencePath = {
  steps: EvidenceStep[];
  explanation: string;
};

export type EntityChange = {
  id: string;
  type: string;
  label: string;
  baseline: { at: string | null; late: boolean };
  simulated: { at: string | null; late: boolean };
  shiftDays: number;
  consequence: string;
  why: EvidencePath;
};

export type CountDelta<T> = {
  baseline: number;
  simulated: number;
  delta: number;
  added: T[];
};

export type SimulationDelta = {
  shipmentShiftDays: number;
  commitmentsMissed: CountDelta<{ id: string; label: string }>;
  ordersLate: CountDelta<{ id: string; label: string; amount: number }>;
  customersAffected: CountDelta<{ id: string; label: string }>;
  revenueAtRisk: { baseline: number; simulated: number; delta: number };
  cash: {
    inPeriodBaseline: number;
    inPeriodSimulated: number;
    movedToNextPeriod: number;
    invoicesMoved: { id: string; label: string; amount: number }[];
  };
  headline: string[];
};

export type IsolationReport = {
  fingerprintBefore: string;
  fingerprintAfter: string;
  unchanged: boolean;
  tablesChecked: number;
};

export type SimulationResult = {
  id: string;
  mode: "SIMULATION";
  scenario: Scenario;
  source: SnapshotSource;
  asOf: string;
  scope: { nodes: number; edges: number; origin: { id: string; label: string } };
  baseline: ProjectionMetrics;
  simulated: ProjectionMetrics;
  delta: SimulationDelta;
  changes: EntityChange[];
  isolation: IsolationReport;
};
