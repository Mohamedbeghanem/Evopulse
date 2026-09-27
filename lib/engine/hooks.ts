import type { DatabaseSync } from "node:sqlite";
import { registerEngineHook } from "../events";
import { ExpectedEventMatcher } from "./matcher";

const globalForDetect = globalThis as unknown as { evopulseDetectHooks?: boolean };

/**
 * Wire Detect (and Control's unused learning hook) onto the Event Layer dispatcher.
 * Uses peekDb so reset/reseed in tests does not keep a closed handle.
 */
export function ensureDetectHooks(_db?: DatabaseSync) {
  if (globalForDetect.evopulseDetectHooks) return;
  globalForDetect.evopulseDetectHooks = true;

  registerEngineHook("expected-event-matcher", (event) => {
    try {
      const { peekDb } = require("../db") as typeof import("../db");
      const db = peekDb();
      if (!db) return;
      ExpectedEventMatcher.for(db).onEvent(event);
    } catch (error) {
      console.error("[detect-matcher] handler failed", event.id, event.type, error);
    }
  });

  // Control exported this hook unused. Detect wires it onto the same dispatcher clock.
  const { ensureLearningHooks } = require("../learning") as typeof import("../learning");
  ensureLearningHooks();
}
