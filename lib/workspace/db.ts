import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { openBusinessDatabase } from "../db";

const globalForWorkspaces = globalThis as unknown as {
  evopulseWorkspaceDbs?: Map<string, DatabaseSync>;
};

function workspaceDir(): string {
  return process.env.WORKSPACE_DB_DIR || join(dirname(controlDirHint()), "workspaces");
}

function controlDirHint(): string {
  return process.env.CONTROL_DB_PATH || join(process.cwd(), "data", "control.db");
}

export function workspaceDbPath(workspaceId: string): string {
  return join(workspaceDir(), `${workspaceId}.db`);
}

export function openWorkspaceDb(workspaceId: string): DatabaseSync {
  if (!workspaceId || workspaceId === "ws_demo") {
    throw new Error("Demo workspace uses the canonical Atlas database, not a user file.");
  }
  const cache = (globalForWorkspaces.evopulseWorkspaceDbs ??= new Map());
  const existing = cache.get(workspaceId);
  if (existing) return existing;
  const db = openBusinessDatabase(workspaceDbPath(workspaceId), { seedAtlas: false });
  cache.set(workspaceId, db);
  return db;
}

export function forgetWorkspaceDb(workspaceId: string) {
  const cache = globalForWorkspaces.evopulseWorkspaceDbs;
  const db = cache?.get(workspaceId);
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    cache?.delete(workspaceId);
  }
}
