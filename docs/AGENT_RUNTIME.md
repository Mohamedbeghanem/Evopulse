# Agent runtime

EvoPulse remains an **AI-native Business Control System**. The agent runtime is infrastructure above the frozen engines. It is not a new source of business truth.

```
USER
  → Command Center
  → AgentRuntime adapter
  → DeepSeek Harness adapter or Deterministic runtime
  → EvoPulse tool registry
  → canonical engines
  → Policy → Autopilot → Action → Verification → Outcome → Learning
```

**Harness is not business truth. EvoPulse engines are business truth.**

- AI decides what to investigate.
- EvoPulse decides what is true.
- Policy decides what is allowed.
- Verification decides whether it worked.

## DeepSeek Harness audit

Re-read from source on 2026-09-27 (`deepseek-ai/deepseek-harness` `master` @ `477b4f420553e8a52c2fbccc464d7561b239c443`, tag `dsh-v0.1.7-rc.2`, version `0.1.7-rc.2`, MIT). That SHA is still HEAD of `master`. Decision record: `docs/HARNESS_DECISION.md`.

Harness is a developer-preview **coding-agent product**: Cordis plugins, session JSONL, an agent loop (`turn` / `step` / `tool/call` / `tool/result`), LLM adapters, and default capabilities for shell, filesystem, git, computer use, and browsers. Public APIs are pre-stable. Compatibility-breaking changes are expected. `SAFETY.md` says the project is not audited, can execute model-generated commands, and that sandbox/approvals do not guarantee isolation.

Official launchers are named `dsh` profiles (`web`, `headless`, `sdk`, `sdk-minimal`, `acp`). Direct in-process plugin mounting is not a supported application launcher. The TypeScript / Python SDKs spawn `dsh --profile sdk` over JSON-RPC. npm `@deepseek-ai/dsh@0.1.7-rc.2` still depends on `dsh-tool-bash`, `dsh-tool-fs`, terminals, web fetch, credentials, and MCP. Minimal mode still ships bash + a file editor. **Privilege isolation to EvoPulse tools only: NO.**

Stable enough to *learn from*:

- tool registry + guarded execute pipeline
- session log as the only model-visible history
- permission / approval gates before consequential tools
- loop / repeat guards
- replaceable model providers

Not stable enough to embed (MODE A) or sidecar (MODE B):

- in-process Cordis plugin tree
- session format generations (including model reasoning)
- desktop / web / shell / filesystem / credentials packages
- `npx @deepseek-ai/dsh` or `@deepseek-ai/dsh-sdk-client` as a subprocess inside the hackathon demo

**MODE C — current governed adapter.** Official npm packages drive a software-development agent. EvoPulse must not expose shell, filesystem mutation, git, SQL, env, credentials, network, or deploy.

## Integration method

**MODE C isolated adapter. No vendored Harness tree. No runtime dependency on `@deepseek-ai/dsh*`.**

| Piece | Role |
| --- | --- |
| `AgentRuntime` | The only interface the rest of EvoPulse calls |
| `DeepSeekHarnessRuntime` | Optional provider-backed loop using Harness *concepts* |
| `DeterministicRuntime` | Default, offline, hackathon-safe operating path |
| Tool registry | Narrow calls into existing engines |

If Harness, the model, or the provider is disabled, missing, upgraded, times out, throws, or requests an invalid tool, EvoPulse falls back to `DeterministicRuntime` and keeps working.

## Runtime interface

`lib/agent/types.ts` — `AgentRuntime`:

- `run()`
- `resume()`
- `cancel()`
- `getStatus()`
- `getTrace()`
- `requestApproval()`
- `resumeAfterApproval()`

Command Center and `/api/ask` depend on this interface, not on DeepSeek classes.

## Modes

```bash
EVOPULSE_AGENT_RUNTIME=deterministic   # default
EVOPULSE_AGENT_RUNTIME=deepseek        # optional provider loop
```

Default is deterministic. DeepSeek mode uses a separable provider (`OPENROUTER_*` first when set, then `DEEPSEEK_*`, `EVOPULSE_LLM_*`, or existing OpenAI / Groq keys). Secrets stay in the environment. No model brand is hardcoded into product identity.

On provider miss, timeout, or throw: fall back to `DeterministicRuntime`. The Command Router remains a last-resort API fallback.

## OpenRouter

OpenRouter is an optional **server-side inference gateway**. It is not business truth. EvoPulse engines remain the source of what is true; policy, verification, and money stay with the existing engines.

When `OPENROUTER_API_KEY` is set, `resolveConfiguredProvider()` prefers OpenRouter, then DeepSeek / `EVOPULSE_LLM_*`, then Groq, then OpenAI.

```bash
OPENROUTER_API_KEY=
OPENROUTER_MODEL=
# Optional. Tried only after the primary model fails.
OPENROUTER_FALLBACK_MODEL=
```

