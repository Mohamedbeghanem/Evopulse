import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForControl = globalThis as unknown as { evopulseControlDb?: DatabaseSync };

export function controlDbPath(): string {
  return process.env.CONTROL_DB_PATH || join(process.cwd(), "data", "control.db");
}

export function getControlDb(): DatabaseSync {
  if (globalForControl.evopulseControlDb) return globalForControl.evopulseControlDb;
  const path = controlDbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  migrateControl(db);
  globalForControl.evopulseControlDb = db;
  return db;
}

export function resetControlDbHandle() {
  if (globalForControl.evopulseControlDb) {
    try {
      globalForControl.evopulseControlDb.close();
    } catch {
      /* ignore */
    }
    globalForControl.evopulseControlDb = undefined;
  }
}

function migrateControl(db: DatabaseSync) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'user',
      industry TEXT NOT NULL DEFAULT '',
      team_size TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      currency TEXT NOT NULL DEFAULT 'USD',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      logo TEXT NOT NULL DEFAULT '',
      agent_name TEXT NOT NULL DEFAULT 'Pulse',
      interaction_density TEXT NOT NULL DEFAULT 'balanced',
      notification_preference TEXT NOT NULL DEFAULT 'needs_you',
      owner_id TEXT NOT NULL,
      onboarding_step TEXT NOT NULL DEFAULT 'welcome',
      onboarding_completed_at TEXT,
      protections TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE (workspace_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      workspace_id TEXT,
      mode TEXT NOT NULL DEFAULT 'user',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS connector_links (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      connector_id TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (workspace_id, connector_id)
    );

    CREATE TABLE IF NOT EXISTS discovery_facts (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      label TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      confidence TEXT NOT NULL,
      source TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_id TEXT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      href TEXT NOT NULL DEFAULT '',
      situation_id TEXT,
      dedupe_key TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (workspace_id, dedupe_key)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_ws ON notifications(workspace_id, created_at);
  `);
}

export function controlDbExists(): boolean {
  return existsSync(controlDbPath());
}
