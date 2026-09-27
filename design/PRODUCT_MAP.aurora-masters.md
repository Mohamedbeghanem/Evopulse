# EvoPulse product map

Audited against the integrated ship state:

- `origin/main` `c22ca53` — PR #10 merged; does **not** contain the frozen loop or AgentRuntime
- PR #14 `cursor/final-integration-hardening-e6b9` @ `4ff85fc` — OPEN, not merged
- PR #15 `cursor/agent-runtime-e54a` @ `9eda574` — OPEN, stacked on #14, contains #14

This map describes **PR #15 head**. That is the product the jury will actually operate. Design work does not mutate #14 or #15.

Clock: Sunday 27 Sep 2026, 08:18 Africa/Tunis (`DEMO_NOW_ISO`).

---

## Category

EvoPulse is an **AI-native Business Control System**.

It is not a CRM, ERP, analytics dashboard, chatbot, workflow builder, or coding agent.

The interface has three levels:

| Level | Question | Surfaces |
| --- | --- | --- |
| 1 Control | What needs me? | Pulse |
| 2 Understand | Why? | Warning / Exception / Causal / Evidence / Graph |
| 3 Act | What should happen next? | Simulation / Goal / Plan / Autopilot / Approval / Verification |

Command Center is the universal interface across all three.

---

## Proposed first-level navigation

| Nav | Route | Why |
| --- | --- | --- |
| Pulse | `/` | Control. Always home. |
| Command | `/command` | Universal ask / operate. |
| Timeline | `/timeline` | Time machine. Past / now / future. |
| Business | `/graph` landing + contextual | Twin, Graph, Policies, Learning — not separate top items. |
| Goals | `/goals` | Cross-business objectives and plans. |

Remove from first-level nav (keep as contextual destinations):

| Surface | Current route | Decision |
| --- | --- | --- |
| Explore | `/explore` | Contextualize from Pulse / Risk |
| Simulate | `/simulate` | Contextualize from Pulse / Risk / Command |
| Graph | `/graph` | Under Business |
| Warnings | `/warnings` | Contextualize — warning is a layer, not a product |
| Warning detail | `/warnings/:id` | Merge into Risk / Why |
| Autopilot | `/autopilot` | Contextualize — classification, not a place |
| Autopilot detail | `/autopilot/:id` | Merge into situation / Command trace |
| Exception | `/exceptions/:id` | Contextualize from Pulse |
| Exception plan | `/exceptions/:id/plan` | Contextualize — approval lives here today |
| Impact | `/impact/:id` | Merge into Risk / Why |
| Goals detail | `/goals/:id` | Keep under Goals |

---

## Surfaces

### Pulse — `/`

- **User question:** What needs my attention?
- **Primary information:** Canonical attention projection. One situation, one primary state.
- **Primary action:** Review the selected situation.
- **Secondary action:** Simulate the cascade. Open Command (“Protect this week”).
- **Engine:** `lib/attention` over Autopilot + Warnings + Exceptions + Impact. Pulse itself is a selector, not a new engine.
- **State (WOW demo, after `triggerSupplierDelay`, 320K still open):**
  - 1 **NEEDS YOU** — Atlas Supply / SH-204 cascade. 3 orders, 3 customers, 850,000 DZD associated, 540,000 DZD expected cash timing. Warning is a **layer**, not a second card.
  - 1 **NEEDS APPROVAL** — 320,000 DZD proposal recovery. External message requires a human.
  - **MONITORING** — cash-week timing may watch (Twin CASH = MONITORING). Do not clone Order A as a second card; that violates one-situation-one-object.
  - Buffer on the cascade (after delay): available **−23h**, required **18h**, shortfall **−41h**. AT RISK — NOT MISSED.
- **Related:** Command, Risk/Why, Simulate, Goals.
- **IA:** **Keep** as Level 1 home.

Current UI problems: KPI-like stat tiles, twin domain cards, contact/opportunity/clock widgets, pill nav, five engine layers listed as text, serif-magazine density. Pulse currently *explains the product* more than it *controls the business*.

### Command — `/command`

- **User question:** Ask EvoPulse to inspect or operate.
- **Primary information:** Live agent run — steps, evidence, policy, approvals.
- **Primary action:** Run a command. Approve / Edit / Reject when paused.
- **Secondary action:** Open linked engines (goals, simulate, pulse).
- **Engine:** `lib/agent` → tools → frozen engines. Fallback: `lib/command` router.
- **State:** Idle / interpreting / running / waiting for approval / complete / failed / cancelled.
- **Related:** Every engine, never as owner of truth.
- **IA:** **Keep** as first-level.

