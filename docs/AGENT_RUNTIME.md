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

Read from source (`deepseek-ai/deepseek-harness` @ `477b4f420553e8a52c2fbccc464d7561b239c443`, version `0.1.7-rc.2`, MIT).

Harness is a developer-preview **coding-agent product**: Cordis plugins, session JSONL, an agent loop (`turn` / `step` / `tool/call` / `tool/result`), LLM adapters, and default capabilities for shell, filesystem, git, computer use, and browsers. Public APIs are pre-stable. Compatibility-breaking changes are expected. Safety docs warn it can execute model-generated commands.

Stable enough to *learn from*:

- tool registry + guarded execute pipeline
- session log as the only model-visible history
- permission / approval gates before consequential tools
- loop / repeat guards
- replaceable model providers

Not stable enough to embed:

- in-process Cordis plugin tree
- session format generations
- desktop / web / shell / filesystem packages
- `npx @deepseek-ai/dsh` as a sidecar inside the hackathon demo

Official npm packages (`@deepseek-ai/dsh`, `@deepseek-ai/dsh-sdk-client`) drive a Harness subprocess. That subprocess is a software-development agent. EvoPulse must not expose shell, filesystem mutation, git, or SQL.

## Integration method

**Isolated adapter. No vendored Harness tree. No runtime dependency on `@deepseek-ai/dsh*`.**

| Piece | Role |
| --- | --- |
| `AgentRuntime` | The only interface the rest of EvoPulse calls |
| `DeepSeekHarnessRuntime` | Optional provider-backed loop using Harness *concepts* |
| `DeterministicRuntime` | Default, offline, hackathon-safe operating path |
| Tool registry | Narrow calls into existing engines |

If Harness, the model, or the provider is disabled, missing, upgraded, or on fire, EvoPulse keeps working.

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

Default is deterministic. DeepSeek mode uses a separable provider (`DEEPSEEK_*`, `EVOPULSE_LLM_*`, or existing OpenAI / Groq keys). Secrets stay in the environment. No model brand is hardcoded into product identity.

On provider miss, timeout, or throw: fall back to `DeterministicRuntime`. The Command Router remains a last-resort API fallback.

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
