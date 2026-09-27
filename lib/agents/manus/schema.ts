/**
 * Port of OpenManus `app/schema.py` (Message, Memory, AgentState, ToolCall).
 * Copyright (c) 2025 manna_and_poem — MIT. See third_party/openmanus/LICENSE.
 */

export const AGENT_STATES = ["IDLE", "RUNNING", "FINISHED", "ERROR"] as const;
export type AgentState = (typeof AGENT_STATES)[number];

export type Role = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type Message = {
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  /** For role "tool": the call this message answers, and the tool name. */
  toolCallId?: string;
  name?: string;
};

/** Bounded conversation memory (OpenManus `Memory`, max_messages=100). */
export class Memory {
  messages: Message[] = [];

  constructor(readonly maxMessages = 100) {}

  add(message: Message) {
    this.messages.push(message);
    if (this.messages.length > this.maxMessages) this.messages = this.messages.slice(-this.maxMessages);
  }

  recent(n: number): Message[] {
    return this.messages.slice(-n);
  }

  clear() {
    this.messages = [];
  }
}

/** Why an agent run ended. OpenManus only distinguishes FINISHED vs max steps; EvoPulse needs the reason. */
export type FinishReason =
  | "terminated"
  | "no_tool_call"
  | "max_steps"
  | "stuck"
  | "awaiting_human"
  | "limit"
  | "error";
