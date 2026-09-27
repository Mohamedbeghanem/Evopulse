# OpenManus, EvoPulse-native

Emma's ask (2026-09-27): "Clone OpenManus in the project and make it Evopulse Native."

Decision: **port, don't vendor.** OpenManus (Python) is not shipped as a sidecar. Its agent / flow /
tool architecture is ported to TypeScript in `lib/agents/manus/` and wired into EvoPulse's existing
agent runtime, OpenRouter gateway, Policy engine, approvals, and audit trail.

- Upstream: https://github.com/FoundationAgents/OpenManus (commit `3309bf4`, 2026-08-16)
- License: MIT, Copyright (c) 2025 manna_and_poem — kept in [`third_party/openmanus/LICENSE`](../third_party/openmanus/LICENSE)
- UI: **Agent runs** at `/agents/manus` (sidebar: lucide `Workflow`)
- API: `POST /api/agents/manus/run` `{goal}` · `GET /api/agents/manus/runs/:id` · decisions use the
  existing human-only `POST /api/agent/runs/:id/approve` `{approvalId, decision}`

## Port mapping

| OpenManus (Python) | EvoPulse (TypeScript) | Notes |
| --- | --- | --- |
| `app/schema.py` `Message`, `Memory`, `AgentState`, `ToolCall` | `lib/agents/manus/schema.ts` | Adds `FinishReason` (terminated / no_tool_call / max_steps / stuck / awaiting_human / limit / error). |
| `app/agent/base.py` `BaseAgent` | `agent/base.ts` | Step-limited `run()`, IDLE→RUNNING→FINISHED→IDLE, `is_stuck` / `handle_stuck_state`, "Terminated: Reached max steps". |
| `app/agent/react.py` `ReActAgent` | `agent/react.ts` | `step() = think() → act()`. |
| `app/agent/toolcall.py` `ToolCallAgent` | `agent/toolcall.ts` | `think()` asks the model for tool calls; `act()` runs them, `max_observe` truncation, special tools `terminate` + `ask_human`. |
| `app/agent/manus.py` `Manus` | `agent/manus.ts` | Same class role; EvoPulse prompts and tools (below). |
| `app/prompt/manus.py`, `toolcall.py`, `planning.py` | `prompts.ts` | Rewritten for EvoPulse: tool output / business content is DATA. |
| `app/flow/base.py` `BaseFlow` | `flow/base.ts` | Agents map + primary agent. |
| `app/flow/planning.py` `PlanningFlow`, `PlanStepStatus` | `flow/planning.ts` | Create plan → first active step (`[TYPE]` tag picks the executor) → mark in_progress → run executor → mark outcome → finalize. |
| `app/flow/flow_factory.py` `FlowFactory`, `FlowType` | `flow/factory.ts` | `createFlow(FlowType.PLANNING, …)`. |
| `app/tool/base.py` `BaseTool`, `ToolResult` | `tool.ts` | Adds a governance `kind`: read / prepare / approval / control / external_read / unavailable. |
| `app/tool/tool_collection.py` `ToolCollection` | `tool-collection.ts` | `add_tool` skips duplicates; only *available* tools are sent to the model; unknown / disabled names are refused. |
| `app/tool/planning.py` `PlanningTool` | `tools/planning.ts` | create / update / list / get / set_active / mark_step / delete, `[✓] [→] [!] [ ]` marks. |
| `app/tool/terminate.py` `Terminate` | `tools/control.ts` `terminateTool` | status success / failure. |
| `app/tool/ask_human.py` `AskHuman` | `tools/control.ts` `askHumanTool` | No stdin on a server: the question is recorded, the run stops, the UI asks; the answer starts a follow-up run. |
| `app/tool/mcp.py` `MCPClients`, `app/agent/mcp.py` | `tools/evopulse.ts` `evopulsePluginTools` | Reuses the #59 connector / MCP registry: enabled installs + enabled tools only, admin instructions appended to descriptions. |
| `app/tool/web_search.py` `WebSearch` | `tools/web-search.ts` | One real API provider (Brave, `BRAVE_SEARCH_API_KEY`). No key → "not configured", hidden from the model. |
| `app/llm.py` `LLM.ask_tool` | `llm.ts` | **No second client.** Wraps the existing OpenRouter `ModelProvider`; deterministic runtime otherwise. |
| `main.py` / `run_flow.py` | `runtime.ts` `runManusGoal` | Persists as a normal EvoPulse agent run (`runtime = "manus"`). |

