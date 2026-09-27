import type { DatabaseSync } from "node:sqlite";

/** Connector tables live in the workspace business DB. Additive only. */
export function migrateConnectorTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connector_installs (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      secrets TEXT NOT NULL DEFAULT '',
      tools TEXT NOT NULL DEFAULT '[]',
      last_sync_at TEXT,
      last_test_at TEXT,
      last_error TEXT,
      last_result TEXT,
      cursor TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_connector_installs_connector ON connector_installs(connector_id);

    CREATE TABLE IF NOT EXISTS connector_runs (
      id TEXT PRIMARY KEY,
      install_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      stats TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS connector_outbox (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      provider_ref TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
