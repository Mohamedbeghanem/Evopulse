import type { DatabaseSync } from "node:sqlite";
import { all, run } from "../db";
import { id } from "../ids";
import { boundedText } from "./data";
import { redactSecrets } from "./secrets";

/**
 * Activity log of plugin tool calls with their policy outcome. Summaries are bounded + redacted;
 * arguments are never stored here (they live on the governed action row).
 */
export type ToolCallOutcome = "ALLOWED" | "APPROVAL_REQUIRED" | "BLOCKED" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED" | "DENIED";

export type ToolCallLog = {
  id: string;
  install_id: string;
  tool: string;
  permission: string;
  policy_outcome: ToolCallOutcome;
  status: string;
  action_id: string | null;
  actor: string;
  summary: string;
  created_at: string;
};

export function logToolCall(
  db: DatabaseSync,
  entry: {
    installId: string;
    tool: string;
    permission: "READ" | "WRITE";
    outcome: ToolCallOutcome;
    status: string;
    actionId?: string | null;
    actor: string;
    summary?: string;
    secrets?: string[];
  },
) {
  try {
    run(
      db,
      `INSERT INTO connector_tool_calls (id, install_id, tool, permission, policy_outcome, status, action_id, actor, summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id("ctc"),
        entry.installId,
        boundedText(entry.tool, 120),
        entry.permission,
        entry.outcome,
        entry.status,
        entry.actionId || null,
        boundedText(entry.actor || "", 80),
        redactSecrets(boundedText(entry.summary || "", 300), entry.secrets || []),
        new Date().toISOString(),
      ],
    );
    run(db, "UPDATE connector_installs SET last_used_at = ? WHERE id = ?", [new Date().toISOString(), entry.installId]);
  } catch {
    /* activity logging must never break a governed call */
  }
}

export function toolCallLog(db: DatabaseSync, installId: string, limit = 50): ToolCallLog[] {
  return all<ToolCallLog>(db, "SELECT * FROM connector_tool_calls WHERE install_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?", [installId, limit]);
}
