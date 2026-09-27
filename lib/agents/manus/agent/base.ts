/**
 * Port of OpenManus `app/agent/base.py` (BaseAgent).
 * Step-limited run loop, state machine IDLE → RUNNING → FINISHED/ERROR → IDLE, and stuck detection.
 */
import type { ManusEvent, ManusEventSink } from "../events";
import { STUCK_PROMPT } from "../prompts";
import { Memory, type AgentState, type FinishReason, type Message } from "../schema";

export type BaseAgentOptions = {
  name?: string;
  description?: string;
  systemPrompt?: string;
  nextStepPrompt?: string;
  maxSteps?: number;
  duplicateThreshold?: number;
  onEvent?: ManusEventSink;
};

export type AgentRunOutcome = {
  results: string[];
  finishReason: FinishReason;
  steps: number;
};

export abstract class BaseAgent {
  name: string;
  description: string;
  systemPrompt: string;
  nextStepPrompt: string;
  readonly baseNextStepPrompt: string;
  memory = new Memory();
  state: AgentState = "IDLE";
  maxSteps: number;
  currentStep = 0;
  duplicateThreshold: number;
  /** How many times stuck handling fired in the current run. */
  stuckCount = 0;
  finishReason: FinishReason | null = null;
  /** Plan step the agent is working on (set by the flow), for trace events. */
  stepIndex: number | null = null;
  /** Index in memory where the current run() started. */
  protected runStart = 0;
  protected readonly onEvent?: ManusEventSink;

  constructor(options: BaseAgentOptions = {}) {
    this.name = options.name || "agent";
    this.description = options.description || "";
    this.systemPrompt = options.systemPrompt || "";
    this.nextStepPrompt = options.nextStepPrompt || "";
    this.baseNextStepPrompt = this.nextStepPrompt;
    this.maxSteps = options.maxSteps ?? 10;
    this.duplicateThreshold = options.duplicateThreshold ?? 2;
    this.onEvent = options.onEvent;
  }

  abstract step(): Promise<string>;

  protected emit(kind: ManusEvent["kind"], payload: Record<string, unknown>) {
    this.onEvent?.({ kind, stepIndex: this.stepIndex, agentStep: this.currentStep || null, payload });
  }

  updateMemory(role: Message["role"], content: string, extra: Partial<Message> = {}) {
    this.memory.add({ role, content, ...extra });
  }

  /** Messages produced during the current run() (the current plan step). */
  runMessages(): Message[] {
    return this.memory.messages.slice(this.runStart);
  }

  async run(request?: string): Promise<AgentRunOutcome> {
    if (this.state !== "IDLE") throw new Error(`Cannot run agent from state: ${this.state}`);
    this.runStart = this.memory.messages.length;
    if (request) this.updateMemory("user", request);
    const results: string[] = [];
    this.state = "RUNNING";
    this.currentStep = 0;
    this.stuckCount = 0;
    this.finishReason = null;
    this.nextStepPrompt = this.baseNextStepPrompt;
    try {
      while (this.currentStep < this.maxSteps && !this.isFinished()) {
        this.currentStep += 1;
        const result = await this.step();
        if (!this.isFinished() && this.isStuck()) this.handleStuckState();
        results.push(`Step ${this.currentStep}: ${result}`);
      }
      if (!this.isFinished() && this.currentStep >= this.maxSteps) {
        this.finishReason = "max_steps";
        results.push(`Terminated: Reached max steps (${this.maxSteps})`);
        this.emit("max_steps", { maxSteps: this.maxSteps });
      }
      return { results, finishReason: this.finishReason || "terminated", steps: this.currentStep };
    } catch (error) {
      this.state = "ERROR";
      this.finishReason = "error";
      throw error;
    } finally {
      // OpenManus state_context: revert to IDLE so the flow can run the agent on the next step.
      this.state = "IDLE";
    }
  }

  isFinished(): boolean {
    return this.state === "FINISHED";
  }

  /** Mark the run finished with a reason (OpenManus sets state = FINISHED). */
  finish(reason: FinishReason) {
    this.state = "FINISHED";
    this.finishReason = reason;
  }

  /**
   * OpenManus `is_stuck`: the latest assistant response is repeated at least `duplicateThreshold`
   * times earlier. EvoPulse compares content + tool calls, within the current run only.
   */
  isStuck(): boolean {
    const assistant = this.runMessages().filter((m) => m.role === "assistant");
    if (assistant.length < 2) return false;
    const last = signature(assistant.at(-1)!);
    if (!last) return false;
    const duplicates = assistant.slice(0, -1).filter((m) => signature(m) === last).length;
    return duplicates >= this.duplicateThreshold;
  }

  /**
   * OpenManus `handle_stuck_state`: prepend a change-strategy prompt. EvoPulse addition: if the agent
   * is still stuck after the strategy change, stop the run instead of burning the step budget.
   */
  handleStuckState() {
    this.stuckCount += 1;
    this.emit("stuck", { count: this.stuckCount, prompt: STUCK_PROMPT });
    if (this.stuckCount > 1) {
      this.finish("stuck");
      return;
    }
    this.nextStepPrompt = `${STUCK_PROMPT}\n${this.nextStepPrompt}`;
  }
}

function signature(message: Message): string {
  const calls = (message.toolCalls || []).map((c) => `${c.name}:${JSON.stringify(c.arguments)}`).join("|");
  const content = message.content.trim();
  return content || calls ? `${content}#${calls}` : "";
}
