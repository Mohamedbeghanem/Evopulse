# 13 — Business Twin

**Control OS screen.** Standalone prototype. Not production.

| Field | Value |
| --- | --- |
| **User question** | What does EvoPulse understand about my business? |
| **Screen id** | `13-business-twin` |
| **Prototype** | [`business-twin.html`](./business-twin.html) |
| **Evolves** | Pulse twin domain strip + `/graph` node dump + `lib/engine/twin.ts` + Causal Explorer Inspector |
| **Primary state** | Live Atlas twin after supplier delay **and** open 320K miss. Clock: Sun 27 Sep 2026 08:18 Africa/Tunis. `demo_phase=seeded`, `supplier_phase=delayed`. |
| **Primary action** | Inspect an object the twin already holds (domain, entity, commitment, expectation, event, goal). Inspector is the locked Control OS pane. |
| **Secondary actions** | Open Pulse for NEEDS YOU items · Open SH-204 impact reading · Ask Command a grounded question · Open the seeded September goal |
| **Not this screen** | CRM records · entity admin table · graph toy · KPI dashboard · simulation · recovery approval |

---

## Contract

This screen answers one question: **what does EvoPulse already understand about Atlas?**

It is the live Business Twin. Software calculated the state from stored signals. AI may later explain the state; this prototype never invents a health score.

The twin is a **reading of structure**, not a list of accounts.

Represented here, and only from repo facts:

| Layer | What the operator sees |
| --- | --- |
| **Entities** | Atlas Retail Group, Amine Khelifi, Atlas Q4 warehouse fit-out, Atlas Supply, SH-204, RK-7, Orders A/B/C, Oran Fresh Market, Constantine Clinic, Sétif Depot, Invoices A/B/C, cash week of 28 Sep |
| **Relationships** | `supplies` → `contains` → `required_by` → `belongs_to` / `produces` → `expected_payment`. Sales chain: opportunity of / owned with / OUR send / THEIR decision / depends on |
| **Commitments** | OUR send revised 320,000 DZD proposal (missed) · THEIR Friday decision (blocked) · receive SH-204 Monday (at_risk) · deliver Order A Tuesday (at_risk) |
| **Expectations** | `quote.sent` MISSED · `customer.decision` BLOCKED · `shipment.arrived` AT_RISK · `order.delivered` AT_RISK |
| **Current state** | Five twin domains from `businessTwin()` |
| **Risk** | Two NEEDS YOU exceptions: missed commitment 320K · delivery delay SH-204 |
| **Goals** | Seeded `Protect September revenue` / close Atlas 320K · status **DRAFT** (schema default; not an outcome-engine ACTIVE goal) |
| **Events** | `message.received` · `commitment.created` · `commitment.missed` · `exception.created` · `shipment.delayed` · `dependency.cascade` |

Graph information **always** has a textual representation. The visual cascade may simplify at 1024; the reading does not disappear.

---

## Locked Aurora / Control OS

Do not redesign these. This file hosts them so the prototype is standalone.

- **Shell** — top bar (product, screen, clock, company, LIVE TWIN) + Control OS nav.
- **Inspector** — Source · Evidence · Timestamp · Confidence · Relationship · Value · Expected · Actual. Same job as `components/CausalExplorer.tsx` Inspector.
- **Tokens** — ink / paper / sand / mute / need / miss / ok / ice. Instrument Serif + IBM Plex Sans + IBM Plex Mono.

Simulation stays on the Simulate screen. This canvas is labeled **LIVE TWIN · not a simulation**.

---

## Canonical Atlas data (inspected, not invented)

Clock and quotes:

- Now: `2026-09-27T08:18:00+01:00` (Sunday 27 Sep)
- Amine, 23 Sep: *“Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.”*
- Atlas Supply, 27 Sep 09:13: *“Your shipment will arrive Wednesday instead of Monday.”*

Amounts are **stored entity sums**, not forecasts:

| Figure | Source | Meaning |
| --- | --- | --- |
| **320,000 DZD** | Opportunity + Order A | Associated. Causal certainty limited to this deal — not a forecast. |
| **280,000 DZD** | Order B — Constantine Clinic | Associated order amount |
| **250,000 DZD** | Order C — Sétif Depot | Associated order amount |
| **850,000 DZD** | 320 + 280 + 250 | Associated revenue on the SH-204 cascade. **Not lost.** |
| **200 / 180 / 160,000 DZD** | Invoices A / B / C | Expected payments |
| **540,000 DZD** | 200 + 180 + 160 | Expected cash timing, week of 28 Sep, due Fri 2 Oct. **Timing, not a cash loss.** |
| **+2 days** | Monday 28 Sep 09:00 → Wednesday 30 Sep 09:00 | Observed fact. Confidence 96%. |

Policy facts (shown only as constraints the twin knows, not as actions on this screen):

