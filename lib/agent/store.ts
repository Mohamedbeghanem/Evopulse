import type { DatabaseSync } from "node:sqlite";
import { all, run } from "../db";
import { id } from "../ids";
import type { AgentRunResult } from "./types";

export function persistAgentRun(db: DatabaseSync, result: AgentRunResult) {
  run(
    db,
    `INSERT INTO agent_runs
      (id, command, provider, model, state, duration_ms, tool_names, completion_state, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.id,
      result.command,
      result.provider,
      result.model,
      result.state,
      result.durationMs,
      JSON.stringify(result.toolCalls.map((call) => call.name)),
      result.state,
      JSON.stringify({
        requestedProvider: result.requestedProvider,
        fallbackUsed: result.fallbackUsed,
        fallbackReason: result.fallbackReason,
        grounded: result.grounded,
        unknown: result.unknown,
        events: result.events.map((event) => event.label),
        toolResults: result.toolCalls.map((call) => ({
          name: call.name,
          ok: call.ok,
          forbidden: call.forbidden,
        })),
      }),
      new Date().toISOString(),
    ],
  );
}

export function listAgentRuns(db: DatabaseSync, limit = 20) {
  return all<Record<string, unknown>>(db, "SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT ?", [limit]);
}

export function newAgentRunId(): string {
  return id("agn");
}
