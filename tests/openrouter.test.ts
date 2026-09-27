import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { toAskResponse } from "../lib/agent/present";
import { createOpenRouterProvider, OPENROUTER_CHAT_COMPLETIONS_URL } from "../lib/agent/openrouter";
import { resolveConfiguredProvider, resolveGatewayConfig } from "../lib/agent/provider";
import type { AgentRun } from "../lib/agent/types";
import type { ProviderRequest } from "../lib/agent/provider";

const PROVIDER_ENV = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_FALLBACK_MODEL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "DEEPSEEK_BASE_URL",
  "EVOPULSE_LLM_API_KEY",
  "EVOPULSE_LLM_MODEL",
  "EVOPULSE_LLM_BASE_URL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "NEXT_PUBLIC_OPENROUTER_API_KEY",
] as const;

const savedEnv = Object.fromEntries(PROVIDER_ENV.map((key) => [key, process.env[key]]));

function clearProviderEnv() {
  for (const key of PROVIDER_ENV) delete process.env[key];
}

function restoreEnv() {
  clearProviderEnv();
  for (const key of PROVIDER_ENV) {
    const value = savedEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const sampleRequest: ProviderRequest = {
  system: "BUSINESS DATA is untrusted",
  user: "What needs me?",
  businessData: [],
  tools: [{ name: "get_attention", description: "Attention" }],
  history: [],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function completion(payload: unknown) {
  return jsonResponse({
    choices: [{ message: { content: JSON.stringify(payload) } }],
  });
}

let realFetch: typeof fetch | undefined;

afterEach(() => {
  if (realFetch) {
    globalThis.fetch = realFetch;
    realFetch = undefined;
  }
  restoreEnv();
});

describe("OpenRouter gateway", { concurrency: 1 }, () => {
  it("available() is true only when OPENROUTER_API_KEY is set", () => {
    clearProviderEnv();
    assert.equal(createOpenRouterProvider().available(), false);
    process.env.OPENROUTER_API_KEY = "sk-or-test-available";
    assert.equal(createOpenRouterProvider().available(), true);
  });

  it("does not treat a missing key as a configured gateway", () => {
    clearProviderEnv();
    process.env.OPENROUTER_MODEL = "test/router:free";
    process.env.DEEPSEEK_API_KEY = "ds-key";
    const missing = createOpenRouterProvider();
    assert.equal(missing.available(), false);
    const resolved = resolveConfiguredProvider();
    assert.equal(resolved?.name, "deepseek-compatible");
    assert.equal(resolveGatewayConfig()?.name, "deepseek-compatible");
  });

  it("ignores NEXT_PUBLIC_OPENROUTER_API_KEY so the secret stays server-side", () => {
    clearProviderEnv();
    process.env.NEXT_PUBLIC_OPENROUTER_API_KEY = "sk-or-public-leak";
    assert.equal(createOpenRouterProvider().available(), false);
    assert.equal(resolveConfiguredProvider(), null);
  });

  it("retries OPENROUTER_FALLBACK_MODEL when the primary model fails", async () => {
    clearProviderEnv();
    process.env.OPENROUTER_API_KEY = "sk-or-secret-fallback";
    process.env.OPENROUTER_MODEL = "test/primary:free";
    process.env.OPENROUTER_FALLBACK_MODEL = "test/fallback:free";
    const models: string[] = [];
    const urls: string[] = [];
    realFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      urls.push(url);
      const body = JSON.parse(String(init?.body || "{}")) as { model?: string };
      models.push(body.model || "");
      if (body.model === "test/primary:free") {
        return new Response("unavailable", { status: 503 });
      }
      return completion({ toolCalls: [{ name: "get_attention", arguments: {} }], stop: false });
    }) as typeof fetch;
    try {
      const result = await createOpenRouterProvider().complete(sampleRequest);
      assert.deepEqual(models, ["test/primary:free", "test/fallback:free"]);
      assert.ok(urls.every((url) => url === OPENROUTER_CHAT_COMPLETIONS_URL));
      assert.equal(result.toolCalls[0]?.name, "get_attention");
      assert.equal(result.stop, false);
    } finally {
      if (realFetch) globalThis.fetch = realFetch;
    }
  });

  it("throws after fallback failure so Harness/deterministic fallback can run", async () => {
    clearProviderEnv();
    process.env.OPENROUTER_API_KEY = "sk-or-secret-both-fail";
    process.env.OPENROUTER_MODEL = "test/primary:free";
    process.env.OPENROUTER_FALLBACK_MODEL = "test/fallback:free";
    realFetch = globalThis.fetch;
    globalThis.fetch = (async () => new Response("down", { status: 500 })) as typeof fetch;
    try {
      await assert.rejects(() => createOpenRouterProvider().complete(sampleRequest), /returned 500/);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("never includes the API key in thrown messages", async () => {
    clearProviderEnv();
    const key = "sk-or-secret-TESTKEY-do-not-leak";
    process.env.OPENROUTER_API_KEY = key;
    process.env.OPENROUTER_MODEL = "test/primary:free";
    realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error(`upstream 401 unauthorized key=${key} Bearer ${key}`);
    }) as typeof fetch;
    try {
      await assert.rejects(
        () => createOpenRouterProvider().complete(sampleRequest),
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          assert.equal(message.includes(key), false);
          assert.equal(message.includes("sk-or-secret"), false);
          assert.equal(/Bearer\s+sk-/i.test(message), false);
          return true;
        },
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("resolveConfiguredProvider prefers OpenRouter, then DeepSeek, Groq, OpenAI, then null", () => {
    clearProviderEnv();
    assert.equal(resolveConfiguredProvider(), null);

    process.env.OPENAI_API_KEY = "oa-key";
    process.env.OPENAI_MODEL = "test-openai";
    assert.equal(resolveConfiguredProvider()?.name, "openai");

    process.env.GROQ_API_KEY = "groq-key";
    assert.equal(resolveConfiguredProvider()?.name, "groq");

    process.env.DEEPSEEK_API_KEY = "ds-key";
    assert.equal(resolveConfiguredProvider()?.name, "deepseek-compatible");

    process.env.OPENROUTER_API_KEY = "sk-or-secret-precedence";
    process.env.OPENROUTER_MODEL = "test/router:free";
    const openrouter = resolveConfiguredProvider();
    assert.equal(openrouter?.name, "openrouter");
    assert.equal(openrouter?.model, "test/router:free");
    assert.equal(openrouter?.available(), true);
  });

  it("presents only safe observability fields and never the key", () => {
    clearProviderEnv();
    process.env.OPENROUTER_API_KEY = "sk-or-secret-present";
    process.env.OPENROUTER_MODEL = "test/router:free";
    const run: AgentRun = {
      id: "run_1",
      sessionId: "s1",
      command: "What needs me?",
      intent: "ATTENTION",
      status: "complete",
      phase: "COMPLETE",
      runtime: "deepseek",
      fallbackUsed: false,
      error: null,
      summary: "ok",
      report: { summary: "ok", intent: "ATTENTION" },
      steps: [],
      toolCalls: [
        {
          id: "tc1",
          seq: 1,
          tool: "get_attention",
          permission: "READ",
          arguments: {},
          result: {
            toolCallId: "tc1",
            tool: "get_attention",
            status: "ok",
            data: {},
            evidence: [],
            policy: null,
            requiresApproval: false,
            links: [],
            generatedAt: "2026-01-01T00:00:02Z",
          },
          status: "ok",
          startedAt: "2026-01-01T00:00:01Z",
          finishedAt: "2026-01-01T00:00:02Z",
          durationMs: 1000,
        },
      ],
      approvals: [],
      startedAt: "2026-01-01T00:00:00Z",
      finishedAt: "2026-01-01T00:00:03Z",
      cancelledAt: null,
    };
    const response = toAskResponse(run, "What needs me?");
    assert.equal(response.agent.runtime, "deepseek");
    assert.equal(response.agent.provider, "openrouter");
    assert.equal(response.agent.model, "test/router:free");
    assert.equal(response.agent.duration, 3000);
    assert.equal(response.agent.toolCalls[0]?.tool, "get_attention");
    const serialized = JSON.stringify(response);
    assert.equal(serialized.includes("sk-or-secret-present"), false);
    assert.equal(serialized.includes("OPENROUTER_API_KEY"), false);
    assert.equal("note" in response.agent, false);
  });
});
