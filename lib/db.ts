import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { id } from "./ids";

const globalForDb = globalThis as unknown as { evopulseDb?: DatabaseSync };

function dbPath(): string {
  return process.env.DB_PATH || join(process.cwd(), "data", "evopulse.db");
}

function migrate(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      source_id TEXT,
      actor_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      payload TEXT NOT NULL DEFAULT '{}',
      occurred_at TEXT NOT NULL,
      received_at TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_events_occurred ON events(occurred_at);

    CREATE TABLE IF NOT EXISTS commitments (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      actor_entity_id TEXT,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      deadline TEXT NOT NULL,
      status TEXT NOT NULL,
      source_event_id TEXT,
      evidence TEXT NOT NULL,
      confidence REAL NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expectations (
      id TEXT PRIMARY KEY,
      commitment_id TEXT NOT NULL,
      description TEXT NOT NULL,
      due_at TEXT NOT NULL,
      status TEXT NOT NULL,
      actual TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dependencies (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      from_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      to_type TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      payload TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      expectation_id TEXT,
      opportunity_id TEXT,
      attention TEXT NOT NULL,
      severity TEXT NOT NULL,
      urgency TEXT NOT NULL,
      impact_json TEXT NOT NULL,
      evidence_json TEXT NOT NULL,
      confidence REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      exception_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      exception_id TEXT NOT NULL,
      plan_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      policy_outcome TEXT NOT NULL,
      policy_reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      plan_id TEXT,
      action_id TEXT,
      status TEXT NOT NULL,
      decided_at TEXT,
      decided_by TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      object_type TEXT NOT NULL,
      object_id TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      label TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY,
      source_node_id TEXT NOT NULL,
      target_node_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      source_event_id TEXT,
      confidence REAL NOT NULL DEFAULT 1,
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS expectation_changes (
      id TEXT PRIMARY KEY,
      expectation_id TEXT NOT NULL,
      source_event_id TEXT,
      original_due_at TEXT NOT NULL,
      new_due_at TEXT NOT NULL,
      delta_days INTEGER NOT NULL,
      reason TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON graph_edges(source_node_id);
    CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON graph_edges(target_node_id);
  `);
  migrateEventsTable(db);
  const { migrateLearningTables } = require("./learning/schema") as typeof import("./learning/schema");
  migrateLearningTables(db);
}

function migrateEventsTable(db: DatabaseSync) {
  const cols = new Set(
    (db.prepare("PRAGMA table_info(events)").all() as { name: string }[]).map((c) => c.name),
  );
  const add = (sql: string) => db.exec(sql);
  if (!cols.has("source_id")) add("ALTER TABLE events ADD COLUMN source_id TEXT");
  if (!cols.has("actor_id")) add("ALTER TABLE events ADD COLUMN actor_id TEXT");
  if (!cols.has("entity_type")) add("ALTER TABLE events ADD COLUMN entity_type TEXT");
  if (!cols.has("received_at")) {
    add("ALTER TABLE events ADD COLUMN received_at TEXT NOT NULL DEFAULT ''");
    if (cols.has("created_at")) {
      db.exec("UPDATE events SET received_at = created_at WHERE received_at IS NULL OR received_at = ''");
    } else {
      db.exec("UPDATE events SET received_at = occurred_at WHERE received_at IS NULL OR received_at = ''");
    }
  }
  if (!cols.has("confidence")) add("ALTER TABLE events ADD COLUMN confidence REAL NOT NULL DEFAULT 1");
  if (!cols.has("metadata")) add("ALTER TABLE events ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'");
}

export function getDb(): DatabaseSync {
  if (globalForDb.evopulseDb) {
    migrate(globalForDb.evopulseDb);
    return globalForDb.evopulseDb;
  }
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  migrate(db);
  // Lazy import avoids a db ↔ seed cycle.
  const { seedIfEmpty } = require("./seed") as typeof import("./seed");
  seedIfEmpty(db);
  globalForDb.evopulseDb = db;
  return db;
}

export function resetDbFile() {
  const path = dbPath();
  if (globalForDb.evopulseDb) {
    try {
      globalForDb.evopulseDb.close();
    } catch {
      /* ignore */
    }
    globalForDb.evopulseDb = undefined;
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${path}${suffix}`;
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch {
        /* ignore */
      }
    }
  }
}

export function all<T>(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function one<T>(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
  return db.prepare(sql).run(...params);
}

export function getMeta(db: DatabaseSync, key: string, fallback = ""): string {
  const row = one<{ value: string }>(db, "SELECT value FROM meta WHERE key = ?", [key]);
  return row?.value ?? fallback;
}

export function setMeta(db: DatabaseSync, key: string, value: string) {
  run(db, "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    key,
    value,
  ]);
}

export function audit(
  db: DatabaseSync,
  actor: string,
  action: string,
  objectType: string,
  objectId: string,
  payload: unknown = {},
) {
  run(
    db,
    `INSERT INTO audit_logs (id, actor, action, object_type, object_id, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id("aud"), actor, action, objectType, objectId, JSON.stringify(payload), new Date().toISOString()],
  );
}
