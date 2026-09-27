import type { DatabaseSync } from "node:sqlite";

export function migrateCommandTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_sessions (
      id TEXT PRIMARY KEY,
      last_intent TEXT NOT NULL DEFAULT '',
      last_entity_ids TEXT NOT NULL DEFAULT '[]',
      last_warning_id TEXT,
      last_exception_id TEXT,
      last_goal_id TEXT,
      updated_at TEXT NOT NULL
    );
  `);
}

export function wipeCommandTables(db: DatabaseSync) {
  migrateCommandTables(db);
  db.exec("DELETE FROM command_sessions");
}
