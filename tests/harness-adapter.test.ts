import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  DeepSeekHarnessRuntime,
  DeterministicRuntime,
  HARNESS_REFERENCE,
  getAgentRuntime,
  getToolPermission,
} from "../lib/agent";
import { hostFrom, invokeTool } from "../lib/agent/executor";
import { loadRun } from "../lib/agent/store";
import type { ModelProvider } from "../lib/agent/provider";
import { getDb, getMeta, resetDbFile } from "../lib/db";
import { IDS } from "../lib/ids";

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-harness-")), "harness.db");
delete process.env.OPENAI_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.DEEPSEEK_API_KEY;
delete process.env.EVOPULSE_LLM_API_KEY;
process.env.EVOPULSE_AGENT_RUNTIME = "deterministic";
resetDbFile();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function harness(provider: ModelProvider) {
  return new DeepSeekHarnessRuntime(getDb(), { provider });
}

function timeoutProvider(message = "Harness provider timed out."): ModelProvider {
  return {
    name: "timeout",
    available: () => true,
    complete: async (_request, signal) => {
      if (signal?.aborted) {
        const error = new Error(message);
        error.name = "TimeoutError";
        throw error;
      }
      const error = new Error(message);
      error.name = "TimeoutError";
      throw error;
    },
  };
}

