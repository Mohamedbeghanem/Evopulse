import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveExpectationStatus } from "../lib/engine/expectations";

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
});
