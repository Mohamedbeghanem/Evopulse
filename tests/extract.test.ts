import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DECISION_DUE_ISO, MESSAGE_ONE_ISO, PROPOSAL_DUE_ISO } from "../lib/clock";
import { extractHeuristic, SEED_MESSAGE_ONE, SEED_MESSAGE_TWO } from "../lib/engine/extract";

describe("extractHeuristic", () => {
  it("extracts our + their commitments and the dependency from the seed message", () => {
    const result = extractHeuristic(SEED_MESSAGE_ONE, MESSAGE_ONE_ISO);
    assert.equal(result.source, "heuristic");
    assert.equal(result.commitments.length, 2);
    assert.equal(result.commitments[0].actor, "company");
    assert.equal(result.commitments[0].action, "send_revised_proposal");
    assert.equal(result.commitments[0].deadline, PROPOSAL_DUE_ISO);
    assert.equal(result.commitments[1].actor, "customer");
    assert.equal(result.commitments[1].action, "provide_decision");
    assert.equal(result.commitments[1].deadline, DECISION_DUE_ISO);
    assert.equal(result.amount, 320000);
    assert.equal(result.currency, "DZD");
    assert.equal(result.dependencies[0].prerequisiteAction, "send_revised_proposal");
    assert.equal(result.dependencies[0].dependentAction, "provide_decision");
  });

  it("extracts a 10% discount request from the later message", () => {
    const result = extractHeuristic(SEED_MESSAGE_TWO);
    assert.equal(result.requestedDiscountPct, 10);
    assert.equal(result.commitments[0].actor, "customer");
    assert.equal(result.commitments[0].action, "sign_if_discount");
  });
});
