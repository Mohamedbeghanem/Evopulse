# Control OS information architecture

EvoPulse is one operating environment for a business.

Not a dashboard, CRM, ERP, analytics suite, ChatGPT clone, or four sibling tools (TWIN / CAUSE / TIME / ACT).

```
CONTROL OS
│
├── PULSE
├── COMMAND
├── TIMELINE
├── BUSINESS
└── GOALS
```

Legacy capabilities survive **under** this rail. See [`LEGACY_HTML_AUDIT.md`](./LEGACY_HTML_AUDIT.md).

```
PULSE
│
├── Situation
│   ├── Why?  → Causal Explorer
│   ├── Evidence
│   ├── Simulate
│   └── Act   → Plan → Policy → Action
│
COMMAND
│
└── Universal agent interface
    ASK · SEARCH · NAVIGATE · SIMULATE · ACT
    (must not bypass Policy)
│
TIMELINE
│
└── Time Machine
    happened / changed / happening / expected / at-risk future
│
BUSINESS
│
├── Business Twin
├── Objects
└── Graph
│
GOALS
│
└── Goal → Plan → SIM/IMPACT → Policy → Action → Verify → Outcome
```

The operator should think: *EvoPulse understands my business. I can ask it anything. It tells me what needs attention. It can investigate, simulate, and act without losing control.*

---

## Product model

**observes → understands → monitors → simulates → plans → acts → verifies.**

ChatGPT answers. EvoPulse operates.

Engine names stay in `lib/`. Screens speak in business language.

Lane lock (do not fork stores): **Events · Graph · Detect · Impact · Control**. Details in the legacy audit owning-engines table.

---

## Primary navigation

| Nav | User question | Route | Mode | Consumes |
| --- | --- | --- | --- | --- |
| **Pulse** | What needs me? | `/` | OPERATIONAL | Detect |
| **Command** | Ask / search / operate | `/command` | FOCUSED | Control (no policy bypass) |
| **Timeline** | What happened / is happening / next? | `/timeline` | OPERATIONAL | Events + Detect + Impact |
| **Business** | Explore the Twin | `/business` | OPERATIONAL / Graph CANVAS | Graph |
| **Goals** | What are we protecting? | `/goals` | OPERATIONAL | Control |

Bottom of sidebar (not product verbs): Policies / Control · Settings · User.

### Never in the primary sidebar

Causal · Simulation · Autopilot · Approvals · Evidence · Graph · Learning · Verification · Twin · Exceptions.

Those are contextual. The old 64px rail is **removed**.

---

## Business subspace

Local nav only:

| Local | Route | Mode |
| --- | --- | --- |
| Twin / Overview | `/business` | OPERATIONAL |
| Objects | `/business/objects` | OPERATIONAL |
| Graph | `/business/graph` | CANVAS |
| Policies | `/business/policies` | FOCUSED |
| Learning | `/business/learning` | FOCUSED |

---

## Command model

**The input is part of navigation.** Elevate the legacy header field *“Ask your business…”* into the OS primitive.

Surfaces: docked composer + `⌘K` overlay.

| Intent | Example | Lands |
| --- | --- | --- |
| ASK | Why is Friday's cash at risk? | Command + Evidence |
| SEARCH | Open Atlas Supply. | Inspector or Object |
| NAVIGATE | What changed since Wednesday? | Timeline |
| SIMULATE | What if Atlas is another 3 days late? | Simulation |
| ACT | Protect everything at risk this week. | Goals / plan — Policy first |

Modes `/ask` `/search` `/simulate` `/act` — inferred, not four tabs.

Search groups: People · Companies · Orders · Shipments · Goals · Events · Situations · Commands.

---

## Object model

Person · Company · Supplier · Customer · Order · Shipment · Invoice · Opportunity · Commitment · Expectation · Goal · Event · Situation · Action · Policy.

Consistent object page: Identity · Current state · Timeline · Relationships · Commitments · Risks · Actions · Evidence. Omit empty sections.

| Want | Open |
| --- | --- |
| Quick context | Inspector |
| Deep profile | Object page |
| Why? | Situation → Causal |

---

## Situation model

What Pulse surfaces. One situation = one attention object.

States: **NEEDS YOU · NEEDS APPROVAL · MONITORING · BLOCKED · HANDLED.**  
Secondary: **AT RISK — NOT MISSED.**

View order: What changed → Why it matters → What it affects → What EvoPulse recommends → What it can do → What needs you → Evidence.

Then progressive: Why? / Evidence / Simulate / Act (plan · policy · autopilot · verification).

---

## Goal → Plan → Policy → Action

Signature Control loop (legacy 04, `PLAN.md` P11–P17):

GOAL → PLAN → SIM/IMPACT → POLICY (`AUTO` / `APPROVAL_REQUIRED` / `BLOCKED`) → ACTION → VERIFICATION → OUTCOME.

Send ≠ solved. Plan generated ≠ goal achieved. COMMAND / AgentRuntime use this loop — no side door.

---

## Evidence and agent trace

Business sources, not web citations. BANK / MODEL / POLICY chips map to Events / Impact / Control.

```
Inspecting business          ✓
Tracing dependencies         ✓
Simulating recovery          ✓
Checking policy              ✓
Executing safe action        ✓
Waiting for approval         ●
```

---

## Screen directory

Contracts only except `00-shell` visuals.

| # | Screen | Question | Route |
| --- | --- | --- | --- |
| 00 | Shell | Where am I? How do I ask? | persistent |
| 01 | Pulse | What needs me? | `/` |
| 02 | Command | What can I ask or do? | `/command` |
| 03 | Timeline | Happened / happening / next? | `/timeline` |
| 04 | Situation | What is this attention object? | `/situations/:id` |
| 05 | Risk | What is at risk — missed? | `/risk/:id` |
| 06 | Exception | Situation, fully told | `/situations/:id` |
| 07 | Causal | Why, along the graph? | `/causal/:id` |
| 08 | Simulation | What happens if? | `/simulate` |
| 09 | Goals | What are we protecting? | `/goals` |
| 10 | Plan | What is the generated plan? | `/goals/:id` plan |
| 11 | Autopilot | What can run without me? | contextual |
| 12 | Approval | What waits on a person? | contextual |
| 13 | Business Twin | How is the twin holding? | `/business` |
| 14 | Business Object | What is this object? | `/objects/:type/:id` |
| 15 | Graph | How is it connected? | `/business/graph` |
| 16 | Policy | What is allowed? | `/business/policies` |
| 17 | Learning | What did we learn? | `/business/learning` |
| 18 | Evidence | What are the sources? | `/evidence/:id` |
| 19 | Verification | Did it work? | contextual |

---

## Production mapping (do not modify)

| Control OS | Production today |
| --- | --- |
| Pulse `/` | `/` |
| Command `/command` | `/command` |
| Timeline `/timeline` | `/timeline` |
| Twin `/business` | Twin chips on Pulse |
| Graph `/business/graph` | `/graph` |
| Causal `/causal/:id` | `/explore` |
| Situation `/situations/:id` | `/exceptions/:id` |
| Simulation `/simulate` | `/simulate` |
| Goals `/goals` | `/goals` |

---

## Final test (shell)

| Question | Chrome |
| --- | --- |
| Where am I? | Active sidebar + title |
| What needs me? | Pulse + NEED YOU language |
| How do I ask? | Composer “Ask your business…” + ⌘K |
| How do I find an object? | Command, grouped results |
| Investigate without losing context? | Inspector |
| Go deeper? | Open full view / Why? |
