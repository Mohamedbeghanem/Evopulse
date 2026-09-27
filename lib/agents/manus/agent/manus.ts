/**
 * Port of OpenManus `app/agent/manus.py` (Manus): a general ToolCallAgent with EvoPulse prompts and
 * EvoPulse tools instead of PythonExecute / StrReplaceEditor / BrowserUse (see docs/OPENMANUS.md).
 */
import { MANUS_NEXT_STEP_PROMPT, MANUS_SYSTEM_PROMPT } from "../prompts";
import { ToolCallAgent, type ToolCallAgentOptions } from "./toolcall";

export class ManusAgent extends ToolCallAgent {
  constructor(options: ToolCallAgentOptions) {
    super({
      name: "Manus",
      description: "A versatile agent that works on EvoPulse business records through governed tools.",
      systemPrompt: MANUS_SYSTEM_PROMPT,
      nextStepPrompt: MANUS_NEXT_STEP_PROMPT,
      maxSteps: 8,
      maxObserve: 4_000,
      ...options,
    });
  }
}
