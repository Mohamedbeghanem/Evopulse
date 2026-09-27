# OpenRouter — EvoPulse agent provider

OpenRouter supplies **model intelligence**. EvoPulse remains the source of **business truth** and **authority**.

```
USER
→ Command Center
→ AgentRuntime
→ OpenRouter provider adapter  (optional)
→ selected model
→ governed tool registry
→ canonical engines
→ policy
→ action
→ verification
→ outcome
→ learning
```

The model may investigate and explain. It may call only registered tools. It may request approval.

It may not approve itself, change policy, mark HANDLED, mark verification, invent money, or become a single point of demo failure.

## Environment

Copy `.env.example` to `.env.local`. Placeholders only — never commit secrets.

| Variable | Role |
| --- | --- |
| `EVOPULSE_AGENT_PROVIDER` | `deterministic` (default) or `openrouter` |
| `OPENROUTER_API_KEY` | Server-side only. Never sent to the browser. |
| `OPENROUTER_MODEL` | Primary model id (required when provider is `openrouter`) |
| `OPENROUTER_FALLBACK_MODEL` | Optional second OpenRouter model |
| `OPENROUTER_ALLOWED_PROVIDERS` | Optional comma list of upstream providers |
| `OPENROUTER_DATA_POLICY` | `standard` · `no_training` · `allowlisted_only` |
| `OPENROUTER_ALLOW_PROVIDER_FALLBACK` | Default `true` |
| `OPENROUTER_FAST_MODEL` / `OPENROUTER_REASONING_MODEL` | Optional job routing |
| `EVOPULSE_AGENT_TIMEOUT_MS` | Whole-run budget, capped at 20s |
| `EVOPULSE_AGENT_MAX_OUTPUT` | Max completion tokens |

Configuration is centralized in `getAgentModelConfig()` and `getAgentPrivacyConfig()`. Do not scatter model names through the app.

If `EVOPULSE_AGENT_PROVIDER=openrouter` but the key or model is missing, AgentRuntime stays on the deterministic Command Router.

## Provider abstraction

`AIProvider` (`generate`, optional `stream`) is the only model interface.

- `OpenRouterProvider` calls `https://openrouter.ai/api/v1/chat/completions`
- Deterministic runtime uses `classifyCommand` + the same governed tools
- `AgentRuntime` contains no OpenRouter business rules

Streaming is implemented as a single reliable completion for launch. The UI shows **product events** (Inspecting business… Checking policy…), not hidden reasoning.

## Fallback

1. OpenRouter available → use it.
2. Timeout, HTTP, malformed, or network error → deterministic runtime.
3. Optional configured fallback model is tried once before leaving OpenRouter.
4. Command Center must never blank, 500, or spin forever.

## Tool governance

Allowed categories: **READ**, **PREPARE**, **EXECUTE_SAFE**, **HUMAN_REQUIRED**.

Forbidden: `approve_action`, policy/permission mutation, raw SQL, shell, filesystem, arbitrary deletion, secret access, `mark_verified`, `mark_handled`.

The model cannot invent tools. `execute_safe_actions` rechecks live policy before every AUTO execution. `request_action_approval` never grants approval.

## Cost and loop limits

Canonical limits (do not weaken):

- 12 tool calls
- 20 second execution budget
- 2 identical repeated calls

OpenRouter retries are bounded: one fallback model, then deterministic. No uncontrolled billable loops.

## Security

- API key exists only on the server (`/api/agent/run`).
- Supplier messages, emails, and documents are untrusted **data**.
- Secrets are never placed in model context or logs.
- Financial wording is constrained: associated revenue / expected cash timing — never lost, saved, or guaranteed.

## Observability

`agent_runs` stores command, provider, model, tool names, duration, and completion state. Hidden reasoning is not persisted.

## Tests

`tests/agent-runtime.test.ts` covers provider success, tool parsing, multi-turn, timeout, error, fallback, malformed responses, unknown commands, cancel, limits, prompt injection, forbidden tools, self-approval, policy mutation, policy recheck, simulation isolation, financial and verification semantics, and the 850K / +3 day / Protect / 10% / provider-down goldens.

## Local setup

```bash
cp .env.example .env.local
# optional: EVOPULSE_AGENT_PROVIDER=openrouter
# optional: OPENROUTER_API_KEY=...
# optional: OPENROUTER_MODEL=<configured-model>
npm test
npm run dev
```

Open `/command`. No key is required.

## Development MCP (optional, not production)

OpenRouter MCP can be added to Cursor for catalog/pricing/credits while developing. It is **not** part of the production runtime.

Example `~/.cursor/mcp.json` (do not commit credentials):

```json
{
  "mcpServers": {
    "openrouter": {
      "url": "https://mcp.openrouter.ai/mcp"
    }
  }
}
```

Production EvoPulse calls the OpenRouter HTTP API only.
