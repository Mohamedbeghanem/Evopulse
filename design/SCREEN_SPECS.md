# Aurora screen specs

Contract for the three master screens. Implementation target: standalone HTML now; production React later (not this pass).

Base: PR #15 `9eda574` (stacked on PR #14). Clock: **Sun 27 Sep 2026 · 08:18 Africa/Tunis**.

Shared chrome is identical on every master screen.

---

## Shared chrome

### Canvas
- `#0A0C10` full viewport
- No page background image
- No browser chrome in the product

### Sidebar — 220 × 100vh
- Padding 20 / 16
- Wordmark: `EVOPULSE` · label · `--aurora-primary`
- Nav items, 36px tall, 8px radius, 12px gap after wordmark
- Order: **Pulse · Command · Timeline · Business · Goals**
- Active: 2px primary leading edge, ink text
- Idle: muted
- Footer pinned: `Nothing falls through.` · small · muted
- Do not list Warnings, Exceptions, Autopilot, Simulate, Graph, Explore

### Header — remaining width × 56
- Hairline bottom
- Left: `Sun 27 Sep 2026 · 08:18 Africa/Tunis` · small mono
- Right (optional): `LIVE` mute pill is **not** used — clock is enough
- No global search on Pulse / Risk

### Content
- Gutter 32 (1440) / 24 (1280) / 16 (1024)
- Max width 1120, left-aligned in the remaining pane (not optically centered as a marketing column)
- Section gap 32

### Breakpoints
| Width | Behavior |
| --- | --- |
| 1440 | Canonical. Sidebar visible. |
| 1280 | Sidebar 200. Gutter 24. Metrics may drop to 22px. |
| 1024 | Sidebar 64 icon-rail **or** collapsed under a “Menu” control. Content single column. No horizontal scroll. Situation actions wrap. |

This pass prototypes 1440 as default CSS, with `@media` for 1280 and 1024.

---

## Master 1 — Pulse

**Route (future):** `/`  
**File:** `design/html/pulse.html`  
**Question:** What needs my attention?

### Intent
Not a KPI dashboard. Not twin-domain tiles. One situation, one object.

### Grid
```
[ sidebar 220 ] [ header 56
                  page
                    display
                    census (one line)
                    NEEDS YOU (stack)
                    MONITORING (stack)
                    RECENTLY HANDLED (disclosure)
                ]
```

No 3-column metric tiles at the top.

### Typography
- Display: `Your business is running.`
- Census: body / muted — `2 need you · 2 monitoring · 3 handled automatically`
- Section titles: `NEEDS YOU` / `MONITORING` / `RECENTLY HANDLED`

### Exact data — WOW demo (delay observed, 320K still open)

**Needs you (2)**

1. **Atlas Supply · Shipment SH-204** — selected by default  
   - Badge: `NEEDS YOU`  
   - Layer: `AT RISK — NOT MISSED`  
   - Cause: `Monday → Wednesday`  
   - Observed: `Atlas Supply revised Shipment SH-204.`  
   - Impact: `3 orders · 3 customers`  
   - Metrics: `850,000 DZD` associated revenue · `540,000 DZD` expected cash timing  
   - Buffer: Available `−23h` · Required `18h` · Shortfall `−41h`  
   - Actions: **Review** (primary) · **Simulate** (secondary)  
   - Do not also render Order A as a second card.

2. **Atlas Q4 warehouse fit-out**  
   - Badge: `NEEDS APPROVAL`  
   - Metric: `320,000 DZD`  
   - Why human: `Revised proposal is ready. Customer-facing messages require a human.`  
   - Policy: `external_message_requires_approval`  
   - Caption: `EvoPulse cannot approve itself.`  
   - Action: **Review & Approve**  
   - Do not duplicate as Exception + Autopilot cards.

**Monitoring (2)**

1. **Expected cash — week of 28 Sep**  
   - `MONITORING` · `540,000 DZD` timing still in this week  
   - Note: associated cash headline, not a miss.

2. **Order B — Constantine Clinic**  
   - `MONITORING` · delivery `Fri 2 Oct 17:00` · amount `280,000 DZD`  
   - Shares RK-7 / SH-204 but still has calendar buffer. Not the primary attention object.

**Recently handled (3)** — collapsed by default

