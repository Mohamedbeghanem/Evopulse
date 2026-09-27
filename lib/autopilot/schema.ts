import type { DatabaseSync } from "node:sqlite";

export function migrateAutopilotTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS autopilot_decisions (
      id TEXT PRIMARY KEY,
      situation_type TEXT NOT NULL,
      situation_id TEXT NOT NULL,
      classification TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      warning_id TEXT,
      exception_id TEXT,
      goal_id TEXT,
      plan_id TEXT,
      action_id TEXT,
      policy_decision TEXT,
      impact_summary TEXT NOT NULL DEFAULT '{}',
      evidence TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_autopilot_situation
      ON autopilot_decisions(situation_type, situation_id);
    CREATE INDEX IF NOT EXISTS idx_autopilot_class ON autopilot_decisions(classification);
  `);
}

export const AUTOPILOT_TABLES = ["autopilot_decisions"] as const;

export function wipeAutopilotTables(db: DatabaseSync) {
  migrateAutopilotTables(db);
  for (const table of AUTOPILOT_TABLES) db.exec(`DELETE FROM ${table}`);
}
