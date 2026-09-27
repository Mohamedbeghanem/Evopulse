import type { DatabaseSync } from "node:sqlite";

export function migrateAgentTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_run_id TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      command TEXT NOT NULL,
      intent TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      phase TEXT NOT NULL,
      runtime TEXT NOT NULL,
      fallback_used INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      summary TEXT NOT NULL DEFAULT '',
      report TEXT NOT NULL DEFAULT '{}',
      context TEXT NOT NULL DEFAULT '{}',
      started_at TEXT NOT NULL,
      finished_at TEXT,
      cancelled_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_trace_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      tool TEXT,
      tool_call_id TEXT,
      decision TEXT,
      policy TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_tool_calls (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      tool TEXT NOT NULL,
      permission TEXT NOT NULL,
      arguments TEXT NOT NULL,
      result TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL,
      idempotency_key TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_approvals (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      action_id TEXT NOT NULL,
      plan_id TEXT,
      title TEXT NOT NULL,
      why TEXT NOT NULL,
      impact TEXT NOT NULL DEFAULT '',
      policy TEXT NOT NULL DEFAULT '',
      evidence TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      decided_at TEXT,
      decided_by TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_idempotency (
      key TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_agent_runs_session ON agent_runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_agent_steps_run ON agent_trace_steps(run_id, seq);
    CREATE INDEX IF NOT EXISTS idx_agent_calls_run ON agent_tool_calls(run_id, seq);
  `);
}

export function wipeAgentTables(db: DatabaseSync) {
  migrateAgentTables(db);
  db.exec(`
    DELETE FROM agent_idempotency;
    DELETE FROM agent_approvals;
    DELETE FROM agent_tool_calls;
    DELETE FROM agent_trace_steps;
    DELETE FROM agent_runs;
    DELETE FROM agent_sessions;
  `);
}