- `discount_max = 5%`
- `external_message_requires_approval = true`
- `financial_commitment_requires_approval = true`

---

## Statuses (canonical only)

**Exception attention:** `NEEDS_YOU` · `MONITORING` · `HANDLED` · `HEALTHY`

**Twin domain status** (`lib/engine/twin.ts`): `AT_RISK` · `ATTENTION` · `MONITORING` · `STABLE` · `HANDLED`

Primary-state domain strip (delayed + open sales miss):

| Domain | Status | Headline (from twin) |
| --- | --- | --- |
| SALES | ATTENTION | 320K commitment exception |
| OPERATIONS | AT_RISK | 1 critical dependency broken · 3 orders affected |
| CASH | MONITORING | 540,000 DZD expected cash timing affected |
| CUSTOMERS | ATTENTION | 3 customers affected |
| SUPPLIERS | AT_RISK | 1 shipment delayed · +2 days |

**Expectation:** `ON_TRACK` · `UPCOMING` · `AT_RISK` · `MISSED` · `FULFILLED` · `BLOCKED` · `CANCELLED`

**Commitment (seed):** `open` · `missed` · `blocked` · `at_risk`

**Goal:** `DRAFT` · `ACTIVE` · `AT_RISK` · `COMPLETED` · `CANCELLED` — seed goal is **DRAFT**

**Exception types:** `missed_commitment` · `delivery_delay`

No invented health scores, traffic-light grades, or “company health %”.

---

## Semantics gates

| Gate | Rule on this screen |
| --- | --- |
| **Attention** | NEEDS YOU is a count of open exceptions that need a human. It is not a KPI. Two items: 320K miss + SH-204 delay. Status is a word, never color alone. |
| **Financial** | 850K = associated revenue (graph sum of orders). 540K = expected cash timing (sum of invoices). 320K = associated opportunity. Never “lost”, “at risk $”, or “forecast”. Currency is DZD. |
| **Warning** | AT_RISK / ATTENTION / MISSED / BLOCKED carry a text label and a reason. Amber (`need`) is attention, red (`miss`) is a broken claim, ice is monitoring. |
| **Verification** | Inspector always shows source, quote, expected vs actual, timestamp, confidence, evidence kind (`OBSERVED_FACT` or `CALCULATED_IMPACT`). |
| **Simulation** | This is the live twin. No what-if deltas. Simulate is a different nav target. |

---

## Layout

| Width | Behavior |
| --- | --- |
| **1440** | Domain rail · understanding canvas · Inspector. Full cascade drawing + textual reading. |
| **1280** | Same three columns, tighter. Cascade still visible. |
| **1024** | Domain strip becomes horizontal. Visual cascade collapses to a short stack. **Textual reading stays.** Inspector docks under the canvas. |

---

## Interaction

1. Operator arrives on Twin. The opening sentence states what EvoPulse understands. SH-204 is pre-selected.
2. Selecting a domain or object updates the Inspector. Nothing is edited.
3. Primary action is inspect. Acting (approve, recover, simulate) leaves this screen.
4. Keyboard: Tab through objects. Enter/Space selects. Inspector is `aria-live="polite"`.

---

## Accessibility

- Graph has a heading + ordered textual reading (`#graph-reading`).
- Status never color-only: word + tone.
- Focus rings on all selectable objects.
- Skip link to the understanding canvas.
- Contrast on paper/sand over ink; need/miss used as accents, not the only signal.

---

## Anti-patterns (must stay NO)

| Pattern | Why it is forbidden here |
| --- | --- |
| CRM-like | No contact/account records, pipelines, or activity feeds as the point. |
| ERP-like | No order/invoice admin tables. Amounts appear only as graph facts. |
| Dashboard-like | No KPI tiles, charts, or “health”. |
| ChatGPT-clone | No chat composer as the main surface. Command is a secondary exit. |
| Card-disease | Five domains are a rail, not a card wall. One reading, one inspector. |
| Graph toy | No force-directed playground. Edges are named relationships you can read. |

---

## Files

| File | Role |
| --- | --- |
| `business-twin.html` | Standalone Aurora / Control OS prototype |
| `business-twin-image-prompt.md` | Still prompt if image gen is unavailable |
| `README.md` | This contract |

Owned directory only. No production, core-logic, or other-agent files.

---

## Verification

Browser-tested at 1440 / 1280 / 1024 (Chrome headless). Screenshots: `design/screens/13-business-twin/screenshots/` and `/opt/cursor/artifacts/screenshots/`.

Open `business-twin.html` at 1440 / 1280 / 1024. Confirm:

- Opening sentence names Atlas, 850K associated, 540K cash timing, 320K miss.
- Domain statuses match the table above.
- Selecting SH-204, Order B, and the 320K commitment updates Inspector with source + expected/actual.
- At 1024 the cascade drawing may hide; `#graph-reading` still lists every relationship.
- Footer/chrome says LIVE TWIN, not simulation.
