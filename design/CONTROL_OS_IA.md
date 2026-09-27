# Control OS information architecture

EvoPulse is an operating environment for a business.

It is not a dashboard with a sidebar, a CRM, an ERP module list, an analytics suite, or a ChatGPT clone.

```
CONTROL OS
│
├── PULSE
├── COMMAND
├── TIMELINE
├── BUSINESS
└── GOALS
```

Everything else appears contextually.

The interface hides architectural complexity. Engines stay in `lib/`. Screens speak in business language.

---

## Product model

EvoPulse:

**observes → understands → monitors → simulates → plans → acts → verifies.**

ChatGPT answers. EvoPulse operates.

The user should never need the names Warning, Exception, Impact, Graph, Simulation, Plan, Policy, Autopilot, Verification to do the work. Those are progressive disclosures inside a Situation or an Object.

---

## Primary navigation

Five destinations. One persistent shell.

| Nav | User question | Route | Workspace mode |
| --- | --- | --- | --- |
| **Pulse** | What needs me? | `/` | OPERATIONAL |
| **Command** | Ask / search / operate | `/command` | FOCUSED |
| **Timeline** | What happened, what is happening, what comes next? | `/timeline` | OPERATIONAL |
| **Business** | Explore the Business Twin | `/business` | OPERATIONAL (Graph → CANVAS) |
| **Goals** | What outcomes are we protecting or pursuing? | `/goals` | OPERATIONAL |

Bottom of sidebar (not primary product verbs):

| Item | Route | Role |
| --- | --- | --- |
| Policies / Control | `/business/policies` | Governed rules. Also reachable from a Situation. |
| Settings | `/settings` | Operator preferences. Out of scope for Phase 0 visuals. |
| User | account menu | Who is acting. |

### Never in the primary sidebar

Warnings · Exceptions · Simulation · Autopilot · Approvals · Evidence · Graph · Learning.

Those are **contextual capabilities**. They open from a Situation, an Object, Command, or local Business navigation.

---

## Business subspace

Inside Business, local navigation — not a second permanent sidebar:

| Local | User question | Route | Mode |
| --- | --- | --- | --- |
| Overview / Twin | How is the business holding? | `/business` | OPERATIONAL |
| Entities | What objects exist? | `/business/entities` | OPERATIONAL |
| Graph | How is it connected? | `/business/graph` | CANVAS |
| Policies | What is allowed? | `/business/policies` | FOCUSED |
| Learning | What have we learned? | `/business/learning` | FOCUSED |

Local nav is a quiet 32px strip under the page header, or a select on 1024.

---

## Command model

**The input is part of product navigation.**

Two surfaces, one grammar:

1. **Universal composer** — docked on Pulse and Command.
2. **EvoPulse Command overlay** — `⌘K` / `Ctrl+K` from anywhere.

The user can **ASK**, **SEARCH**, **NAVIGATE**, or **ACT**. The system infers intent. Modes may be selected with `/ask` `/search` `/simulate` `/act`. Do not create four giant tabs.

| Intent | Example | Lands on |
| --- | --- | --- |
| ASK | Why is 850K at risk? | Command (FOCUSED) + Evidence |
| SEARCH | Atlas Supply | Grouped results → Inspector or Object |
| NAVIGATE | Open Simulation | Simulation canvas |
| ACT | Protect everything at risk this week | Goal / plan / approval path |

Search results are grouped by business object — not a flat file list:

**People · Companies · Orders · Shipments · Goals · Events · Risks / Situations · Commands**

Example query `Atlas`:

- Atlas Supply — Supplier
- Shipment SH-204 — Linked to Atlas Supply
- Supplier delay — Active situation
- Why is Atlas at risk? — Command
- Simulate another 3 day delay — Command
- Protect affected orders — Act

Escape closes the overlay. Focus returns to the trigger.

---

## Object model

The UI revolves around **business objects**. Canonical types:

Person · Company · Supplier · Customer · Order · Shipment · Invoice · Opportunity · Commitment · Expectation · Goal · Event · Situation · Action · Policy

Objects open consistently. Do not invent a unique page paradigm per type.

**Object page** (`/objects/:type/:id`) — FOCUSED or OPERATIONAL:

1. Identity
2. Current state
3. Timeline
4. Relationships
5. Commitments
6. Risks
7. Actions
8. Evidence

Progressive disclosure: omit empty sections.

**Drawer vs page**