1. Supplier delay classified — SH-204 Monday → Wednesday  
2. Impact computed — 3 orders · 850,000 DZD associated  
3. Warning recorded — Order A AT RISK — NOT MISSED  

These are engine outcomes, not fake “AI resolved your business.”

### Component dimensions
- Situation row: padding 20, radius 12, hairline, min-height ~120 (needs you) / 72 (monitoring)
- Selected: `SURFACE` fill + 2px primary left edge
- Hover: `SURFACE_SECONDARY`
- Primary button 36 × auto, pad 12/16
- Buffer trio: three mono metrics in one row, 12 gap

### Interactions
| Action | Result |
| --- | --- |
| Hover situation | Surface-2, cursor pointer |
| Click situation | Selects. Only one selected. |
| Review | Opens Risk / Why for SH-204 (`risk-why.html`) |
| Simulate | Opens simulation preview drawer (not live) |
| Review & Approve | Jumps to Command approval composition (`command.html#approve`) |
| Handled disclosure | Expands the three engine outcomes |

### Responsive
- 1280: buffer trio stays one row
- 1024: impact metrics stack; actions full-width wrap

### Anti-patterns
- No sparkline, no donut, no “revenue this month”
- No 850K labeled lost / at-risk cash as a loss
- No five engine-layer cards

---

## Master 2 — Command

**Route (future):** `/command`  
**File:** `design/html/command.html`  
**Question:** What should happen next? (also: ask anything)

### Intent
An operating console. Not ChatGPT. The signature is a **live business operation trace**.

### Grid
```
[ sidebar ] [ header
              page title “Ask EvoPulse”
              command input 48
              suggested commands (wrap chips, 8 radius — not pills)
              run column (max 720) + optional approval rail (400)
            ]
```

Idle: input + suggestions. After run: trace replaces the empty state.

### Suggested commands (exact)
- What changed today?
- What needs me?
- What am I about to miss?
- Why is 850K at risk?
- What if Atlas is another 3 days late?
- Protect everything at risk this week.
- Fix everything you're authorized to fix.

### Signature run — `Protect everything at risk this week.`

User line (right-aligned, no bubble chrome — a quiet row):

`Protect everything at risk this week.`

Then steps, each with a business verb (never `tool_call`):

| Step | Title | Body |
| --- | --- | --- |
| 1 | Inspecting business | 2 situations require attention |
| 2 | Tracing dependencies | Atlas Supply → SH-204 → RK-7 → Orders A / B / C |
| 3 | Assessing impact | 850,000 DZD associated revenue · 540,000 DZD cash timing |
| 4 | Simulating options | Scenario prepared · not live |
| 5 | Building plan | Protect cascade + recover 320,000 DZD proposal |
| 6 | Checking policy | 1 safe · 3 approval · 1 blocked |
| 7 | Executing safe action | Internal classification persisted |
| 8 | Verifying | Safe step verified — not HANDLED for the situation |
| 9 | Waiting for you | 3 approvals |

Agent states used: INTERPRETING → INSPECTING → SIMULATING → PLANNING → CHECKING POLICY → EXECUTING → VERIFYING → WAITING FOR APPROVAL

### Approval panel (governance, not interruption)

**What EvoPulse wants to do**  
Send the revised 320,000 DZD proposal to Atlas Retail.

**Why**  
Opportunity is open. Friday decision depends on the revised proposal. External messages are not autonomous.

**Impact**  
320,000 DZD recovery / close path. Not a cascade loss figure.

**Policy**  
`external_message_requires_approval = true`

**Evidence**  
Observed: opportunity still open · Source: seed / customer conversation · Calculated: Autopilot NEEDS_APPROVAL · Assumption: human is accountable for outbound copy

Actions: **Approve** · **Edit** · **Reject**  
Caption: **EvoPulse cannot approve itself.**

### Policy block (same run, secondary)

```
ACTION BLOCKED BY POLICY

Requested                 10%
Allowed without exception  5%
Alternative                5% + Net-14
```

This is proof of governance, not a system error. No red toast.

### Interactions
| Action | Result |
| --- | --- |
| Click suggested “Protect everything…” | Deterministic staged trace (420ms / step; reduced-motion = instant) |
| Other suggestions | Fill the input; Protect is the fully staged prototype |
| Approve / Edit / Reject | Local prototype state only (Approved / Editing / Rejected). No backend. |

