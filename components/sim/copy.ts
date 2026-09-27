import { formatDay, formatMoney } from "../../lib/clock";
import type { CausalExplorerModel } from "../../lib/engine/causal";
import type { IsolationReport, SimulationDelta, SimulationResult } from "../../lib/simulation/types";

export const SIMULATION_BANNER = "SIMULATION · NOT LIVE BUSINESS STATE";
export const NOT_A_LOSS = "Not a loss.";
export const ASSOCIATED_CAPTION = "Associated revenue. Not a loss.";
export const CASH_TIMING_CAPTION = "Expected cash timing. Not a loss.";

export type WorldKind = "LIVE" | "SIMULATION" | "DELTA";

export type WorldFact = {
  label: string;
  value: string;
  detail?: string;
};

export type WorldCard = {
  kind: WorldKind;
  word: string;
  title: string;
  note: string;
  facts: WorldFact[];
};

export type CashTimingCopy = {
  movedAmount: number;
  headline: string;
  invoicesLabel: string;
  note: string;
};

export type SimulationView = {
  banner: string;
  headlines: string[];
  cashTiming: CashTimingCopy;
  worlds: WorldCard[];
  isolationLine: string;
};

export type CausalImpactCopy = {
  chain: string;
  orders: string;
  customers: string;
  associated: { value: string; caption: string };
  cashTiming: { value: string; caption: string };
};

function when(iso: string | null): string {
  return iso ? formatDay(iso) : "—";
}

