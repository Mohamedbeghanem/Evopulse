import type { DatabaseSync } from "node:sqlite";

/**
 * Adaptive Autonomy tables. Additive only; called from lib/db.ts migrate.
 * The emergency pause lives in `meta` (key AUTONOMY_PAUSE_META_KEY), so no table is needed for it.
 */
export function migrateAutonomyTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS autonomy_profiles (
      action_type TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 0,
      suspended INTEGER NOT NULL DEFAULT 0,
      suspended_reason TEXT NOT NULL DEFAULT '',
      candidate_level INTEGER,
      verified_outcomes INTEGER NOT NULL DEFAULT 0,
      successes INTEGER NOT NULL DEFAULT 0,
      failures INTEGER NOT NULL DEFAULT 0,
      override_rate REAL NOT NULL DEFAULT 0,
      evidence_mark INTEGER NOT NULL DEFAULT 0,
      last_change_kind TEXT NOT NULL DEFAULT '',
      last_change_by TEXT NOT NULL DEFAULT '',
      last_change_reason TEXT NOT NULL DEFAULT '',
      last_change_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS autonomy_changes (
      id TEXT PRIMARY KEY,
      action_type TEXT NOT NULL,
      kind TEXT NOT NULL,
      from_level INTEGER,
      to_level INTEGER,
      actor TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_autonomy_changes_type ON autonomy_changes(action_type, created_at);
  `);
}

export const AUTONOMY_TABLES = ["autonomy_changes", "autonomy_profiles"] as const;
export const AUTONOMY_PAUSE_META_KEY = "autonomy_emergency_pause";

export function wipeAutonomyTables(db: DatabaseSync) {
  migrateAutonomyTables(db);
  for (const table of AUTONOMY_TABLES) db.exec(`DELETE FROM ${table}`);
  db.prepare("DELETE FROM meta WHERE key = ?").run(AUTONOMY_PAUSE_META_KEY);
}
