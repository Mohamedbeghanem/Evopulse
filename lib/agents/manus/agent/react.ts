/** Port of OpenManus `app/agent/react.py` (ReActAgent): step = think, then act. */
import { BaseAgent } from "./base";

export abstract class ReActAgent extends BaseAgent {
  /** Process current state and decide next action. Returns whether to act. */
  abstract think(): Promise<boolean>;

  /** Execute decided actions. */
  abstract act(): Promise<string>;

  async step(): Promise<string> {
    const shouldAct = await this.think();
    if (!shouldAct) return "Thinking complete - no action needed";
    return this.act();
  }
}
