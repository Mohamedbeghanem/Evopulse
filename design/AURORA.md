# Aurora design system

Aurora is the first light of business awareness — not a new engine, and not a new product.

It restyles the frozen intelligence loop so a human can see **one situation**, **one state**, and **one next action**.

## Laws (design must not break)

1. One business situation → one primary attention object.
2. Warning, impact, graph, plan, policy, Autopilot, and verification are **layers**, not competing cards.
3. 850,000 DZD is **associated revenue**. 540,000 DZD is **expected cash timing**. Never “lost” or “saved.”
4. Early Warning is **AT RISK / NOT MISSED** until Detect owns MISSED.
5. Execution is not HANDLED. Verification is.
6. The agent may inspect, simulate, plan, and request. A human Approves / Edits / Rejects.
7. Policy is evaluated at execution time. The UI may preview a decision; it may not bypass it.

## References (pattern only)

Taken from live products, then translated into EvoPulse language:

- [incident.io home](https://mobbin.com/screens/e187fff5-d4a3-4765-8170-7502e59ef299) — one primary incident, columns for Investigating / Monitoring / Fixing. Not three cards for the same outage.
- [incident.io incidents board](https://mobbin.com/screens/3dbd1be5-c425-47fb-b461-f0c464df48e7) — state columns, not competing tickets for one event.
- [Workable in-place approval](https://mobbin.com/screens/206a61d4-bf58-4bca-b9b6-8226d88ffc66) — reason + facts + Approve / Reject in place.

Do not copy their chrome. EvoPulse stays a dark control room.

## Tokens

Reuse the frozen product palette. Aurora tightens spacing and hierarchy; it does not invent a second brand.

| Token | Value | Use |
| --- | --- | --- |
| `ink-950` | `#080a0d` | Page |
| `ink-900` | `#0c1016` | Shell |
| `ink-800` | `#131922` | Card |
| `ink-700` | `#1b2330` | Elevated |
| `paper` | `#efe7d6` | Primary text / primary button |
| `sand` | `#c8b896` | Body |
| `mute` | `#8a8476` | Meta |
| `need` | `#f0a202` | Needs you / approval / pulse |
| `miss` | `#e85d4c` | Blocked |
| `ok` | `#3dba8b` | Handled / safe |
| `ice` | `#7eb6d9` | Monitoring / warning |

Type:

- Display: Instrument Serif
- UI: IBM Plex Sans
- Meta / state: IBM Plex Mono

Radius: 16px cards, 999px pills and primary actions.
Density: 8px grid. Approval frames are 1440×900. Section gap 20–24px. Card padding 16–18px.

## Attention states (canonical)

Render Autopilot / attention projection. Do not re-derive state in the page.

| State | Color | Pulse section | Command |
| --- | --- | --- | --- |
| `BLOCKED` | miss | What needs me? | Policy gate, no execute |
| `NEEDS_YOU` | need | What needs me? | Judgment / take over |
| `NEEDS_APPROVAL` | need | What needs me? | Human Approve / Edit / Reject |
| `MONITORING` | ice | Watching | Trace only |
| `AUTO_HANDLED` | ok | Watching / handled history | Evidence of safe AUTO |
| `HANDLED` | ok | Handled | Closed; verification SUCCESS |

## Components

**Situation card** — one title, one classification, one money line (if any), layer chips, one primary action.

**Layer chips** — WARNING · EXCEPTION · IMPACT · GRAPH · PLAN · POLICY · AUTOPILOT · VERIFICATION. Chips explain. They do not spawn a second top-level card.

**Count rail** — four numbers only: Needs you · Approval · Monitoring · Handled. Counts come from the attention projection, never from warning + exception + decision addition.

**Agent trace** — product language, not tool IDs: Inspecting · Tracing · Simulating · Planning · Checking policy · Executing safe actions · Waiting for approval.

**Approval dock** — title, why, impact, policy, evidence, then Approve / Edit / Reject. Hidden model reasoning is never shown.

**Buffer meter** — available vs required hours. Caption must include “NOT MISSED” unless Detect has escalated.

## Voice

- “Requires attention.”
- “Associated revenue.”
- “Expected cash timing.”
- “AT RISK — not missed.”
- “Simulation — reality unchanged.”
- “Policy blocks this. Here is the allowed alternative.”

Forbidden: revenue saved, money lost, AI decided, automatically handled (when verification is still pending).
