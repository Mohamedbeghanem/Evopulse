import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { calculateGraphImpact } from "../lib/engine/impact";
import { pulseSummary } from "../lib/engine/pulse";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { EVENT_TYPES, eventsFor } from "../lib/events";
import { IDS } from "../lib/ids";

// Restored from closed PR #9 (b9bbe21). Both fixes are already on main (lib/engine/supplier.ts uses the
// order id as source_id; lib/engine/impact.ts counts only downstream commitments), but their
// regression tests did not survive the #10 squash. Tests only — no production change.
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-casfix-cov-")), "cascade-fix-cov.db");
resetDbFile();

describe("supplier cascade follow-ups — restored coverage from #9", { concurrency: 1 }, () => {
  it("records an order.affected event for every affected order, idempotently", () => {
    const db = getDb();
    triggerSupplierDelay(db);
    const affected = () =>
      eventsFor(db)
        .list()
        .filter((event) => event.type === EVENT_TYPES.ORDER_AFFECTED)
        .map((event) => event.entity_id)
        .sort();
    assert.deepEqual(affected(), [IDS.orderA, IDS.orderB, IDS.orderC].sort());
    triggerSupplierDelay(db);
    assert.equal(affected().length, 3, "a second trigger adds nothing");
  });

  it("scopes commitments_at_risk to the queried node's downstream", () => {
    const db = getDb();
    pulseSummary(db, getMeta(db, "demo_now"));
    pulseSummary(db, getMeta(db, "demo_now"));
    assert.equal(calculateGraphImpact(db, IDS.orderC).commitments_at_risk, 0);
    assert.equal(calculateGraphImpact(db, IDS.orderA).commitments_at_risk, 1);
    assert.equal(calculateGraphImpact(db, IDS.shipment).commitments_at_risk, 2);
  });
});