## EvoPulse-native rules (how they are enforced)

- **One LLM path.** `resolveManusLLM` only accepts a provider named `openrouter`, built by the existing
  `createOpenRouterProvider()` (PR #55 policy: primary `nvidia/nemotron-3-super-120b-a12b:free`, free
  fallbacks, paid ids refused unless `OPENROUTER_ALLOW_PAID=true`). DeepSeek / Groq / OpenAI keys are
  ignored by Manus. No key, a refused provider, or any model error → the deterministic runtime.
- **Deterministic runtime.** `deterministic.ts` plans and thinks from the existing AgentRuntime
  playbooks (`selectPlaybook`). It never reads tool output to choose its next call.
- **One governed gateway.** Every EvoPulse and plugin tool call goes through `invokeTool` in
  `lib/agent/executor.ts` — tool-call and runtime limits, repeated-call guard, idempotency,
  FORBIDDEN refusal, trace steps, approval records. Manus adds no router and no state machine.
- **Read runs, write waits.** READ tools run. PREPARE tools (create_goal, generate_plan) only draft
  records; the planner's actions are policy-evaluated. `request_action_approval` and plugin WRITE tools
  create pending approvals. `execute_safe_actions` and `approve_action` are **not** in the Manus tool
  collection: a Manus run executes nothing by itself.
- **Humans decide.** Approve / reject go through the existing `applyHumanDecision` (policy rechecked
  right before execution; connector writes refuse AI actors and run via `executeConnectorAction`).
  EXECUTED is recorded; HANDLED only comes from the verification engine (replies verify same-party
  actions only — unchanged).
- **Data is data.** Tool observations are wrapped as `contentRole: business_data`; a goal that looks
  like an override reaches the model only as BUSINESS DATA and gets the guarded plan in deterministic
  mode. Tests cover a model that obeys injected output: it still cannot approve, execute, or bypass.

## Left out, and why

| OpenManus piece | Status | Why |
| --- | --- | --- |
| `PythonExecute` | stub, "not available" | Arbitrary code execution is not sandboxed in EvoPulse. |
| `Bash` / `sandbox/*` (Docker) | stub, "not available" | No shell for the agent; Docker sandboxes are not available on serverless. |
| `StrReplaceEditor`, `file_operators` | stub, "not available" | The agent works on business records through tools, not on files. |
| `BrowserUseTool`, `browser_use` MCP, `Crawl4aiTool` | stub, "not available" | No sandboxed browser runtime is shipped. |
| `DataAnalysis` agent, chart tools | not ported | Would require code execution. |
| `SWEAgent`, `SandboxManus`, `BrowserAgent` | not ported | Coding / sandbox / browser agents are out of scope for a business OS. |
| `ComputerUseTool`, `daytona/*` sandbox | not ported | Remote desktop / sandbox control is not safe or available here. |
| `CreateChatCompletion` tool | not ported | Structured output comes from the OpenRouter gateway's JSON mode. |
| `app/mcp/server.py` (OpenManus as an MCP server) | not ported | EvoPulse is an MCP *client* via the #59 registry; exposing agents as a server is a separate decision. |
| Google / Baidu / DuckDuckGo / Bing scraping | not ported | Only a configured search API is used. |
| `config.toml` / multi-LLM config, Bedrock, Azure, vision | not ported | One gateway: OpenRouter with the free-model policy. |
| LLM-written final summary | replaced | The flow summary is built from recorded outcomes (nothing invented, no extra model call). |

The stubs are listed on the Agent runs page, labelled "not available", never handed to the model, and
cannot be enabled: there is no toggle, because there is no safe implementation behind them. If one is
ever added, it must be admin-only, off by default, and never on in serverless (`isServerless()`).

## Behaviour differences from upstream (deliberate)

- `is_stuck` compares the last assistant message (content + tool calls) with earlier ones in the same
  step. After one change-of-strategy prompt, a second stuck detection stops the step.
- A content-only model answer (no tool call) ends the step instead of looping to `max_steps`.
- A plan step whose tools created approvals is marked `blocked` ("Waiting for human approval").
- Limits per run: 24 governed tool calls, 90 s, 2 identical calls; 8 agent steps per plan step; 8 plan steps.

## Storage

Runs are ordinary rows in `agent_runs` (`runtime = "manus"`), with trace steps, tool calls, and approvals
in the existing agent tables. The plan / thought / tool events are in `manus_run_events`, created
lazily by `lib/agents/manus/store.ts` (no engine migration).
