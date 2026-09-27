import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveExpectationStatus,
  inferredExpectedEvent,
} from "../lib/engine/expectations";
import { canonicalExceptionType, isMissedCommitment } from "../lib/engine/exception-types";

describe("expectation state engine", () => {
  it("marks past unfulfilled deadlines as MISSED", () => {
    assert.equal(
      deriveExpectationStatus({
        dueAt: "2026-09-24T18:00:00+01:00",
        now: "2026-09-27T08:18:00+01:00",
        fulfilled: false,
        blocked: false,
        cancelled: false,
      }),
      "MISSED",
    );
  });

  it("prefers BLOCKED over MISSED when a prerequisite failed", () => {
    assert.equal(
      deriveExpectationStatus({
        dueAt: "2026-09-25T17:00:00+01:00",
        now: "2026-09-27T08:18:00+01:00",
        fulfilled: false,
        blocked: true,
        cancelled: false,
      }),
      "BLOCKED",
    );
  });

  it("is FULFILLED when the commitment closed", () => {
    assert.equal(
      deriveExpectationStatus({
        dueAt: "2026-09-24T18:00:00+01:00",
        now: "2026-09-27T08:18:00+01:00",
        fulfilled: true,
        blocked: true,
        cancelled: false,
      }),
      "FULFILLED",
    );
  });

  it("is UPCOMING inside 72h and ON_TRACK beyond that — clock only", () => {
    assert.equal(
      deriveExpectationStatus({
        dueAt: "2026-09-29T08:18:00+01:00",
        now: "2026-09-27T08:18:00+01:00",
        fulfilled: false,
        blocked: false,
        cancelled: false,
      }),
      "UPCOMING",
    );
    assert.equal(
      deriveExpectationStatus({
        dueAt: "2026-10-10T08:18:00+01:00",
        now: "2026-09-27T08:18:00+01:00",
        fulfilled: false,
        blocked: false,
        cancelled: false,
      }),
      "ON_TRACK",
    );
  });

  it("maps commitment actions to expected events without an LLM", () => {
    assert.equal(inferredExpectedEvent("send_revised_proposal"), "quote.sent");
    assert.equal(inferredExpectedEvent("provide_decision"), "customer.decision");
    assert.equal(inferredExpectedEvent("receive_shipment"), "shipment.arrived");
  });

  it("aliases seed commitment_missed to PLAN missed_commitment", () => {
    assert.equal(canonicalExceptionType("commitment_missed"), "missed_commitment");
    assert.ok(isMissedCommitment("commitment_missed"));
    assert.ok(isMissedCommitment("missed_commitment"));
  });
});
