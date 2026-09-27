# Feature freeze

Core intelligence architecture is frozen for the hackathon release.

The loop is:

EVENT → GRAPH → EXPECTATION → EARLY WARNING → DETECT → EXCEPTION → IMPACT / CAUSAL → GOAL / PLANNER → POLICY → AUTOPILOT → ACTION → VERIFICATION → OUTCOME → LEARNING

Simulation branches from live state without writing it. Command Center routes into those engines. Pulse renders the canonical attention projection — one business situation, one primary attention state.

The agent runtime (`lib/agent/`) is an approved adapter **above** this loop. It may inspect and invoke the engines through a governed tool registry. It must not replace engines, bypass policy, or become a second source of truth. See [AGENT_RUNTIME.md](./AGENT_RUNTIME.md).

## Allowed

- P0 / P1 fixes
- UI implementation
- Design system
- Accessibility
- Demo reliability
- Deployment
- Documentation
- Performance fixes
- Test fixes

## Not allowed without explicit approval

- New engines
- New autonomous capabilities
- New data model domains
- Large architectural rewrites
- New integrations / connectors

## Approved exception: connectors & plugins

Emma approved connectors and a plugin / MCP registry (2026-09-27). They sit around the loop, write only into the
existing tables, and route every write through Policy + human approval. See [CONNECTORS.md](./CONNECTORS.md).

## Approved exception: OpenManus-native agent layer

Emma asked for OpenManus to be made EvoPulse-native (2026-09-27). It is a TypeScript port in
`lib/agents/manus/` that sits beside the agent runtime: it uses the same governed executor, OpenRouter
gateway, Policy engine, approvals and trace. No engine file was changed. The only edit inside
`lib/agent/` is additive: `"manus"` was added to `AGENT_RUNTIME_MODES` so runs are labelled correctly.
See [OPENMANUS.md](./OPENMANUS.md).

## Security fix: human actor comes from the session (2026-09-27)

Human-only routes (approve / reject / execute / send-draft / autonomy changes) no longer trust an `actor`
in the request body or query. The actor is resolved server-side by `lib/auth/actor.ts` (`withHumanActor`):
signed-in user → their name (write/admin role enforced, 401/403 otherwise); signed-out demo → the fixed
`"Demo operator"` (disable anonymous demo with `EVOPULSE_PUBLIC_DEMO=false` → 401). Body/query claims naming
an AI/agent/system identity are refused with 400; other claims are ignored. No engine file was changed. The
only edit in `lib/agent/` is a small guard in `applyHumanDecision` (`lib/agent/executor.ts`) that refuses AI
actors ("AI cannot approve actions"), as defense in depth on top of the existing Policy/approval checks.
