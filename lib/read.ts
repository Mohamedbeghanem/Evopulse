import type { DatabaseSync } from "node:sqlite";
import { all, getMeta, one } from "./db";
import { getPlanBundle } from "./engine/recovery";
import { serializeException } from "./engine/pulse";
import type {
  ActionRow,
  CommitmentRow,
  DependencyRow,
  EntityRow,
  EventRow,
  ExceptionRow,
  ExpectationRow,
  PolicyRow,
} from "./types";

export function exceptionDetail(db: DatabaseSync, exceptionId: string) {
  const row = one<ExceptionRow>(db, "SELECT * FROM exceptions WHERE id = ?", [exceptionId]);
  if (!row) return null;
  const expectation = row.expectation_id
    ? one<ExpectationRow>(db, "SELECT * FROM expectations WHERE id = ?", [row.expectation_id])
    : undefined;
  const commitment = expectation
    ? one<CommitmentRow>(db, "SELECT * FROM commitments WHERE id = ?", [expectation.commitment_id])
    : undefined;
  const deps = all<DependencyRow>(db, "SELECT * FROM dependencies");
  const commitments = all<CommitmentRow>(db, "SELECT * FROM commitments");
  const opportunity = row.opportunity_id
    ? one<EntityRow>(db, "SELECT * FROM entities WHERE id = ?", [row.opportunity_id])
    : undefined;
  const events = all<EventRow>(db, "SELECT * FROM events ORDER BY occurred_at");
  const { plan, actions } = getPlanBundle(db, exceptionId);
  return {
    exception: serializeException(row),
    expectation,
    commitment,
    opportunity,
    dependencies: deps,
    commitments,
    events,
    plan,
    actions,
    now: getMeta(db, "demo_now"),
    phase: getMeta(db, "demo_phase", "seeded"),
  };
}

export function policies(db: DatabaseSync) {
  return all<PolicyRow>(db, "SELECT * FROM policies");
}

export function latestActions(db: DatabaseSync) {
  return all<ActionRow>(db, "SELECT * FROM actions ORDER BY created_at DESC");
}
