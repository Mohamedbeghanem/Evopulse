import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { registerEngineHook, type BusinessEvent } from "../events";
import { EarlyWarningEngine } from "./engine";

let live: DatabaseSync | null = null;
let hooked = false;

export function handleWarningEvent(db: DatabaseSync, event: BusinessEvent) {
  if (!isUsable(db)) return;
  // Business time is the demo clock. An event's own timestamp must never advance it.
  const now = getMeta(db, "demo_now") || event.received_at || event.occurred_at;
  EarlyWarningEngine.for(db).evaluateFromEvent(
    { id: event.id, type: event.type, entity_id: event.entity_id },
    now,
  );
}

export function ensureWarningHooks(db: DatabaseSync) {
  live = db;
  if (hooked) return;
  hooked = true;
  registerEngineHook("early-warning", (event) => {
    try {
      const { peekDb } = require("../db") as typeof import("../db");
      const handle = live && isUsable(live) ? live : peekDb();
      if (!handle || !isUsable(handle)) return;
      handleWarningEvent(handle, event);
    } catch (error) {
      if (isClosedDbError(error)) return;
      console.error("[early-warning] handler failed", event.id, event.type, error);
    }
  });
}

export function releaseWarningHooks() {
  live = null;
}

function isUsable(db: DatabaseSync): boolean {
  try {
    db.prepare("SELECT 1").get();
    return true;
  } catch {
    return false;
  }
}

function isClosedDbError(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "ERR_INVALID_STATE",
  );
}
