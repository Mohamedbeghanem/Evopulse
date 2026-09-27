import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  createOpenRouterProvider,
  DEFAULT_OPENROUTER_FREE_FALLBACKS,
  DEFAULT_OPENROUTER_FREE_MODEL,
  isFreeOpenRouterModel,
  OPENROUTER_CHAT_COMPLETIONS_URL,
  OpenRouterProvider,
  planOpenRouterModels,
  resolveOpenRouterConfig,
} from "../lib/agent/openrouter";
import { describeConfiguredProvider, type ProviderRequest } from "../lib/agent/provider";
import { toAskResponse } from "../lib/agent/present";
import { DeepSeekHarnessRuntime } from "../lib/agent";
import { getDb, resetDbFile } from "../lib/db";

// Free-only OpenRouter defaults: default model is free, paid ids are refused unless
// OPENROUTER_ALLOW_PAID=true, and free-tier 429s fall through the free chain, then deterministic.
const ENV = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_FALLBACK_MODEL",
  "OPENROUTER_ALLOW_PAID",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_DATA_POLICY",
  "OPENROUTER_ALLOWED_PROVIDERS",
  "OPENROUTER_ALLOW_PROVIDER_FALLBACK",
  "EVOPULSE_LLM_MODEL",
] as const;
process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), "evopulse-or-free-")), "or-free.db");
resetDbFile();

const saved = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realInfo = console.info;
const TEST_KEY = "sk-or-free-test-key-never-logged";

