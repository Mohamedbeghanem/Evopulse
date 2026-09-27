import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { executePlan } from "../lib/engine/execute";
import { ingestSeedDiscount } from "../lib/engine/ingest";
import { triggerSupplierDelay } from "../lib/engine/supplier";
import { IDS } from "../lib/ids";
import { wipeAndSeed } from "../lib/seed";
import { answerQuestion } from "../lib/engine/ask";
import { classifyCommand } from "../lib/ui/commands";
import { listSituations, pulseBoard, projectAttention } from "../lib/ui/attention";
import type { ActionRow, ExceptionRow, PlanRow } from "../lib/types";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-attn-")), "attention.db");
resetDbFile();

describe("attention projection", { concurrency: 1 }, () => {
  it("projects 320K as NEEDS_APPROVAL without changing stored attention", () => {
    const db = getDb();
    wipeAndSeed(db);
    const situations = listSituations(db);
    assert.equal(situations.length, 1);
    const miss = situations.find((s) => s.id === IDS.excMissed);
    assert.ok(miss);
    assert.equal(miss?.storedAttention, "NEEDS_YOU");
    assert.equal(miss?.projection, "NEEDS_APPROVAL");
    assert.equal(miss?.money?.amount, 320000);
    assert.match(miss?.money?.caption || "", /associated/);
  });

  it("keeps one situation per exception after supplier delay — 850K associated, 540K cash timing", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const board = pulseBoard(db);
    const ids = board.situations.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
    const delay = board.situations.find((s) => s.id === IDS.excDelay);
    const miss = board.situations.find((s) => s.id === IDS.excMissed);
    assert.ok(delay);
    assert.ok(miss);
    assert.equal(delay?.projection, "NEEDS_YOU");
    assert.equal(delay?.money?.amount, 850000);
    assert.equal(delay?.cashTiming?.amount, 540000);
    assert.equal(miss?.projection, "NEEDS_APPROVAL");
    assert.ok(!board.situations.some((s) => /warning \+ exception/i.test(s.title)));
  });

  it("projects 10% as BLOCKED and recovery as MONITORING after execute", async () => {
    const db = getDb();
    wipeAndSeed(db);
    executePlan(db, IDS.planRecovery, getMeta(db, "demo_now"));
    const after = listSituations(db).find((s) => s.id === IDS.excMissed);
    assert.equal(after?.projection, "MONITORING");
    assert.equal(after?.storedAttention, "MONITORING");
    await ingestSeedDiscount(db);
    const discount = listSituations(db).find((s) => s.id === IDS.excDiscount);
    assert.ok(discount);
    assert.equal(discount?.projection, "BLOCKED");
  });

  it("does not let a model-shaped plan approve itself", () => {
    const exception = {
      attention: "NEEDS_YOU",
    } as ExceptionRow;
    const plan = { status: "approval_required" } as PlanRow;
    const actions = [{ policy_outcome: "APPROVAL_REQUIRED", status: "proposed" }] as ActionRow[];
    assert.equal(projectAttention(exception, plan, actions), "NEEDS_APPROVAL");
    assert.notEqual(projectAttention(exception, plan, actions), "HANDLED");
  });
});

describe("grounded command answers", () => {
  it("answers 850K from graph impact, not invented loss", () => {
    const db = getDb();
    wipeAndSeed(db);
    triggerSupplierDelay(db);
    const result = answerQuestion(db, "Why is 850K at risk?");
    assert.equal(result.grounded, true);
    assert.match(result.answer, /850,000/);
    assert.match(result.answer, /540,000/);
    assert.doesNotMatch(result.answer, /lost 850/);
  });
});

describe("command classification", () => {
  it("routes golden commands without inventing a second interpreter", () => {
    assert.equal(classifyCommand("What changed today?"), "ask");
    assert.equal(classifyCommand("What needs me?"), "ask");
    assert.equal(classifyCommand("Why is 850K at risk?"), "ask");
    assert.equal(classifyCommand("What if Atlas another 3 days late?"), "simulate");
    assert.equal(classifyCommand("Protect everything at risk this week."), "goal");
    assert.equal(classifyCommand("What can you handle safely?"), "protect_safe");
    assert.equal(classifyCommand("Fix everything authorized."), "safe_execute");
    assert.equal(classifyCommand("10% discount scenario."), "discount");
    assert.equal(classifyCommand("write me a poem about dinars"), "unknown");
  });
});
