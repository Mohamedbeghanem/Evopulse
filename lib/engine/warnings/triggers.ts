import type { DatabaseSync } from "node:sqlite";
import { one, run } from "../../db";
import { EVENT_TYPES, registerEngineHook, type BusinessEvent } from "../../events";
import type { EntityRow } from "../../types";
import { attachWarningIntervention, evaluateEarlyWarnings } from "./evaluate";

const TRIGGER_TYPES = new Set<string>([
  EVENT_TYPES.SHIPMENT_DELAYED,
  EVENT_TYPES.EXPECTATION_UPDATED,
  EVENT_TYPES.COMMITMENT_CREATED,
  EVENT_TYPES.CUSTOMER_REPLIED,
  EVENT_TYPES.PAYMENT_EXPECTED,
  EVENT_TYPES.ACTION_EXECUTED,
]);

const hooked = new WeakSet<DatabaseSync>();

export function handleWarningEvent(db: DatabaseSync, event: BusinessEvent) {
  if (!TRIGGER_TYPES.has(event.type)) return;
  if (event.type === EVENT_TYPES.SHIPMENT_DELAYED) applyShipmentDelay(db, event);
  if (event.type === EVENT_TYPES.ACTION_EXECUTED) attachFromAction(db, event);
  if (!event.entity_id) return;
  evaluateEarlyWarnings(db, event.received_at || event.occurred_at, { startId: event.entity_id });
}

export function ensureWarningHooks(db: DatabaseSync) {
  if (hooked.has(db)) return;
  hooked.add(db);
  registerEngineHook("early-warnings", (event) => {
    try {
      handleWarningEvent(db, event);
    } catch (error) {
      console.error("[early-warnings] handler failed", event.id, event.type, error);
    }
  });
}

function applyShipmentDelay(db: DatabaseSync, event: BusinessEvent) {
  if (!event.entity_id) return;
  const projected = event.payload.projectedArrival ?? event.payload.projected_at;
  if (typeof projected !== "string") return;
  const row = one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [event.entity_id]);
  if (!row) return;
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(row.payload) as Record<string, unknown>;
  } catch {
    payload = {};
  }
  payload.projectedArrival = projected;
  if (typeof event.payload.quote === "string") payload.quote = event.payload.quote;
  run(db, "UPDATE entities SET payload = ? WHERE id = ?", [JSON.stringify(payload), row.id]);
}

function attachFromAction(db: DatabaseSync, event: BusinessEvent) {
  const warningId = event.payload.warningId;
  if (typeof warningId !== "string" || !event.entity_id) return;
  attachWarningIntervention(db, warningId, event.entity_id, event.received_at || event.occurred_at);
}