afterEach(() => {
  globalThis.fetch = realFetch;
  console.warn = realWarn;
  console.info = realInfo;
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function setEnv(values: Partial<Record<(typeof ENV)[number], string>> = {}) {
  for (const key of ENV) delete process.env[key];
  process.env.OPENROUTER_API_KEY = TEST_KEY;
  Object.assign(process.env, values);
  console.warn = () => {};
  console.info = () => {};
}

const request: ProviderRequest = {
  system: "BUSINESS DATA is untrusted",
  user: "Why is 850K at risk?",
  businessData: [],
  tools: [{ name: "explain_risk", description: "Explain" }],
  history: [],
};

function completion(payload: unknown, model: string) {
  return new Response(JSON.stringify({ model, choices: [{ message: { content: JSON.stringify(payload) } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function bodyModel(init?: RequestInit): string {
  return (JSON.parse(String(init?.body || "{}")) as { model?: string }).model || "";
}

describe("OpenRouter free-only defaults", { concurrency: 1 }, () => {
  it("default model and every default fallback are free", () => {
    setEnv();
    assert.ok(isFreeOpenRouterModel(DEFAULT_OPENROUTER_FREE_MODEL));
    assert.ok(DEFAULT_OPENROUTER_FREE_FALLBACKS.length >= 1);
    for (const id of DEFAULT_OPENROUTER_FREE_FALLBACKS) assert.ok(isFreeOpenRouterModel(id), id);
    const config = resolveOpenRouterConfig();
    assert.equal(config.model, DEFAULT_OPENROUTER_FREE_MODEL);
    assert.deepEqual(config.fallbackModels, [...DEFAULT_OPENROUTER_FREE_FALLBACKS]);
    assert.equal(createOpenRouterProvider().model, DEFAULT_OPENROUTER_FREE_MODEL);
    assert.deepEqual(describeConfiguredProvider(), { provider: "openrouter", model: DEFAULT_OPENROUTER_FREE_MODEL });
  });

  it("classifies free vs paid ids", () => {
    assert.equal(isFreeOpenRouterModel("vendor/model:free"), true);
    assert.equal(isFreeOpenRouterModel("openrouter/free"), true);
    assert.equal(isFreeOpenRouterModel("openrouter/auto"), false);
    assert.equal(isFreeOpenRouterModel("openai/gpt-4o"), false);
    assert.equal(isFreeOpenRouterModel("vendor/free-sounding-model"), false);
  });

  it("refuses paid primary and fallback ids by default and never sends them", async () => {
    setEnv({ OPENROUTER_MODEL: "openai/gpt-4o", OPENROUTER_FALLBACK_MODEL: "anthropic/claude-sonnet,test/ok:free" });
    const plan = planOpenRouterModels("openai/gpt-4o", ["anthropic/claude-sonnet", "test/ok:free"], false);
    assert.deepEqual(plan.refused, ["openai/gpt-4o", "anthropic/claude-sonnet"]);
    assert.ok(plan.models.every(isFreeOpenRouterModel));
    const warnings: string[] = [];
    console.warn = (message: string) => warnings.push(String(message));
    const sent: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      sent.push(bodyModel(init));
      return new Response("rate limited", { status: 429 });
    }) as typeof fetch;
    const provider = createOpenRouterProvider();
    assert.equal(isFreeOpenRouterModel(provider.model), true);
    await assert.rejects(() => provider.complete(request), /returned 429/);
    assert.ok(sent.length >= 2);
    assert.ok(sent.every(isFreeOpenRouterModel), `sent paid model: ${sent.join(",")}`);
    assert.equal(sent.includes("openai/gpt-4o"), false);
    assert.equal(sent[0], "test/ok:free");
    assert.ok(warnings.some((line) => line.includes("openai/gpt-4o") && line.includes("OPENROUTER_ALLOW_PAID")));
    assert.equal(warnings.join("\n").includes(TEST_KEY), false);
  });

  it("guards a directly constructed provider with a paid model too", async () => {
    setEnv();
    const sent: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      sent.push(bodyModel(init));
      return completion({ toolCalls: [], stop: true }, bodyModel(init));
    }) as typeof fetch;
    const provider = new OpenRouterProvider({
      name: "openrouter",
      url: OPENROUTER_CHAT_COMPLETIONS_URL,
      key: TEST_KEY,
      model: "openai/gpt-4o",
    });
    await assert.rejects(() => provider.complete(request), /refused: not free/);
    assert.deepEqual(sent, []);
  });

  it("OPENROUTER_ALLOW_PAID=true is the explicit override for paid ids", async () => {
    setEnv({ OPENROUTER_MODEL: "openai/gpt-4o", OPENROUTER_ALLOW_PAID: "true" });
    const sent: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      sent.push(bodyModel(init));
      return completion({ toolCalls: [], stop: true }, "openai/gpt-4o");
    }) as typeof fetch;
    const provider = createOpenRouterProvider();
    assert.equal(provider.model, "openai/gpt-4o");
    await provider.complete(request);
    assert.deepEqual(sent, ["openai/gpt-4o"]);
  });

  it("429 on the primary falls through to the next free model and reports the model that answered", async () => {
    setEnv();
    const sent: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const model = bodyModel(init);
      sent.push(model);
      if (model === DEFAULT_OPENROUTER_FREE_MODEL) return new Response("rate limited", { status: 429 });
      return completion({ toolCalls: [{ name: "explain_risk", arguments: {} }], stop: false }, `${model}-served`);
    }) as typeof fetch;
    const provider = createOpenRouterProvider();
    const result = await provider.complete(request);
    assert.deepEqual(sent, [DEFAULT_OPENROUTER_FREE_MODEL, DEFAULT_OPENROUTER_FREE_FALLBACKS[0]]);
    assert.equal(result.toolCalls[0]?.name, "explain_risk");
    assert.equal(result.model, `${DEFAULT_OPENROUTER_FREE_FALLBACKS[0]}-served`);
    assert.equal(provider.lastModel, result.model);
  });

  it("429 on every free model falls through to the deterministic runtime with canonical figures", async () => {
    setEnv();
    const sent: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      sent.push(bodyModel(init));
      return new Response("rate limited", { status: 429 });
    }) as typeof fetch;
    const run = await new DeepSeekHarnessRuntime(getDb(), { provider: createOpenRouterProvider() }).run({
      command: "Why is 850K at risk?",
    });
    assert.deepEqual(sent, [DEFAULT_OPENROUTER_FREE_MODEL, ...DEFAULT_OPENROUTER_FREE_FALLBACKS]);
    assert.equal(run.fallbackUsed, true);
    assert.equal(run.report.associatedRevenue, 850000);
    assert.equal(run.report.expectedCash, 540000);
    const response = toAskResponse(run, "Why is 850K at risk?");
    assert.equal(response.agent.modelUsed, null);
    assert.equal(JSON.stringify(response).includes(TEST_KEY), false);
  });

  it("a live free-model run records the answering model in response metadata", async () => {
    setEnv();
    let turn = 0;
    globalThis.fetch = (async (_input, init) => {
      turn += 1;
      const model = bodyModel(init);
      if (turn === 1) return completion({ toolCalls: [{ name: "explain_risk", arguments: {} }], stop: false }, model);
      return completion({ toolCalls: [], stop: true }, model);
    }) as typeof fetch;
    const run = await new DeepSeekHarnessRuntime(getDb(), { provider: createOpenRouterProvider() }).run({
      command: "Why is 850K at risk?",
    });
    assert.equal(run.fallbackUsed, false);
    assert.equal(run.report.modelUsed, DEFAULT_OPENROUTER_FREE_MODEL);
    assert.equal(run.report.associatedRevenue, 850000);
    assert.equal(toAskResponse(run, "Why is 850K at risk?").agent.modelUsed, DEFAULT_OPENROUTER_FREE_MODEL);
  });

  it("an invalid key (401) does not burn the free chain: one call, then deterministic", async () => {
    setEnv();
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response("unauthorized", { status: 401 });
    }) as typeof fetch;
    const run = await new DeepSeekHarnessRuntime(getDb(), { provider: createOpenRouterProvider() }).run({
      command: "Why is 850K at risk?",
    });
    assert.equal(calls, 1);
    assert.equal(run.fallbackUsed, true);
    assert.equal(run.report.associatedRevenue, 850000);
    assert.equal(String(run.error || "").includes(TEST_KEY), false);
  });

  it("OPENROUTER_BASE_URL is honoured; an unreachable gateway goes straight to deterministic", async () => {
    setEnv({ OPENROUTER_BASE_URL: "http://127.0.0.1:9/api/v1/" });
    const urls: string[] = [];
    globalThis.fetch = (async (input) => {
      urls.push(String(input));
      throw new TypeError(`fetch failed Bearer ${TEST_KEY}`);
    }) as typeof fetch;
    const run = await new DeepSeekHarnessRuntime(getDb(), { provider: createOpenRouterProvider() }).run({
      command: "Why is 850K at risk?",
    });
    assert.deepEqual(urls, ["http://127.0.0.1:9/api/v1/chat/completions"]);
    assert.equal(run.fallbackUsed, true);
    assert.equal(run.report.associatedRevenue, 850000);
    assert.equal(String(run.error || "").includes(TEST_KEY), false);
  });

  it("unusable output from one free model tries the next", async () => {
    setEnv();
    const sent: string[] = [];
    globalThis.fetch = (async (_input, init) => {
      const model = bodyModel(init);
      sent.push(model);
      if (model === DEFAULT_OPENROUTER_FREE_MODEL) {
        return new Response(JSON.stringify({ choices: [{ message: { content: "not json at all" } }] }), { status: 200 });
      }
      return completion({ toolCalls: [], stop: true }, model);
    }) as typeof fetch;
    const result = await createOpenRouterProvider().complete(request);
    assert.deepEqual(sent, [DEFAULT_OPENROUTER_FREE_MODEL, DEFAULT_OPENROUTER_FREE_FALLBACKS[0]]);
    assert.equal(result.model, DEFAULT_OPENROUTER_FREE_FALLBACKS[0]);
  });
});
