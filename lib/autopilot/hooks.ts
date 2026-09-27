import type { DatabaseSync } from "node:sqlite";
import { getMeta } from "../db";
import { registerEngineHook, type BusinessEvent } from "../events";
import { ExceptionAutopilotService } from "./service";

const REEVAL_TYPES = new Set([
  "shipment.delayed",
  "shipment.revised",
  "exception.created",
  "exception.resolved",
  "action.executed",
  "action.failed",
  "verification.created",
  "verification.resolved",
  "verification.failed",
  "customer.replied",
  "quote.sent",
  "commitment.missed",
  "policy.blocked",
]);

let live: DatabaseSync | null = null;
let hooked = false;

export function handleAutopilotEvent(db: DatabaseSync, event: BusinessEvent) {
  if (!REEVAL_TYPES.has(event.type)) return;
  if (!isUsable(db)) return;
  // Business time is the demo clock. An event's own timestamp must never advance it.
  const now = getMeta(db, "demo_now") || event.received_at || event.occurred_at;
  ExceptionAutopilotService.for(db).evaluateSituation(now);
}

export function ensureAutopilotHooks(db: DatabaseSync) {
  live = db;
  if (hooked) return;
  hooked = true;
  registerEngineHook("exception-autopilot", (event) => {
    try {
      const { peekDb } = require("../db") as typeof import("../db");
      const handle = live && isUsable(live) ? live : peekDb();
      if (!handle || !isUsable(handle)) return;
      handleAutopilotEvent(handle, event);
    } catch (error) {
      if (isClosedDbError(error)) return;
      console.error("[exception-autopilot] handler failed", event.id, event.type, error);
    }
  });
}

export function releaseAutopilotHooks() {
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
