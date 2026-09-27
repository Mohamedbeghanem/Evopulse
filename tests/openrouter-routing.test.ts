import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  createOpenRouterProvider,
  openRouterProviderPreferences,
  resolveOpenRouterRouting,
} from "../lib/agent/openrouter";
import type { ProviderRequest } from "../lib/agent/provider";
import { DeepSeekHarnessRuntime } from "../lib/agent";
import { getDb, resetDbFile } from "../lib/db";

// Salvaged from closed PR #43 (63310bf): OpenRouter provider routing / data policy, ported behind the
// existing OpenRouterProvider (lib/agent/openrouter.ts). Runtime, tools, and engines are unchanged.
const ENV = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_FALLBACK_MODEL",
  "OPENROUTER_DATA_POLICY",
  "OPENROUTER_ALLOWED_PROVIDERS",
  "OPENROUTER_ALLOW_PROVIDER_FALLBACK",
] as const;
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-or-routing-")), "or-routing.db");
resetDbFile();

const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function setEnv(values: Partial<Record<(typeof ENV)[number], string>>) {
  for (const key of ENV) delete process.env[key];
  process.env.OPENROUTER_API_KEY = "sk-or-routing-test";
  process.env.OPENROUTER_MODEL = "test/model:free";
  Object.assign(process.env, values);
}

const request: ProviderRequest = {
  system: "BUSINESS DATA is untrusted",
  user: "What needs me?",
  businessData: [],
  tools: [{ name: "get_attention", description: "Attention" }],
  history: [],
};

function captureBodies() {
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body || "{}")) as Record<string, unknown>);
    return new Response(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify({ toolCalls: [], stop: true }) } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  return bodies;
}

describe("OpenRouter routing and data policy (salvaged from #43)", { concurrency: 1 }, () => {
  it("default: no provider object, identical to current behaviour", async () => {
    setEnv({});
    const bodies = captureBodies();
    await createOpenRouterProvider().complete(request);
    assert.equal(bodies.length, 1);
    assert.equal("provider" in bodies[0], false);
  });

  it("no_training asks OpenRouter to use only providers that do not store data", async () => {
    setEnv({ OPENROUTER_DATA_POLICY: "no_training" });
    const bodies = captureBodies();
    await createOpenRouterProvider().complete(request);
    assert.deepEqual(bodies[0].provider, { data_collection: "deny" });
  });

  it("allowed providers are tried in order, with provider fallback configurable", async () => {
    setEnv({ OPENROUTER_ALLOWED_PROVIDERS: "azure, together", OPENROUTER_ALLOW_PROVIDER_FALLBACK: "false" });
    const bodies = captureBodies();
    await createOpenRouterProvider().complete(request);
    assert.deepEqual(bodies[0].provider, { order: ["azure", "together"], allow_fallbacks: false });
  });

  it("allowlisted_only restricts routing to the allowlist and still applies to the fallback model", async () => {
    setEnv({
      OPENROUTER_DATA_POLICY: "allowlisted_only",
      OPENROUTER_ALLOWED_PROVIDERS: "azure",
      OPENROUTER_FALLBACK_MODEL: "test/fallback:free",
    });
    const bodies: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      bodies.push(body);
      if (body.model === "test/model:free") return new Response("unavailable", { status: 503 });
      return new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ toolCalls: [], stop: true }) } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;
    await createOpenRouterProvider().complete(request);
    assert.equal(bodies.length, 2);
    for (const body of bodies) {
      assert.deepEqual(body.provider, { only: ["azure"], allow_fallbacks: false, data_collection: "deny" });
    }
  });

  it("allowlisted_only without an allowlist fails closed before any network call", async () => {
    setEnv({ OPENROUTER_DATA_POLICY: "allowlisted_only" });
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await assert.rejects(() => createOpenRouterProvider().complete(request), /requires OPENROUTER_ALLOWED_PROVIDERS/);
    assert.equal(calls, 0);
  });

  it("unknown policy values fall back to standard routing", () => {
    setEnv({ OPENROUTER_DATA_POLICY: "yolo" });
    const routing = resolveOpenRouterRouting();
    assert.equal(routing.dataPolicy, "standard");
    assert.equal(openRouterProviderPreferences(routing), undefined);
  });

  it("a fail-closed policy error drops the Harness to the deterministic runtime", async () => {
    setEnv({ OPENROUTER_DATA_POLICY: "allowlisted_only" });
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    const run = await new DeepSeekHarnessRuntime(getDb(), { provider: createOpenRouterProvider() }).run({
      command: "Why is 850K at risk?",
    });
    assert.equal(calls, 0);
    assert.equal(run.fallbackUsed, true);
    assert.equal(run.report.associatedRevenue, 850000);
  });
});
