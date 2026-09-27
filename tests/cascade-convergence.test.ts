import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, resetDbFile, run } from "../lib/db";
import { refreshExpectations, upsertExpectation } from "../lib/engine/expectations";
import type { ExpectationRow } from "../lib/types";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-converge-")), "converge.db");
resetDbFile();

const CREATED = "2026-09-20T09:00:00+01:00";
/** Link one is already past this clock; links two and three are still in the future. */
const NOW = "2026-09-27T08:18:00+01:00";

function statusOf(id: string): string {
  return (getDb().prepare("SELECT * FROM expectations WHERE id = ?").get(id) as ExpectationRow).status;
}

/**
 * A -> B -> C, where A is the prerequisite of B and B the prerequisite of C.
 * Only A's deadline has passed, so B and C can only be blocked by the cascade, never by the clock.
 */
function seedChain() {
  const db = getDb();
  const links = [
    { id: "exp_chain_a", due: "2026-09-24T18:00:00+01:00", label: "link A (deadline already passed)" },
    { id: "exp_chain_b", due: "2026-10-05T18:00:00+01:00", label: "link B (future)" },
    { id: "exp_chain_c", due: "2026-10-09T18:00:00+01:00", label: "link C (future)" },
  ];
  for (const link of links) {
    upsertExpectation(db, {
      id: link.id,
      commitment_id: `cmt_${link.id}`,
      description: link.label,
      due_at: link.due,
      status: "ON_TRACK",
      created_at: CREATED,
    });
  }
  for (const [from, to] of [
    ["exp_chain_b", "exp_chain_a"],
    ["exp_chain_c", "exp_chain_b"],
  ]) {
    run(
      db,
      `INSERT INTO dependencies (id, from_id, from_type, to_id, to_type, description)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [`dep_${from}`, from, "expectation", to, "expectation", `${from} needs ${to}`],
    );
  }
}

describe("expectation cascade convergence", { concurrency: 1 }, () => {
  it("settles a three-link cascade in a single refresh", () => {
    const db = getDb();
    seedChain();

    // One call. Previously the prerequisite statuses were snapshotted before the update loop, so
    // each link only learned about the one above it on a later call: this chain took three.
    refreshExpectations(db, NOW);

    assert.equal(statusOf("exp_chain_a"), "MISSED", "A's own deadline passed");
    assert.equal(statusOf("exp_chain_b"), "BLOCKED", "B is blocked by the missed A in the same pass");
    assert.equal(statusOf("exp_chain_c"), "BLOCKED", "C is blocked by the newly blocked B in the same pass");
  });

  it("is a fixed point: refreshing again changes nothing", () => {
    const db = getDb();
    seedChain();
    refreshExpectations(db, NOW);

    const snapshot = () =>
      JSON.stringify(db.prepare("SELECT * FROM expectations ORDER BY id").all());
    const settled = snapshot();

    refreshExpectations(db, NOW);
    assert.equal(snapshot(), settled, "a second refresh must not move any row");
  });
});
