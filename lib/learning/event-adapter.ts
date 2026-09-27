import type { DatabaseSync } from "node:sqlite";
import { registerEngineHook, type BusinessEvent } from "../events";
import { OutcomeLedger } from "./outcomes";
import { StrategyMemory } from "./strategy-memory";
import { SEED_FOLLOWUP_SIGNATURE } from "./context";
import {
  applyVerificationToException,
  VerificationService,
} from "./verification";
import { EXPECTED_EVENT_ALIASES } from "./types";

/**
 * Clean Event Layer adapter. Learning consumes events; it does not own graph / twin / impact.
 * Prefer this hook over duplicating Event Layer internals.
 */
export function handleLearningEvent(db: DatabaseSync, event: BusinessEvent) {
  const aliases = new Set(Object.values(EXPECTED_EVENT_ALIASES).flat());
  if (!aliases.has(event.type)) return;

  const verifications = VerificationService.for(db);
  const pending = verifications.getPendingVerifications();
  for (const verification of pending) {
    const accepted = EXPECTED_EVENT_ALIASES[verification.expected_event_type] || [
      verification.expected_event_type,
    ];
    if (!accepted.includes(event.type)) continue;
    const resolved = verifications.evaluateVerification(verification.id, {
      type: event.type,
      occurred_at: event.occurred_at,
      id: event.id,
      payload: event.payload,
    });
    if (resolved.status === "PENDING") continue;
    OutcomeLedger.for(db).recordFromVerification(resolved, event.received_at || event.occurred_at);
    applyVerificationToException(db, resolved);
    StrategyMemory.for(db).refreshPatterns(SEED_FOLLOWUP_SIGNATURE, event.received_at || event.occurred_at);
  }
}

export function expireAndRecord(db: DatabaseSync, now: string) {
  const failed = VerificationService.for(db).failExpiredVerifications(now);
  const ledger = OutcomeLedger.for(db);
  for (const verification of failed) {
    ledger.recordFromVerification(verification, now);
    applyVerificationToException(db, verification);
  }
  if (failed.length) StrategyMemory.for(db).refreshPatterns(SEED_FOLLOWUP_SIGNATURE, now);
  return failed;
}

const globalForLearning = globalThis as unknown as { evopulseLearningHook?: boolean };

/**
 * Subscribe once. Detect also wires this via `ensureDetectHooks`.
 * Uses peekDb so a closed test handle is not captured.
 */
export function ensureLearningHooks(_db?: DatabaseSync) {
  if (globalForLearning.evopulseLearningHook) return;
  globalForLearning.evopulseLearningHook = true;
  registerEngineHook("learning-verification", (event) => {
    try {
      const { peekDb } = require("../db") as typeof import("../db");
      const db = peekDb();
      if (!db) return;
      handleLearningEvent(db, event);
    } catch (error) {
      console.error("[learning-adapter] handler failed", event.id, event.type, error);
    }
  });
}
