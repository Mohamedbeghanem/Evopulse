# Product map

Frozen loop (do not redesign as separate products):

EVENT → GRAPH → EXPECTATION → EARLY WARNING → DETECT → EXCEPTION → IMPACT / CAUSAL → GOAL / PLANNER → POLICY → AUTOPILOT → ACTION → VERIFICATION → OUTCOME → LEARNING

Simulation branches without writing reality.
Command Center routes into engines through **AgentRuntime** (PR #15).
Pulse renders the **attention projection** (PR #14).

## Primary surfaces (hackathon)

```
                    ┌──────────── Pulse ────────────┐
                    │  one situation → one card     │
                    └──────────────┬────────────────┘
           NEEDS_YOU │             │ NEEDS_APPROVAL
                     ▼             ▼
              Warning / Impact   Command (approval)
                     │             │
                     ▼             ▼
              Explore / Simulate  AgentRuntime
                                  inspect → trace → simulate
                                  → plan → policy → safe AUTO
                                  → wait for human
```

| Surface | Job | Owns | Does not own |
| --- | --- | --- | --- |
| **Pulse** `/` | What needs me, what we are watching, what is handled | Attention projection | Policy, simulation, execution |
| **Command** `/command` | Live operation | AgentRuntime run, trace, approval dock | Business truth, policy outcome, HANDLED |
| **Warning** `/warnings/:id` | Why this is AT RISK before it is missed | Buffer math, path, evidence | Exception creation (Detect) |

## Supporting surfaces

| Surface | Job |
| --- | --- |
| Explore | Causal path for the supplier cascade |
| Timeline | Past / now / future events |
| Simulate | What-if +3 days, fingerprint unchanged |
| Goals / Plan | Prepared actions + policy badges |
| Graph | Stored nodes and edges |
| Autopilot | Why this classification (trace) |
| Exception | Evidence pack for a Detect-owned miss |

## Demo navigation (Aurora)

Primary: **Pulse · Command · Warnings**
Secondary: Explore · Timeline · Simulate · Goals

Autopilot and Graph stay reachable from a situation card (“Why?” / “Open graph”), not as equal top-level problems.

## Attention objects (must stay 1:1)

| Situation | Primary state | Layers (not extra cards) |
| --- | --- | --- |
| Supplier cascade | `NEEDS_YOU` | Warning, impact, graph, Autopilot, policy |
| 320K recovery | `NEEDS_APPROVAL` | Exception, plan, action, policy, Autopilot |
| 10% discount | `BLOCKED` | Exception, policy, Autopilot, allowed alternative |
| Verification pending | `MONITORING` | Action, verification |
| Verification success | `HANDLED` | Outcome, learning |
| Warning only | `MONITORING` | Warning, buffer, graph |
| Warning → exception | same situation, new owner | History remains in layers |

## AgentRuntime in Command (PR #15)

The Command master must show a **run**, not a chatbot bubble.

Required beats:

1. Operator asks (canned or typed).
2. Runtime phase is visible: inspecting → tracing → simulating → planning → policy → safe execute → waiting.
3. Numbers on screen come from engines (orders, customers, associated revenue, cash timing, policy counts).
4. AUTO actions may execute after a live policy recheck.
5. Approval-required actions stop the run. Approve / Edit / Reject are human-only.
6. `approve_action` is never offered as an agent tool.
7. Fallback is quiet: “Deterministic runtime” — no model brand in the product chrome.

## Out of scope for this design track

- New engines
- New connectors
- Light-mode marketing site
- Production React rewrite (waits on JPG / HTML approval)
