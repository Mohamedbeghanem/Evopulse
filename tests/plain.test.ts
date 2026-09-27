import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPlain } from "../lib/plain";

describe("toPlain", () => {
  it("turns null-prototype rows into ordinary objects", () => {
    const row = Object.assign(Object.create(null), { id: "ent_1", type: "company" });
    const plain = toPlain(row);
    assert.equal(Object.getPrototypeOf(plain), Object.prototype);
    assert.equal(plain.id, "ent_1");
    assert.doesNotThrow(() => JSON.stringify(plain));
  });

  it("passes through null and undefined", () => {
    assert.equal(toPlain(null), null);
    assert.equal(toPlain(undefined), undefined);
  });
});