| User wants | Open |
| --- | --- |
| Quick context (click Atlas Supply) | Inspector |
| Deep profile | Object page |
| Why? | Situation / Causal workspace |

---

## Situation model

A **Situation** is what Pulse surfaces. One situation = one primary attention object.

Examples: supplier cascade · 320K recovery · 10% policy block.

### Operational states (global)

Do not invent twenty statuses.

| State | Means |
| --- | --- |
| **NEEDS YOU** | A human decision or action is required now. |
| **NEEDS APPROVAL** | EvoPulse can act; policy requires a person. |
| **MONITORING** | Tracked. No human action yet. |
| **BLOCKED** | Policy or dependency forbids the recommended act. |
| **HANDLED** | Closed. Remains on Timeline. |

### Secondary temporal state

**AT RISK — NOT MISSED**

The clock has not crossed the deadline. Impact is still recoverable.

Production today uses `NEEDS_YOU | MONITORING | HANDLED | HEALTHY` plus policy `APPROVAL_REQUIRED`. Control OS folds `HEALTHY` into the absence of attention, and `APPROVAL_REQUIRED` into **NEEDS APPROVAL**.

### Situation view

Opens into, in this order:

1. What changed
2. Why it matters
3. What it affects
4. What EvoPulse recommends
5. What EvoPulse can do
6. What needs you
7. Evidence

Progressive disclosure may then reveal: warning · exception · impact · graph · simulation · plan · policy · autopilot · verification.

The user does not navigate those as modules.

---

## Evidence and agent trace

Evidence is **business sources**, not web citations.

Supplier message · Shipment record · Order deadline · Customer commitment · Policy rule · Verification event.

Every important conclusion can expose **Sources / Evidence**.

Agent Runtime uses the same language — not raw logs:

```
Inspecting business          ✓
Tracing dependencies         ✓
Simulating recovery          ✓
Checking policy              ✓
Executing safe action        ✓
Waiting for approval         ●
```

Each step expands to Evidence.

---

## Screen directory

Contracts only in this phase. Visual design stops at the shell.

| # | Screen | User question | Target route |
| --- | --- | --- | --- |
| 00 | Shell | Where am I? How do I ask? | persistent |
| 01 | Pulse | What needs me? | `/` |
| 02 | Command | What can I ask or do? | `/command` |
| 03 | Timeline | What happened / is happening / next? | `/timeline` |
| 04 | Attention | What is the queue of situations? | `/situations` |
| 05 | Risk | What is at risk, and is it missed? | `/risk/:id` |
| 06 | Exceptions | What is this situation, fully? | `/situations/:id` |
| 07 | Causal | Why, along the graph? | `/causal/:id` |
| 08 | Simulation | What happens if? | `/simulate` |
| 09 | Goals | What are we protecting? | `/goals` |
| 10 | Autopilot | What can run without me? | contextual |
| 11 | Approvals | What is waiting on a human? | contextual |
| 12 | Business Twin | How is the twin holding? | `/business` |
| 13 | Graph | How is it connected? | `/business/graph` |
| 14 | Policies | What is allowed? | `/business/policies` |
| 15 | Learning | What did we learn? | `/business/learning` |
| 16 | Evidence | What are the sources? | `/evidence/:id` |

---

## Production mapping (do not modify)

Current production chrome is a top-nav of Pulse / Explore / Timeline / Simulate / Command / Goals / Graph.

| Control OS | Current production |
| --- | --- |
| Pulse `/` | `/` |
| Command `/command` | `/command` |
| Timeline `/timeline` | `/timeline` |
| Business `/business` | no overview; twin chips live on Pulse |
| Graph `/business/graph` | `/graph` |
| Causal `/causal/:id` | `/explore` |
| Situation `/situations/:id` | `/exceptions/:id` |
| Impact / risk | `/impact/:exceptionId` |
| Simulation `/simulate` | `/simulate` |
| Goals `/goals` | `/goals` |
| Policies / Learning / Autopilot / Approvals | no dedicated screen |

Phase 0 does **not** change `app/`, `lib/`, or production components. This file is the target IA.

---

## Final test (shell)

A person looking at the shell should answer without hunting:

| Question | Answer in chrome |
| --- | --- |
| Where am I? | Active sidebar item + page title |
| What needs me? | Pulse, plus a count on Pulse |
| How do I ask EvoPulse anything? | Composer + ⌘K |
| How do I find a business object? | Command search, grouped results |
| How do I investigate without losing context? | Inspector |
| How do I go deeper? | Open full view → Object or Situation |
