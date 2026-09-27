import { AsyncLocalStorage } from "node:async_hooks";
import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { id } from "./ids";
import { toPlain } from "./plain";

const globalForDb = globalThis as unknown as { evopulseDb?: DatabaseSync };
const dbContext = new AsyncLocalStorage<DatabaseSync>();

/** Run engine code against a specific business database without rewriting getDb() callers. */
export function runWithDb<T>(db: DatabaseSync, fn: () => T): T {
  return dbContext.run(db, fn);
}

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
      updated_at TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'event',
      entity_id TEXT,
      expected_event TEXT NOT NULL DEFAULT '',
      expected_at TEXT NOT NULL DEFAULT '',
      source_type TEXT NOT NULL DEFAULT 'commitment',
      source_id TEXT,
      confidence REAL NOT NULL DEFAULT 1,
      condition TEXT NOT NULL DEFAULT '{}',
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_expectations_status ON expectations(status);

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
      created_at TEXT NOT NULL,
      detected_at TEXT
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
  migrateAutonomy(db);
  migrateEventsTable(db);
  migrateExpectationsTable(db);
  migrateExceptionsTable(db);
  const { migrateLearningTables } = require("./learning/schema") as typeof import("./learning/schema");
  migrateLearningTables(db);
  const { migrateGoalTables } = require("./goals/schema") as typeof import("./goals/schema");
  migrateGoalTables(db);
  const { migrateWarningTables } = require("./warnings/schema") as typeof import("./warnings/schema");
  migrateWarningTables(db);
  const { migrateCommandTables } = require("./command/schema") as typeof import("./command/schema");
  migrateCommandTables(db);
  const { migrateAutopilotTables } = require("./autopilot/schema") as typeof import("./autopilot/schema");
  migrateAutopilotTables(db);
  const { migrateAgentTables } = require("./agent/schema") as typeof import("./agent/schema");
  migrateAgentTables(db);
  const { migrateConnectorTables } = require("./connectors/schema") as typeof import("./connectors/schema");
  migrateConnectorTables(db);
}

/** Adaptive Autonomy tables (lib/autonomy). Additive only. */
function migrateAutonomy(db: DatabaseSync) {
  const { migrateAutonomyTables } = require("./autonomy/schema") as typeof import("./autonomy/schema");
  migrateAutonomyTables(db);
}

function migrateEventsTable(db: DatabaseSync) {
  const cols = new Set(
    (db.prepare("PRAGMA table_info(events)").all() as { name: string }[]).map((c) => c.name),
  );
  const add = (sql: string) => db.exec(sql);
  if (!cols.has("source_id")) add("ALTER TABLE events ADD COLUMN source_id TEXT");
  if (!cols.has("actor_id")) add("ALTER TABLE events ADD COLUMN actor_id TEXT");
  if (!cols.has("entity_type")) add("ALTER TABLE events ADD COLUMN entity_type TEXT");
  if (!cols.has("entity_id")) add("ALTER TABLE events ADD COLUMN entity_id TEXT");
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
  db.exec("CREATE INDEX IF NOT EXISTS idx_events_entity ON events(entity_type, entity_id)");
}

function tableColumns(db: DatabaseSync, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
}