### Anti-patterns
- No avatar circle
- No markdown essay as the answer
- No JSON / `function result` in the primary column
- No “DeepSeek is thinking”

---

## Master 3 — Risk / Why

**Route (future):** contextual from Pulse Review (today `/warnings/:id` + `/impact/:id` + `/explore`)  
**File:** `design/html/risk-why.html`  
**Question:** Why is this at risk?

### Intent
One combined detail: warning + causal path + impact + evidence. Not four pages.

### Grid
```
[ sidebar ] [ header
              kicker AT RISK — NOT MISSED
              title Order A delivery
              buffer trio
              two columns:
                left 60%  causal path
                right 40% impact + evidence
              footer actions: Simulate
            ]
```

### Exact data

**Title**  
`Order A delivery`  
`AT RISK — NOT MISSED`  
`Deliver Order A to Oran Fresh Tuesday` · deadline `Tue 29 Sep 10:00`

**Time buffer**
| Field | Value | Source |
| --- | --- | --- |
| Available | `−23h` | Wednesday 09:00 → Tuesday 10:00 |
| Required | `18h` | 360 + 240 + 480 minutes |
| Shortfall | `−41h` | available − required |

State word: **AT RISK**, not **MISSED**. Tuesday has not passed.

**Causal path** (selectable nodes)
1. Atlas Supply  
2. Shipment SH-204  
3. Pallet racking kit RK-7  
4. Orders A / B / C  
5. Oran Fresh · Constantine Clinic · Sétif Depot  

Default selected: Shipment SH-204.

**Impact**
- 3 orders  
- 3 customers  
- 850,000 DZD associated revenue  
- 540,000 DZD expected cash timing  

Never “lost 850K.”

**Evidence (disclosed)**
| Kind | Statement |
| --- | --- |
| Observed | Atlas Supply: “Your shipment will arrive Wednesday instead of Monday.” |
| Source | Supplier message · Sun 27 Sep 2026 · 09:13 Africa/Tunis |
| Calculated | Buffer −23h / 18h / −41h · AT_RISK |
| Assumption | Downstream durations: processing 6h, preparation 4h, transport 8h |

**Simulate CTA**  
Opens the simulation preview:

```
SIMULATION · NOT LIVE BUSINESS STATE
What if Atlas is another 3 days late?

CURRENT                    SIMULATED                 DELTA
Invoice C in week of 28 Sep  Invoice C next period    160,000 DZD timing
Isolation hash unchanged
```

Do not show 540K as the moved figure.

### Interactions
| Action | Result |
| --- | --- |
| Select path node | Detail line updates (entity + relationship) |
| Evidence disclosure | Opens the four-field table |
| Simulate | Opens preview drawer |
| Back | Pulse |

### Anti-patterns
- No force-directed graph toy
- No separate Warning card + Exception card + Impact card
- No chain-of-thought

---

## Status semantics (all three)

| Token | Pulse | Command | Risk |
| --- | --- | --- | --- |
| Attention | Needs you / approval | Waiting for you | At risk |
| Success | Recently handled | Verified safe step | — |
| Critical | — | Policy block | — |
| Simulation | Simulate drawer | “Scenario prepared” | Simulate drawer |
| Muted | Monitoring | Idle suggestions | Unselected path nodes |

---

## Accessibility contract

- Contrast: ink on canvas ≥ 12:1; muted on canvas ≥ 4.5:1 for 12px; primary on canvas for large text
- Focus: 2px `--aurora-focus` offset 2px. Never `outline: none` without replacement
- Buttons are `<button>`. Suggestions are `<button>`
- Status always includes a text label
- `aria-live="polite"` on the agent trace
- Keyboard: Tab through nav, situations, actions; Enter selects; Esc closes drawers
- Target size ≥ 32px
- No information by color alone (buffer uses words Available / Required / Shortfall)

---

## Data authority

If HTML and an engine test disagree, the **engine test wins**. Known authoritative figures:

- Associated revenue 850,000 (320+280+250)
- Cash timing 540,000 (200+180+160)
- Buffer after delay: −23h / 18h / −41h
- Simulation +3d: Invoice C 160,000 timing — not 540,000
- 320,000 is the proposal / recovery, not cascade loss
