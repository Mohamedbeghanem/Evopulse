import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PULSE_AVATAR_STATES, avatarStateFromRuntime } from "../lib/pulse-avatar/states";

describe("Pulse avatar", () => {
  it("maps every runtime phase without exposing harness language", () => {
    assert.equal(avatarStateFromRuntime("INTERPRETING"), "THINKING");
    assert.equal(avatarStateFromRuntime("RUNNING_TOOL"), "INVESTIGATING");
    assert.equal(avatarStateFromRuntime("WAITING_FOR_APPROVAL"), "WAITING_FOR_YOU");
    assert.equal(avatarStateFromRuntime("EXECUTING"), "EXECUTING");
    assert.equal(avatarStateFromRuntime("VERIFYING"), "VERIFYING");
    assert.equal(avatarStateFromRuntime("COMPLETE"), "SUCCESS");
    assert.equal(avatarStateFromRuntime("FAILED"), "ERROR");
    assert.equal(avatarStateFromRuntime("IDLE"), "IDLE");
    assert.equal(PULSE_AVATAR_STATES.length, 12);
  });
});
