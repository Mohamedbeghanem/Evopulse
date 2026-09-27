import type { DatabaseSync } from "node:sqlite";

export function migrateWarningTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS early_warnings (
      id TEXT PRIMARY KEY,
      warning_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      expectation_id TEXT,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      expected_failure_at TEXT,
      available_buffer_minutes INTEGER NOT NULL,
      required_buffer_minutes INTEGER NOT NULL,
      shortfall_minutes INTEGER NOT NULL,
      source_event_id TEXT,
      evidence TEXT NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 1,
      resolved_at TEXT,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_warnings_status ON early_warnings(status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_warnings_type_expectation
      ON early_warnings(warning_type, expectation_id);
  `);
}

export const WARNING_TABLES = ["early_warnings"] as const;

export function wipeWarningTables(db: DatabaseSync) {
  migrateWarningTables(db);
  for (const table of WARNING_TABLES) db.exec(`DELETE FROM ${table}`);
}