function listLabels(items: { label: string }[]): string {
  return items.map((item) => item.label).join(" · ");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function signedMoney(n: number, currency: string): string {
  if (n === 0) return formatMoney(0, currency);
  const body = formatMoney(Math.abs(n), currency);
  return n > 0 ? `+${body}` : `−${body}`;
}

function columnNodes(model: CausalExplorerModel, key: string) {
  return model.columns.find((column) => column.key === key)?.nodes ?? [];
}

function shortEntity(label: string, fallback: string): string {
  const ship = label.match(/\bSH-\d+\b/);
  if (ship) return ship[0];
  const kit = label.match(/\bRK-\d+\b/);
  if (kit) return kit[0];
  return label || fallback;
}

/** Names the invoices the propagator reclassified. Never substitutes the live period total. */
export function presentCashTiming(delta: SimulationDelta, currency = "DZD"): CashTimingCopy {
  const moved = delta.cash.movedToNextPeriod;
  const invoices = delta.cash.invoicesMoved;
  const invoicesLabel = invoices.map((invoice) => invoice.label).join(" · ");

  if (moved <= 0) {
    return {
      movedAmount: 0,
      headline: "No cash timing move",
      invoicesLabel: invoicesLabel || "None",
      note: "Slack absorbs this delay. Period cash does not move as a block.",
    };
  }

  const named = invoices.length
    ? invoices.map((invoice) => `${invoice.label} ${formatMoney(invoice.amount, currency)}`).join(" · ")
    : formatMoney(moved, currency);

  return {
    movedAmount: moved,
    headline: `${named} cash timing moves into next period`,
    invoicesLabel: invoicesLabel || "Invoice",
    note: `${formatMoney(moved, currency)} is ${invoicesLabel || "invoice"} timing. The ${formatMoney(delta.cash.inPeriodBaseline, currency)} period total does not move as a block.`,
  };
}

export function presentHeadlines(result: Pick<SimulationResult, "delta" | "simulated">): string[] {
  const cash = presentCashTiming(result.delta, result.simulated.currency);
  return result.delta.headline.map((line) => {
    if (/cash moves into next period/i.test(line) && cash.movedAmount > 0) return cash.headline;
    return line;
  });
}

export function presentWorlds(
  result: Pick<SimulationResult, "baseline" | "simulated" | "delta" | "scenario">,
): WorldCard[] {
  const currency = result.simulated.currency;
  const cash = presentCashTiming(result.delta, currency);
  const live = result.baseline;
  const sim = result.simulated;
  const delta = result.delta;

  return [
    {
      kind: "LIVE",
      word: "REALITY",
      title: "Live twin",
      note:
        live.cashInPeriod > 0
          ? `${formatMoney(live.cashInPeriod, currency)} is expected cash timing still in this period — not a movement.`
          : "No invoice cash is classified in this period.",
      facts: [
        { label: "Shipment arrives", value: when(live.shipmentArrival), detail: "LIVE arrival" },
        {
          label: "Commitments missed",
          value: String(live.commitmentsMissed.length),
          detail: listLabels(live.commitmentsMissed) || undefined,
        },
        { label: "Orders late", value: String(live.ordersLate.length), detail: listLabels(live.ordersLate) || undefined },
        {
          label: "Customer deadlines",
          value: String(live.customersAffected.length),
          detail: listLabels(live.customersAffected) || undefined,
        },
        { label: "Revenue on late orders", value: formatMoney(live.revenueAtRisk, currency) },
        {
          label: "Cash this period",
          value: formatMoney(live.cashInPeriod, currency),
          detail: CASH_TIMING_CAPTION,
        },
      ],
    },
    {
      kind: "SIMULATION",
      word: "NOT REAL",
      title: `+${result.scenario.days} days · clone`,
      note:
        cash.movedAmount > 0
          ? `${cash.invoicesLabel} timing leaves this period in the clone only.`
          : "Order slack absorbs this delay in the clone.",
      facts: [
        { label: "Shipment arrives", value: when(sim.shipmentArrival), detail: "SIMULATION only" },
        {
          label: "Commitments missed",
          value: String(sim.commitmentsMissed.length),
          detail: listLabels(sim.commitmentsMissed) || undefined,
        },
        { label: "Orders late", value: String(sim.ordersLate.length), detail: listLabels(sim.ordersLate) || undefined },
        {
          label: "Customer deadlines",
          value: String(sim.customersAffected.length),
          detail: listLabels(sim.customersAffected) || undefined,
        },
        { label: "Revenue on late orders", value: formatMoney(sim.revenueAtRisk, currency) },
        {
          label: "Cash this period",
          value: formatMoney(sim.cashInPeriod, currency),
          detail: "Remaining in-period invoices. Clone only.",
        },
      ],
    },
    {
      kind: "DELTA",
      word: "IF THIS RUNS",
      title: "What would change",
      note: cash.note,
      facts: [
        { label: "Shipment shift", value: `+${delta.shipmentShiftDays} days` },
        {
          label: "Commitments missed",
          value: signed(delta.commitmentsMissed.delta),
          detail: listLabels(delta.commitmentsMissed.added) || undefined,
        },
        {
          label: "Customer deadlines",
          value: signed(delta.customersAffected.delta),
          detail: listLabels(delta.customersAffected.added) || undefined,
        },
        {
          label: "Revenue on late orders",
          value: signedMoney(delta.revenueAtRisk.delta, currency),
          detail: "Newly late orders — not lost associated revenue.",
        },
        {
          label: "Cash timing",
          value: cash.movedAmount > 0 ? `${formatMoney(cash.movedAmount, currency)} next period` : "No move",
          detail: cash.movedAmount > 0 ? cash.invoicesLabel : undefined,
        },
        { label: "Invoice that moves", value: cash.movedAmount > 0 ? cash.invoicesLabel || "—" : "None" },
      ],
    },
  ];
}

export function presentIsolation(isolation: IsolationReport): string {
  return isolation.unchanged
    ? `Isolation verified · twin fingerprint unchanged · ${isolation.tablesChecked} tables · ${isolation.fingerprintAfter}`
    : `WARNING · REAL STATE CHANGED · ${isolation.fingerprintAfter}`;
}

export function presentSimulation(result: SimulationResult): SimulationView {
  return {
    banner: SIMULATION_BANNER,
    headlines: presentHeadlines(result),
    cashTiming: presentCashTiming(result.delta, result.simulated.currency),
    worlds: presentWorlds(result),
    isolationLine: presentIsolation(result.isolation),
  };
}

export function presentCausalChain(model: CausalExplorerModel): string {
  const supplier = columnNodes(model, "cause")[0]?.label ?? "Atlas Supply";
  const shipment = columnNodes(model, "event")[0]?.label ?? "SH-204";
  const product = columnNodes(model, "dependency")[0]?.label ?? "RK-7";
  const orders = columnNodes(model, "orders");
  const customers = columnNodes(model, "customers");
  return `${supplier} → ${shortEntity(shipment, "SH-204")} → ${shortEntity(product, "RK-7")} → ${orders.length || model.orders} orders → ${customers.length || model.customers} customers`;
}

export function presentCausalImpact(model: CausalExplorerModel): CausalImpactCopy {
  return {
    chain: presentCausalChain(model),
    orders: String(model.orders),
    customers: String(model.customers),
    associated: { value: model.revenueLabel, caption: ASSOCIATED_CAPTION },
    cashTiming: { value: model.cashLabel, caption: CASH_TIMING_CAPTION },
  };
}
