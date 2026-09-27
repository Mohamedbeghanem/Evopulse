import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePolicy, planOutcome } from "../lib/engine/policy";

const policies = {
  discount_max: "5",
  financial_commitment_requires_approval: "true",
  external_message_requires_approval: "true",
};

describe("policy engine", () => {
  it("blocks a 10% discount when discount_max is 5%", () => {
    const result = evaluatePolicy({ type: "apply_discount", payload: { percent: 10 } }, policies);
    assert.equal(result.outcome, "BLOCKED");
    assert.match(result.reason, /discount_max=5/);
  });

  it("requires approval for a 5% discount (financial commitment)", () => {
    const result = evaluatePolicy({ type: "apply_discount", payload: { percent: 5 } }, policies);
    assert.equal(result.outcome, "APPROVAL_REQUIRED");
  });

  it("requires approval for external messages", () => {
    const result = evaluatePolicy({ type: "draft_message", payload: {} }, policies);
    assert.equal(result.outcome, "APPROVAL_REQUIRED");
  });

  it("allows internal prepare as AUTO", () => {
    const result = evaluatePolicy({ type: "prepare_proposal", payload: {} }, policies);
    assert.equal(result.outcome, "AUTO");
  });

  it("rolls a mixed plan up to BLOCKED if any action is blocked", () => {
    assert.equal(planOutcome(["AUTO", "APPROVAL_REQUIRED", "BLOCKED"]), "BLOCKED");
    assert.equal(planOutcome(["AUTO", "APPROVAL_REQUIRED"]), "APPROVAL_REQUIRED");
  });
});
