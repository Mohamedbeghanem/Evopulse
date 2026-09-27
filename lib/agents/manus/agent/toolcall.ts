/**
 * Port of OpenManus `app/agent/toolcall.py` (ToolCallAgent).
 * think(): ask the model (via the OpenRouter gateway, or the deterministic runtime) for tool calls.
 * act():   run each call through the ToolCollection, record observations, handle special tools.
 */
import type { PlannedCall } from "../../../agent/playbooks";
import { DeterministicManusLLM, type ManusLLM, type ThinkResponse } from "../llm";
import type { ToolCall } from "../schema";
import type { ManusApprovalRef, ManusToolContext, ManusToolOutcome } from "../tool";
import { ToolCollection } from "../tool-collection";
import { ASK_HUMAN, TERMINATE } from "../tools/control";
import { ReActAgent } from "./react";
import type { BaseAgentOptions } from "./base";

export type ToolChoice = "auto" | "required" | "none";

export type ToolCallAgentOptions = BaseAgentOptions & {
  llm: ManusLLM;
  tools: ToolCollection;
  ctx: ManusToolContext;
  goal: string;
  businessData?: string[];
  toolChoice?: ToolChoice;
  maxObserve?: number;
};

export type ToolExchange = { call: ToolCall; outcome: ManusToolOutcome };

export class ToolCallAgent extends ReActAgent {
  llm: ManusLLM;
  availableTools: ToolCollection;
  ctx: ManusToolContext;
  goal: string;
  businessData: string[];
  toolChoice: ToolChoice;
  specialToolNames = [TERMINATE, ASK_HUMAN];
  maxObserve: number;
  toolCalls: ToolCall[] = [];
  /** Deterministic runtime: planned calls + text for the current plan step (set by the flow). */
  plannedCalls: PlannedCall[] | undefined;
  stepText = "";
  /** Approvals created during the current run(). */
  pendingApprovals: ManusApprovalRef[] = [];
  exchanges: ToolExchange[] = [];
  question: string | null = null;
  terminateStatus: "success" | "failure" | null = null;
  modelUsed: string | undefined;
  fallbackUsed = false;
  fallbackReason: string | null = null;

  constructor(options: ToolCallAgentOptions) {
    super({ name: "toolcall", maxSteps: 30, ...options });
    this.llm = options.llm;
    this.availableTools = options.tools;
    this.ctx = options.ctx;
    this.goal = options.goal;
    this.businessData = options.businessData || [];
    this.toolChoice = options.toolChoice || "auto";
    this.maxObserve = options.maxObserve ?? 4_000;
  }

  override async run(request?: string) {
    this.pendingApprovals = [];
    this.exchanges = [];
    this.question = null;
    this.terminateStatus = null;
    return super.run(request);
  }

  async think(): Promise<boolean> {
    const task = this.runMessages().find((m) => m.role === "user")?.content || "";
    const request = {
      system: this.systemPrompt,
      goal: this.goal,
      stepPrompt: [task, this.nextStepPrompt].filter(Boolean).join("\n\n"),
      messages: this.runMessages(),
      tools: this.toolChoice === "none" ? [] : this.availableTools.toParams(),
      businessData: this.businessData,
      plannedCalls: this.plannedCalls,
      stepText: this.stepText,
    };
    let response: ThinkResponse;
    try {
      response = await this.llm.askTool(request);
    } catch (error) {
      if (this.llm.mode !== "openrouter") throw error;
      // Model path failed (free-tier limits, outage, bad output): the deterministic runtime continues.
      this.fallbackUsed = true;
      this.fallbackReason = error instanceof Error ? error.message : "Model unavailable.";
      this.emit("fallback", { reason: this.fallbackReason });
      this.llm = new DeterministicManusLLM();
      response = await this.llm.askTool(request);
    }
    if (response.model) this.modelUsed = response.model;
    this.toolCalls = this.toolChoice === "none" ? [] : response.toolCalls;
    this.emit("thought", {
      content: response.content,
      tools: this.toolCalls.map((call) => call.name),
      runtime: this.llm.mode,
      model: response.model || null,
    });
    this.updateMemory("assistant", response.content, { toolCalls: this.toolCalls });
    if (!this.toolCalls.length) {
      // OpenManus keeps looping on a content-only answer; EvoPulse treats it as "step done" to save budget.
      this.finish("no_tool_call");
      return false;
    }
    return true;
  }

  async act(): Promise<string> {
    const results: string[] = [];
    for (const call of this.toolCalls) {
      const outcome = await this.executeTool(call);
      let observation = outcome.output;
      if (observation.length > this.maxObserve) observation = `${observation.slice(0, this.maxObserve)}…[truncated]`;
      this.updateMemory("tool", observation, { toolCallId: call.id, name: call.name });
      this.exchanges.push({ call, outcome });
      this.emit("tool_result", {
        id: call.id,
        name: call.name,
        status: outcome.status,
        output: observation.slice(0, 1_500),
        error: outcome.error || null,
        links: outcome.links || [],
        toolCallId: outcome.toolCallId || null,
      });
      for (const approval of outcome.approvals || []) {
        this.pendingApprovals.push(approval);
        this.emit("approval", { ...approval, tool: call.name });
      }
      results.push(`Observed output of cmd \`${call.name}\` executed:\n${observation}`);
      if (this.handleSpecialTool(call, outcome)) break;
    }
    return results.join("\n\n");
  }

  async executeTool(call: ToolCall): Promise<ManusToolOutcome> {
    if (!call || !call.name) return { status: "failed", output: "Error: Invalid command format", error: "invalid" };
    let args: Record<string, unknown> = {};
    const raw = call.arguments as unknown;
    if (typeof raw === "string") {
      try {
        args = JSON.parse(raw || "{}") as Record<string, unknown>;
      } catch {
        return { status: "failed", output: `Error parsing arguments for ${call.name}: Invalid JSON format`, error: "invalid json" };
      }
    } else if (raw && typeof raw === "object") {
      args = raw as Record<string, unknown>;
    }
    const tool = this.availableTools.get(call.name);
    this.emit("tool_call", { id: call.id, name: call.name, arguments: args, kind: tool?.available ? tool.kind : "refused" });
    return this.availableTools.execute(call.name, args, this.ctx);
  }

  /** Returns true when the run must stop after this call. */
  private handleSpecialTool(call: ToolCall, outcome: ManusToolOutcome): boolean {
    if (call.name === TERMINATE && outcome.status === "ok") {
      this.terminateStatus = outcome.data?.status === "failure" ? "failure" : "success";
      this.emit("terminate", { status: this.terminateStatus });
      this.finish("terminated");
      return true;
    }
    if (call.name === ASK_HUMAN && outcome.status === "ok") {
      this.question = String(outcome.data?.inquire || "");
      this.emit("ask_human", { question: this.question });
      this.finish("awaiting_human");
      return true;
    }
    if (outcome.data?.loopLimit && !outcome.data?.repeated) {
      this.finish("limit");
      return true;
    }
    return false;
  }
}