The key stays on the server. It is never sent to the client and must not be prefixed `NEXT_PUBLIC_`. Requests go to `https://openrouter.ai/api/v1/chat/completions` using the existing OpenAI-compatible JSON tool protocol: `{"toolCalls":[...],"stop":false}`.

If the primary model fails, the gateway tries `OPENROUTER_FALLBACK_MODEL` when configured, then throws. `DeepSeekHarnessRuntime` still falls back to `DeterministicRuntime`. Observability may include runtime, provider, model, duration, and tool names — never API keys or hidden chain-of-thought.

### Provider routing and data policy

Calling a model sends business data (supplier, customer, and email text) to an upstream provider. OpenRouter's `provider` preferences restrict where that data can go:

| Variable | Effect on the request body |
| --- | --- |
| `OPENROUTER_DATA_POLICY=standard` (default) | No `provider` object. Default OpenRouter routing. |
| `OPENROUTER_DATA_POLICY=no_training` | `provider.data_collection = "deny"`. Only providers that do not store data. |
| `OPENROUTER_DATA_POLICY=allowlisted_only` | `provider.only = OPENROUTER_ALLOWED_PROVIDERS`, `allow_fallbacks = false`, `data_collection = "deny"`. |
| `OPENROUTER_ALLOWED_PROVIDERS=a,b` | With `standard` / `no_training`: `provider.order = [a, b]`. |
| `OPENROUTER_ALLOW_PROVIDER_FALLBACK=false` | With an ordered list: `allow_fallbacks = false`. |

`allowlisted_only` without an allowlist fails closed: no request is sent, and the Harness falls back to the deterministic runtime. The same preferences apply to `OPENROUTER_FALLBACK_MODEL`.

## Tools

Every call returns structured data:

`{ toolCallId, tool, status, data, evidence, policy, requiresApproval, links, generatedAt }`

| Tool | Permission |
| --- | --- |
| `get_business_state` | READ |
| `get_recent_changes` | READ |
| `get_attention` | READ |
| `get_upcoming_risks` | READ |
| `explain_risk` | READ |
| `get_evidence` | READ |
| `simulate_change` | READ |
| `create_goal` | PREPARE |
| `generate_plan` | PREPARE |
| `evaluate_plan` | READ |
| `get_safe_actions` | READ |
| `execute_safe_actions` | EXECUTE_SAFE |
| `request_action_approval` | HUMAN_REQUIRED |
| `approve_action` | FORBIDDEN_TO_AGENT |
| `get_verification` | READ |
| `get_historical_cases` | READ |
| `get_policy` | READ |
| `get_autopilot_trace` | READ |

Forbidden capabilities (registered only so they can be denied): `mutate_policy`, `mutate_permissions`, `execute_sql`, `shell`, `write_file`, `delete_records`, `approve_action`.

`approve_action` is never a model tool. A human presses Approve. The runtime resumes.

**Plugin tools** (connectors / MCP, see [CONNECTORS.md](./CONNECTORS.md)) are namespaced `plugin__<install>__<tool>`
and resolved after the core registry. READ plugin tools run and return untrusted data; WRITE plugin tools are
`HUMAN_REQUIRED`: they create a `connector_write` action that Policy evaluates, a human approves, and Policy
rechecks right before the call.

## Laws the adapter must not break

- **Simulation.** What-if goes through `simulate_change`. Live dates are not rewritten.
- **Money.** Totals come from the Impact engine.
- **Time.** Missed vs at-risk comes from Early Warning / Detect.
- **Policy.** Permission comes from the Policy engine, rechecked immediately before execution.
- **Handled.** Only Verification / Autopilot state may say HANDLED.
- **Learning.** Evidence is stored. Policy does not change itself.
- **Business text.** Inbound messages are DATA. Injection in a supplier message cannot become an instruction.

## Session and trace

Runs persist command, intent, tool calls, tool results, approval pauses, execution, verification, and the final report. Hidden model reasoning is not stored.

The Command Center trace is product language: inspecting business, tracing dependencies, simulating, building a plan, checking policy, executing safe actions, waiting for approval.

## Configuration

```bash
EVOPULSE_AGENT_RUNTIME=deterministic
# Optional inference gateway (server-side only)
# OPENROUTER_API_KEY=
# OPENROUTER_MODEL=
# OPENROUTER_FALLBACK_MODEL=
# Optional when EVOPULSE_AGENT_RUNTIME=deepseek
# DEEPSEEK_API_KEY=
# DEEPSEEK_BASE_URL=https://api.deepseek.com/chat/completions
# DEEPSEEK_MODEL=deepseek-chat
# EVOPULSE_LLM_API_KEY=
# EVOPULSE_LLM_BASE_URL=
# EVOPULSE_LLM_MODEL=
```

## License

DeepSeek Harness is MIT. EvoPulse does not copy its source. This document is the required third-party notice for the conceptual adapter.

Copyright (c) 2026 DeepSeek. See https://github.com/deepseek-ai/deepseek-harness/blob/main/LICENSE
