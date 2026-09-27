import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  presentCashTiming,
  presentCausalChain,
  presentCausalImpact,
  presentHeadlines,
  presentIsolation,
  presentSimulation,
  presentWorlds,
  SIMULATION_BANNER,
} from "../components/sim/copy";
import { buildCausalExplorer } from "../lib/engine/causal";
import { getDb, resetDbFile } from "../lib/db";
import { IDS } from "../lib/ids";
import { simulateSnapshot } from "../lib/simulation";
import type { IsolationReport, SimulationResult } from "../lib/simulation/types";
import { ATLAS_SUPPLY_FIXTURE } from "./fixtures/atlas-supply";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-sim-copy-")), "sim-copy.db");
resetDbFile();

const PLUS_3 = { type: "supplier_delay" as const, targetId: IDS.shipment, days: 3 };
const ISOLATION: IsolationReport = {
  fingerprintBefore: "before",
  fingerprintAfter: "before",
  unchanged: true,
  tablesChecked: 12,
};

function asResult(): SimulationResult {
  const raw = simulateSnapshot(ATLAS_SUPPLY_FIXTURE, PLUS_3);
  return { ...raw, isolation: ISOLATION };
}

describe("simulation presentation mapping", { concurrency: 1 }, () => {
  it("names Invoice C 160,000 DZD as the +3 day cash timing move — not 540K", () => {
    const result = asResult();
    assert.equal(result.delta.cash.movedToNextPeriod, 160000);
    assert.equal(result.baseline.cashInPeriod, 540000);

    const cash = presentCashTiming(result.delta, result.simulated.currency);
    assert.equal(cash.movedAmount, 160000);
    assert.match(cash.headline, /Invoice C/);
    assert.match(cash.headline, /160,000 DZD/);
    assert.match(cash.headline, /cash timing moves into next period/);
    assert.doesNotMatch(cash.headline, /540/);

    const headlines = presentHeadlines(result);
    assert.ok(headlines.some((line) => /Invoice C 160,000 DZD cash timing moves into next period/.test(line)));
    assert.equal(
      headlines.some((line) => /540/.test(line) && /moves into next period/.test(line)),
      false,
    );

    const view = presentSimulation(result);
    assert.equal(view.banner, SIMULATION_BANNER);
    const live = view.worlds.find((world) => world.kind === "LIVE")!;
    const sim = view.worlds.find((world) => world.kind === "SIMULATION")!;
    const delta = view.worlds.find((world) => world.kind === "DELTA")!;
    assert.equal(live.word, "REALITY");
    assert.equal(sim.word, "NOT REAL");
    assert.equal(delta.word, "IF THIS RUNS");
    assert.equal(live.facts.find((fact) => fact.label === "Cash this period")?.value, "540,000 DZD");
    assert.equal(sim.facts.find((fact) => fact.label === "Cash this period")?.value, "380,000 DZD");
    assert.equal(delta.facts.find((fact) => fact.label === "Cash timing")?.value, "160,000 DZD next period");
    assert.equal(delta.facts.find((fact) => fact.label === "Invoice that moves")?.value, "Invoice C");
    assert.doesNotMatch(delta.facts.find((fact) => fact.label === "Cash timing")?.value ?? "", /540/);
    assert.match(view.isolationLine, /Isolation verified/);
  });

  it("does not invent a 160K move when the engine reports none", () => {
    const raw = simulateSnapshot(ATLAS_SUPPLY_FIXTURE, { ...PLUS_3, days: 1 });
    assert.equal(raw.delta.cash.movedToNextPeriod, 0);
    const cash = presentCashTiming(raw.delta, raw.simulated.currency);
    assert.equal(cash.movedAmount, 0);
    assert.equal(cash.headline, "No cash timing move");
    const delta = presentWorlds({ ...raw, scenario: { ...PLUS_3, days: 1 } }).find((world) => world.kind === "DELTA")!;
    assert.equal(delta.facts.find((fact) => fact.label === "Cash timing")?.value, "No move");
    assert.equal(delta.facts.find((fact) => fact.label === "Invoice that moves")?.value, "None");
  });

  it("keeps isolation failure language distinct from a verified discard", () => {
    const ok = presentIsolation(ISOLATION);
    const fail = presentIsolation({ ...ISOLATION, unchanged: false, fingerprintAfter: "changed" });
    assert.match(ok, /unchanged/);
    assert.match(fail, /REAL STATE CHANGED/);
  });
});

describe("causal presentation mapping", { concurrency: 1 }, () => {
  it("explains Atlas Supply → SH-204 → RK-7 → 3 orders → 3 customers with 850K / 540K captions", () => {
    const model = buildCausalExplorer(getDb());
    assert.equal(presentCausalChain(model), "Atlas Supply → SH-204 → RK-7 → 3 orders → 3 customers");
    const impact = presentCausalImpact(model);
    assert.equal(impact.associated.value, "850,000 DZD");
    assert.equal(impact.cashTiming.value, "540,000 DZD");
    assert.match(impact.associated.caption, /Not a loss/);
    assert.match(impact.cashTiming.caption, /Not a loss/);
    assert.match(impact.associated.caption, /Associated revenue/);
    assert.match(impact.cashTiming.caption, /Expected cash timing/);
  });
});
