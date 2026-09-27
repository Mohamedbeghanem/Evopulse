import type { SimulationScenario } from "./types";

type SimulationRunner = (scenario: SimulationScenario) => unknown;

let runner: SimulationRunner | null = null;

/** Register a simulation engine if one exists. This module does not simulate. */
export function registerSimulationBridge(fn: SimulationRunner): () => void {
  runner = fn;
  return () => {
    if (runner === fn) runner = null;
  };
}

export function simulationAvailable(): boolean {
  return runner !== null;
}

export function runSimulation(scenario: SimulationScenario): { available: false } | { available: true; result: unknown } {
  if (!runner) return { available: false };
  return { available: true, result: runner(scenario) };
}
