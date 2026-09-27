/** Port of OpenManus `app/flow/flow_factory.py`. */
import { PlanningFlow, type PlanningFlowOptions } from "./planning";

export enum FlowType {
  PLANNING = "planning",
}

export function createFlow(
  flowType: FlowType,
  agents: ConstructorParameters<typeof PlanningFlow>[0],
  options: PlanningFlowOptions,
): PlanningFlow {
  if (flowType === FlowType.PLANNING) return new PlanningFlow(agents, options);
  throw new Error(`Unknown flow type: ${String(flowType)}`);
}