function migrateExpectationsTable(db: DatabaseSync) {
  const cols = tableColumns(db, "expectations");
  const add = (sql: string) => db.exec(sql);
  if (!cols.has("type")) add("ALTER TABLE expectations ADD COLUMN type TEXT NOT NULL DEFAULT 'event'");
  if (!cols.has("entity_id")) add("ALTER TABLE expectations ADD COLUMN entity_id TEXT");
  if (!cols.has("expected_event")) add("ALTER TABLE expectations ADD COLUMN expected_event TEXT NOT NULL DEFAULT ''");
  if (!cols.has("expected_at")) add("ALTER TABLE expectations ADD COLUMN expected_at TEXT NOT NULL DEFAULT ''");
  if (!cols.has("source_type")) add("ALTER TABLE expectations ADD COLUMN source_type TEXT NOT NULL DEFAULT 'commitment'");
  if (!cols.has("source_id")) add("ALTER TABLE expectations ADD COLUMN source_id TEXT");
  if (!cols.has("confidence")) add("ALTER TABLE expectations ADD COLUMN confidence REAL NOT NULL DEFAULT 1");
  if (!cols.has("condition")) add("ALTER TABLE expectations ADD COLUMN condition TEXT NOT NULL DEFAULT '{}'");
  if (!cols.has("resolved_at")) add("ALTER TABLE expectations ADD COLUMN resolved_at TEXT");
  db.exec("UPDATE expectations SET expected_at = due_at WHERE expected_at IS NULL OR expected_at = ''");
  db.exec("UPDATE expectations SET source_id = commitment_id WHERE (source_id IS NULL OR source_id = '') AND commitment_id IS NOT NULL AND commitment_id != ''");
  const rows = db.prepare("SELECT id, commitment_id FROM expectations WHERE expected_event IS NULL OR expected_event = ''").all() as {
    id: string;
    commitment_id: string;
  }[];
  const map: Record<string, string> = {
    send_revised_proposal: "quote.sent",
    provide_decision: "customer.decision",
    receive_shipment: "shipment.arrived",
    deliver_order: "order.delivered",
  };
  for (const row of rows) {
    const commitment = db.prepare("SELECT action FROM commitments WHERE id = ?").get(row.commitment_id) as
      | { action: string }
      | undefined;
    const expected = commitment ? map[commitment.action] : undefined;
    if (expected) {
      db.prepare("UPDATE expectations SET expected_event = ? WHERE id = ?").run(expected, row.id);
    }
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_expectations_expected_event ON expectations(expected_event)");
}

function migrateExceptionsTable(db: DatabaseSync) {
  const cols = tableColumns(db, "exceptions");
  if (!cols.has("detected_at")) db.exec("ALTER TABLE exceptions ADD COLUMN detected_at TEXT");
  db.exec("UPDATE exceptions SET detected_at = created_at WHERE detected_at IS NULL OR detected_at = ''");
  db.exec("UPDATE exceptions SET kind = 'missed_commitment' WHERE kind = 'commitment_missed'");
}

export function peekDb(): DatabaseSync | undefined {
  return dbContext.getStore() ?? globalForDb.evopulseDb;
}

/** Open a business-schema database. Atlas seed is opt-in so real workspaces stay empty. */
export function openBusinessDatabase(path: string, options: { seedAtlas?: boolean } = {}): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  migrate(db);
  wireEngineHooks(db);
  if (options.seedAtlas) {
    const { seedIfEmpty } = require("./seed") as typeof import("./seed");
    seedIfEmpty(db);
  } else {
    const { seedWorkspaceDefaults } = require("./workspace/defaults") as typeof import("./workspace/defaults");
    seedWorkspaceDefaults(db);
  }
  return db;
}

function wireEngineHooks(db: DatabaseSync) {
  const { ensureDetectHooks } = require("./engine/hooks") as typeof import("./engine/hooks");
  ensureDetectHooks(db);
  const { ensureWarningHooks } = require("./warnings/hooks") as typeof import("./warnings/hooks");
  ensureWarningHooks(db);
  const { ensureAutopilotHooks } = require("./autopilot/hooks") as typeof import("./autopilot/hooks");
  ensureAutopilotHooks(db);
}

export function getDb(): DatabaseSync {
  const contextual = dbContext.getStore();
  if (contextual) {
    migrate(contextual);
    wireEngineHooks(contextual);
    return contextual;
  }
  if (globalForDb.evopulseDb) {
    migrate(globalForDb.evopulseDb);
    wireEngineHooks(globalForDb.evopulseDb);
    return globalForDb.evopulseDb;
  }
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  migrate(db);
  // Publish before seed so dispatcher hooks can see the live handle.
  globalForDb.evopulseDb = db;
  wireEngineHooks(db);
  // Lazy import avoids a db ↔ seed cycle.
  const { seedIfEmpty } = require("./seed") as typeof import("./seed");
  seedIfEmpty(db);
  return db;
}

export function resetDbFile() {
  try {
    const { releaseWarningHooks } = require("./warnings/hooks") as typeof import("./warnings/hooks");
    releaseWarningHooks();
  } catch {
    /* warnings module may not be loaded yet */
  }
  try {
    const { releaseAutopilotHooks } = require("./autopilot/hooks") as typeof import("./autopilot/hooks");
    releaseAutopilotHooks();
  } catch {
    /* autopilot module may not be loaded yet */
  }
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
  return toPlain(db.prepare(sql).all(...params) as T[]);
}

export function one<T>(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): T | undefined {
  return toPlain(db.prepare(sql).get(...params) as T | undefined);
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
