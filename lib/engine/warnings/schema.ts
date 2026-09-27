import type { DatabaseSync } from "node:sqlite";

/** Early-warning tables. Failures that have already happened stay in `exceptions`. */
export function migrateWarningTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS warnings (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      buffer_state TEXT NOT NULL,
      kind TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      entity_label TEXT NOT NULL,
      headline TEXT NOT NULL,
      summary TEXT NOT NULL,
      explanation TEXT NOT NULL,
      available_hours REAL,
      required_hours REAL,
      shortfall_hours REAL,
      buffer_hours REAL,
      deadline_at TEXT,
      projected_at TEXT,
      value_amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'DZD',
      cash_amount REAL NOT NULL DEFAULT 0,
      confidence REAL NOT NULL,
      source TEXT NOT NULL,
      source_event_id TEXT,
      domain TEXT NOT NULL,
      exception_id TEXT,
      evidence_json TEXT NOT NULL,
      children_json TEXT NOT NULL DEFAULT '[]',
      context_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_warnings_status ON warnings(status);
    CREATE INDEX IF NOT EXISTS idx_warnings_entity ON warnings(entity_type, entity_id);
  `);

  const cols = new Set(
    (db.prepare("PRAGMA table_info(exceptions)").all() as { name: string }[]).map((c) => c.name),
  );
  if (!cols.has("warning_id")) {
    db.exec("ALTER TABLE exceptions ADD COLUMN warning_id TEXT");
  }
}
