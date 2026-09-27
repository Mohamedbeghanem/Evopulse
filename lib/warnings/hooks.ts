import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { registerEngineHook, type BusinessEvent } from "../events";
import { EarlyWarningEngine } from "./engine";

export function handleWarningEvent(db: DatabaseSync, event: BusinessEvent) {
  const now = event.received_at || event.occurred_at || getMeta(db, "demo_now");
  EarlyWarningEngine.for(db).evaluateFromEvent(
    { id: event.id, type: event.type, entity_id: event.entity_id },
    now,
  );
}

const hooked = new WeakSet<DatabaseSync>();

export function ensureWarningHooks(db: DatabaseSync) {
  if (hooked.has(db)) return;
  hooked.add(db);
  registerEngineHook("early-warning", (event) => {
    try {
      handleWarningEvent(db, event);
    } catch (error) {
      console.error("[early-warning] handler failed", event.id, event.type, error);
    }
  });
}
