/** Port of OpenManus `app/flow/base.py` (BaseFlow): a set of agents with a primary one. */
import type { ToolCallAgent } from "../agent/toolcall";

export abstract class BaseFlow {
  readonly agents: Record<string, ToolCallAgent>;
  primaryAgentKey: string;

  constructor(agents: ToolCallAgent | ToolCallAgent[] | Record<string, ToolCallAgent>, primaryAgentKey?: string) {
    if (Array.isArray(agents)) this.agents = Object.fromEntries(agents.map((agent, i) => [`agent_${i}`, agent]));
    else if ("run" in agents && typeof (agents as ToolCallAgent).run === "function") this.agents = { default: agents as ToolCallAgent };
    else this.agents = agents as Record<string, ToolCallAgent>;
    this.primaryAgentKey = primaryAgentKey || Object.keys(this.agents)[0];
  }

  get primaryAgent(): ToolCallAgent {
    return this.agents[this.primaryAgentKey];
  }

  getAgent(key: string): ToolCallAgent | undefined {
    return this.agents[key];
  }

  abstract execute(input: string): Promise<unknown>;
}