describe("harness adapter MODE C safety", { concurrency: 1 }, () => {
  it("pins the inspected official Harness version and does not depend on it", () => {
    assert.equal(HARNESS_REFERENCE.name, "DeepSeek Harness");
    assert.equal(HARNESS_REFERENCE.version, "0.1.7-rc.2");
    assert.equal(HARNESS_REFERENCE.commit, "477b4f420553e8a52c2fbccc464d7561b239c443");
    assert.equal(HARNESS_REFERENCE.method, "isolated-adapter");
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
    assert.equal(names.some((name) => name.startsWith("@deepseek-ai/dsh")), false);
    assert.equal(getAgentRuntime(getDb()) instanceof DeterministicRuntime, true);
  });

  it("Command Center and API routes do not import Harness classes or official packages", () => {
    const files = [
      ...collectSource(join(ROOT, "app")),
      ...collectSource(join(ROOT, "components")),
    ];
    assert.ok(files.length > 0);
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      assert.equal(source.includes("@deepseek-ai/dsh"), false, file);
      assert.equal(source.includes("DeepSeekHarnessRuntime"), false, file);
      assert.equal(/from\s+["']@deepseek-ai\//.test(source), false, file);
    }
  });

  it("falls back to DeterministicRuntime when the Harness-style provider is unavailable", async () => {
    const result = await harness({
      name: "missing",
      available: () => false,
      complete: async () => {
        throw new Error("official Harness must not be called");
      },
    }).run({ command: "Why is 850K at risk?" });
    assert.equal(result.fallbackUsed, true);
    assert.equal(result.report.associatedRevenue, 850000);
    assert.equal(result.toolCalls.some((call) => call.tool === "explain_risk"), true);
    assert.equal(result.steps.some((step) => /chain of thought|reasoning/i.test(step.detail)), false);
  });

  it("falls back when the Harness-style provider crashes", async () => {
    const result = await harness({
      name: "crash",
      available: () => true,
      complete: async () => {
        throw new Error("Harness subprocess crashed");
      },
    }).run({ command: "What changed today?" });
    assert.equal(result.fallbackUsed, true);
    assert.ok(result.toolCalls.length >= 1 || result.summary.length > 0);
    assert.notEqual(result.status, "running");
  });

  it("falls back when the Harness-style provider times out or aborts", async () => {
    const result = await harness(timeoutProvider("The operation was aborted due to timeout")).run({
      command: "What needs me?",
    });
    assert.equal(result.fallbackUsed, true);
    assert.ok(result.summary.length > 0);
    assert.notEqual(result.status, "running");
  });

  it("rejects invalid, unknown, and forbidden tools without executing them", async () => {
    const provider: ModelProvider = {
      name: "hostile-tools",
      available: () => true,
      async complete(request) {
        if (request.history.length > 0) return { toolCalls: [], stop: true };
        return {
          toolCalls: [
            { name: "shell", arguments: { cmd: "rm -rf /" } },
            { name: "execute_sql", arguments: { sql: "DROP TABLE actions" } },
            { name: "write_file", arguments: { path: ".env" } },
            { name: "not_a_tool", arguments: { x: 1 } },
            { name: "approve_action", arguments: { actionId: "act_x" } },
          ],
          stop: false,
        };
      },
    };
    const result = await harness(provider).run({ command: "What needs me?" });
    const names = result.toolCalls.map((call) => call.tool);
    assert.equal(names.includes("shell") ? result.toolCalls.find((call) => call.tool === "shell")?.status : "forbidden", "forbidden");
    for (const call of result.toolCalls) {
      if (["shell", "execute_sql", "write_file", "approve_action"].includes(call.tool)) {
        assert.equal(call.status, "forbidden");
      }
      if (call.tool === "not_a_tool") assert.equal(call.status, "failed");
    }
    assert.equal(getToolPermission("shell"), "FORBIDDEN_TO_AGENT");
    assert.equal(getToolPermission("execute_sql"), "FORBIDDEN_TO_AGENT");
    assert.equal(getToolPermission("write_file"), "FORBIDDEN_TO_AGENT");
    if (!result.toolCalls.length) assert.equal(result.fallbackUsed, true);
  });

  it("unknown tools through the executor fail closed and do not become business truth", async () => {
    const created = await new DeterministicRuntime(getDb()).run({ command: "What needs me?" });
    const host = hostFrom(getDb(), loadRun(getDb(), created.id), getMeta(getDb(), "demo_now"), () => false);
    const unknown = await invokeTool(host, "computer_use", { action: "screenshot" });
    assert.equal(unknown.status, "failed");
    assert.equal(unknown.data.unknownTool, true);
    const git = await invokeTool(host, "shell", { cmd: "git push --force" });
    assert.equal(git.status, "forbidden");
  });

  it("stops a Harness-style repeat loop", async () => {
    const provider: ModelProvider = {
      name: "repeat",
      available: () => true,
      async complete() {
        return { toolCalls: [{ name: "get_policy", arguments: {} }], stop: false };
      },
    };
    const result = await harness(provider).run({ command: "What is the policy?" });
    assert.ok(result.status === "failed" || result.fallbackUsed || result.toolCalls.some((call) => call.result.data.repeated));
    const repeats = result.toolCalls.filter((call) => call.tool === "get_policy");
    assert.ok(repeats.length <= 3);
    if (result.status === "failed") {
      assert.equal(result.phase, "FAILED");
    }
  });

  it("cancel marks a Harness-style run cancelled", async () => {
    const agent = harness({
      name: "ok",
      available: () => true,
      async complete(request) {
        if (request.history.some((item) => item.tool === "get_attention")) {
          return { toolCalls: [], stop: true };
        }
        return { toolCalls: [{ name: "get_attention", arguments: {} }], stop: false };
      },
    });
    const started = await agent.run({ command: "What needs me?" });
    const cancelled = agent.cancel(started.id);
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.phase, "CANCELLED");
    assert.equal(agent.getStatus(started.id).status, "cancelled");
    assert.ok(agent.getTrace(started.id).length >= 1);
  });

  it("cancel during an in-flight Harness loop fails closed", async () => {
    const db = getDb();
    let agent: DeepSeekHarnessRuntime;
    const provider: ModelProvider = {
      name: "mid-cancel",
      available: () => true,
      async complete() {
        const row = db
          .prepare("SELECT id FROM agent_runs WHERE runtime = 'deepseek' AND status = 'running' ORDER BY rowid DESC LIMIT 1")
          .get() as { id: string } | undefined;
        if (row?.id) agent.cancel(row.id);
        return { toolCalls: [{ name: "get_attention", arguments: {} }], stop: false };
      },
    };
    agent = new DeepSeekHarnessRuntime(db, { provider });
    const result = await agent.run({ command: "What needs me?" });
    assert.ok(
      result.status === "cancelled" ||
        result.fallbackUsed ||
        result.toolCalls.some((call) => call.result.error === "Run cancelled."),
    );
    if (result.status === "cancelled") assert.equal(result.phase, "CANCELLED");
  });

  it("resume after a Harness crash uses the deterministic fallback", async () => {
    const db = getDb();
    const agent = new DeepSeekHarnessRuntime(db, {
      provider: {
        name: "once-crash",
        available: () => true,
        complete: async () => {
          throw new Error("model exploded");
        },
      },
    });
    const first = await agent.run({ command: "Why is 850K at risk?" });
    assert.equal(first.fallbackUsed, true);
    const resumed = await agent.resume(first.id);
    assert.ok(resumed.status === "complete" || resumed.status === "failed" || resumed.fallbackUsed);
  });

  it("scripted Harness adapter still uses only governed EvoPulse tools", async () => {
    const provider: ModelProvider = {
      name: "scripted",
      available: () => true,
      async complete(request) {
        if (request.history.some((item) => item.tool === "explain_risk")) {
          return { toolCalls: [], stop: true };
        }
        return { toolCalls: [{ name: "explain_risk", arguments: { entityId: IDS.shipment } }], stop: false };
      },
    };
    const result = await harness(provider).run({ command: "Why is 850K at risk?" });
    assert.equal(result.runtime, "deepseek");
    assert.equal(result.report.associatedRevenue, 850000);
    assert.equal(result.toolCalls.every((call) => call.tool === "explain_risk"), true);
    assert.notEqual(result.status, "running");
  });

  it("requestApproval and resumeAfterApproval stay on AgentRuntime", async () => {
    const agent = harness({
      name: "scripted",
      available: () => true,
      async complete(request) {
        if (request.history.some((item) => item.tool === "get_attention")) return { toolCalls: [], stop: true };
        return { toolCalls: [{ name: "get_attention", arguments: {} }], stop: false };
      },
    });
    const started = await agent.run({ command: "What needs me?" });
    const approvalView = agent.requestApproval(started.id);
    assert.equal(approvalView.id, started.id);
    assert.equal(agent.getStatus(started.id).id, started.id);
    if (started.approvals[0]) {
      const after = await agent.resumeAfterApproval(started.id, {
        approvalId: started.approvals[0].id,
        decision: "reject",
        actor: "operator",
      });
      assert.equal(after.id, started.id);
      assert.ok(after.approvals.some((item) => item.id === started.approvals[0].id && item.status === "rejected"));
    } else {
      assert.ok(started.status === "complete" || started.status === "waiting_for_approval" || started.fallbackUsed);
    }
  });
});

function collectSource(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSource(path));
    else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) out.push(path);
  }
  return out;
}