Current UI: still reads as Q&A over engines. Agent trace exists after PR #15 but sits inside article cards. Must become an operating console, not ChatGPT.

### Timeline — `/timeline`

- **User question:** What changed? What is coming?
- **Primary information:** Event Layer stream. Past / Now / Future.
- **Primary action:** Open an event / related situation.
- **Engine:** `lib/events`, `lib/engine/timeline`.
- **IA:** **Keep** first-level.

### Causal explorer — `/explore`

- **User question:** Why is this connected?
- **Primary information:** Atlas Supply → SH-204 → RK-7 → Orders A/B/C → customers / cash.
- **Primary action:** Select a node. Open impact.
- **Engine:** `lib/engine/causal`, Graph, Impact.
- **IA:** **Contextualize** into Risk / Why.

### Impact — `/impact/:exceptionId`

- **User question:** How much is connected?
- **Primary information:** 3 orders, 3 customers, 850,000 associated, 540,000 cash timing. Not a loss.
- **Engine:** `lib/engine/impact`.
- **IA:** **Merge** into Risk / Why.

### Warnings — `/warnings`, `/warnings/:id`

- **User question:** What may go wrong that has not failed yet?
- **Primary information:** Buffer math. AT RISK — NOT MISSED.
- **Primary action:** Why? / Simulate.
- **Engine:** `lib/warnings`.
- **IA:** **Contextualize**. After cascade, warning is a layer on the NEEDS YOU object.

### Exceptions — `/exceptions/:id`, `/exceptions/:id/plan`

- **User question:** What already diverged? What may I approve?
- **Primary information:** Evidence, impact, recovery plan, policy outcomes.
- **Primary action:** Approve & execute allowed actions.
- **Engine:** Detect, Policy, Execute, Verification.
- **IA:** **Contextualize** from Pulse / Goals.

### Simulate — `/simulate`

- **User question:** What if Atlas is another 3 days late?
- **Primary information:** BASELINE vs SIMULATED vs DELTA. Isolation hash unchanged.
- **Authoritative delta:** +3 days on SH-204 moves **160,000 DZD Invoice C** cash timing into the next period (`tests/simulation.test.ts`). Do not show 540K as the simulation movement.
- **Engine:** `lib/simulation`. Never writes live state.
- **IA:** **Contextualize**. Visual language defined now; not a master screen in this pass.

### Goals — `/goals`, `/goals/:id`

- **User question:** What are we protecting? What is the plan?
- **Primary information:** Goal + structured plan + policy buckets (AUTO / APPROVAL / BLOCKED).
- **Primary action:** Generate plan. Execute safe. Approve remaining.
- **Engine:** `lib/goals`.
- **IA:** **Keep** first-level.

### Graph — `/graph`

- **User question:** What depends on what?
- **Engine:** `lib/graph`.
- **IA:** **Business**.

### Autopilot — `/autopilot`, `/autopilot/:id`

- **User question:** Why did you classify this this way?
- **Primary information:** Observed → Detected → Impact → Plan → Policy → Action → Verification. No chain-of-thought.
- **Engine:** `lib/autopilot`.
- **IA:** **Contextualize**. Autopilot is a classification, not a room.

---

## Product / data notes (do not rewrite engines)

1. After `triggerSupplierDelay`, Order A warning + cascade exception collapse to **one** `NEEDS_YOU` card. A Pulse MONITORING row for the same Order A would be a duplicate. Show the buffer on that card and on Risk / Why.
2. Cold-start seed (no delay) is 320K `NEEDS_APPROVAL` and a Monday shipment still expected. The master Pulse designs the **jury WOW state**: delay already observed, 320K still awaiting a human.
3. 10% exists only after the later discount message. It is a **BLOCKED** situation, not a Pulse KPI.
4. Warning list math after delay: available minutes from Wednesday 09:00 to Tuesday 10:00 = **−23h**; required processing+prep+transport = **18h**; shortfall **−41h**.
5. 850,000 DZD is the sum of Orders A/B/C (320+280+250). 540,000 DZD is Invoices A+B+C (200+180+160). Neither is a loss forecast.
6. Simulation +3 days moves Invoice C **160,000 DZD** timing, not the 540K associated cash headline.

---

## Current visual system (as shipped)

- Dark canvas `#080a0d`, paper `#efe7d6`, sand `#c8b896`, amber `#f0a202`
- Instrument Serif display, IBM Plex Sans body, IBM Plex Mono data
- Top pill navigation (9 destinations)
- Demo bar under header
- Heavy `rounded-2xl` cards, full-pill buttons
- No icon library beyond text/CSS
- Desktop-first; some `sm`/`md` grids; no dedicated mobile IA

Aurora replaces the *chrome*, not the *product*.
