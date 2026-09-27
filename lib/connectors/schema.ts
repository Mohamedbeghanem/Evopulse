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

    CREATE TABLE IF NOT EXISTS connector_tool_calls (
      id TEXT PRIMARY KEY,
      install_id TEXT NOT NULL,
      tool TEXT NOT NULL,
      permission TEXT NOT NULL,
      policy_outcome TEXT NOT NULL,
      status TEXT NOT NULL,
      action_id TEXT,
      actor TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_connector_tool_calls_install ON connector_tool_calls(install_id, created_at);

    CREATE TABLE IF NOT EXISTS connector_oauth_states (
      state TEXT PRIMARY KEY,
      install_id TEXT NOT NULL,
      sealed TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  // Additive columns (admin plugins + MCP auth). SQLite has no ADD COLUMN IF NOT EXISTS.
  const columns = new Set((db.prepare("PRAGMA table_info(connector_installs)").all() as { name: string }[]).map((c) => c.name));
  const add: [string, string][] = [
    ["catalog_id", "TEXT NOT NULL DEFAULT ''"],
    ["instructions", "TEXT NOT NULL DEFAULT ''"],
    ["disabled_tools", "TEXT NOT NULL DEFAULT '[]'"],
    ["last_used_at", "TEXT"],
    ["auth", "TEXT NOT NULL DEFAULT ''"],
    ["auth_status", "TEXT NOT NULL DEFAULT 'none'"],
    ["transport_used", "TEXT NOT NULL DEFAULT ''"],
    ["resources", "TEXT NOT NULL DEFAULT '[]'"],
    ["prompts", "TEXT NOT NULL DEFAULT '[]'"],
    ["server_info", "TEXT NOT NULL DEFAULT '{}'"],
  ];
  for (const [name, type] of add) {
    if (!columns.has(name)) db.exec(`ALTER TABLE connector_installs ADD COLUMN ${name} ${type}`);
  }
}
