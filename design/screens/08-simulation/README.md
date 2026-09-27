# 08 — Simulation

Design-only. Standalone HTML. Does not write to the Business Twin.

Open [`simulation.html`](./simulation.html) from this folder. Chrome is the locked Control OS shell (sidebar + header + inspector). This screen does not redesign them.

```bash
python3 -m http.server 8768 --directory .
# http://127.0.0.1:8768/simulation.html
```

---

## SCREEN

Simulation. Read-only what-if on a detached graph slice.

The operator has entered a **simulation chamber**. The canvas must never look like Pulse, Timeline, or live business state.

## USER QUESTION

**What if?**

Primary command: `What if Atlas is another 3 days late?`

## ROUTE

Target: `/simulate` or `/situations/:id/simulate`

Production today: `/simulate` · `GET/POST /api/simulations`.

Simulation is a **contextual capability**, never a sidebar module. Do not add Simulate to Primary or Workspace nav.

## PURPOSE

Let the operator see **LIVE** vs **SIMULATION** vs **DELTA** before acting.

Nothing is written. A content-hash of every table is taken before and after to prove it (`lib/simulation/fingerprint.ts`).

This is not a forecast dashboard. It is one lever, one cloned slice, one comparison.

## PRIMARY OBJECT

A scenario: target entity + change + delta.

Primary scenario (authoritative after supplier delay):

| Field | Value | Source |
| --- | --- | --- |
| Type | `supplier_delay` | `lib/simulation/types.ts` |
| Target | Shipment SH-204 | `IDS.shipment` |
| Additional delay | **+3 days** | `tests/simulation.test.ts` |
| Live arrival | Wed 30 Sep 2026 09:00 | after `triggerSupplierDelay` |
| Simulated arrival | Sat 03 Oct 2026 09:00 | Wednesday + 3 |
| Shift | 3 days | `delta.shipmentShiftDays` |

## PRIMARY ACTION

**Run the scenario** currently in the composer (`RUN SIMULATION`).

Suggested command is prefilled: `What if Atlas is another 3 days late?`

## SECONDARY ACTIONS

- **Compare WHY paths** — follow real Business Graph edges from Atlas Supply to each consequence.
- **Protect affected orders** — hands off to Goals / Plan. Does not write from this screen.
- **Discard / EXIT SIMULATION** — leave without write. Reality fingerprint must match.

## DATA SOURCES

`lib/simulation/` snapshot of `lib/graph/`. Baseline and simulation use the same propagator (`propagate.ts`).

If HTML and an engine test disagree, the **engine test wins**.

## ENGINE OWNERS

`lib/simulation/engine.ts` · `propagate.ts` · `source.ts` · `fingerprint.ts`.

Policy is not applied until an Act is proposed. Simulation does not create exceptions, change attention, or move cash.

## STATES

| State | Workspace |
| --- | --- |
| Idle | Chamber open. Composer ready. Twin not cloned yet. |
| Running | “Simulating recovery” / cloning slice. Evidence closed. |
| Compared | LIVE / SIMULATION / DELTA visible. Isolation verified. |
| Failed | “Simulation did not run. The twin was not changed.” |
| Discarded | Chamber closed. Reality unchanged. Fingerprint match shown. |

Use `--aurora-simulation` (`#7FB2E0` ice) only as a quiet accent on the simulated world. Never green “success” for a worse delta.

## EMPTY STATE

Composer prompt: “What happens if…”

Suggested: `What if Atlas is another 3 days late?`

## ERROR STATE

“Simulation did not run. The twin was not changed.”

## LOADING STATE

Agent trace step “Simulating recovery” with Evidence closed. No live Pulse cards.

## RELATED SCREENS

06 Situation · 07 Causal · 09 Goals · 02 Command · 03 Timeline · 13 Graph.

Time Machine ideas evolved here (not copied):

- PAST / NOW / FUTURE becomes **LIVE / SIMULATION / DELTA**.
- “What happens next” becomes **what would happen if**.
- The cash-position chart from `03-time-machine.html` is **refused** (dashboard theater, non-canonical 540K move).

## INSPECTOR BEHAVIOR

Locked inspector chrome. Content for this screen only:

- Scenario lever (SH-204 +3)
- Delta objects (orders, cash **timing**)
- Isolation proof
- Selected WHY path

Workspace mode: **CANVAS** (baseline vs sim vs delta). Inspector lists objects; it does not become a second dashboard.

## COMMANDS THAT OPEN IT

- `Open Simulation`
- `Simulate another 3 day delay`
- `What if Atlas is another 3 days late?`
- `What happens if Atlas is another 3 days late?`

---

## VISUAL CONTRACT — LIVE vs SIMULATION vs DELTA

These three worlds must be unmistakable without relying on color alone.

| World | Word | Surface | Border | Meaning |
| --- | --- | --- | --- | --- |
| **LIVE** | REALITY | Recessed `#0A0D11` | Solid hairline | The Twin as it is. Wednesday arrival. |
| **SIMULATION** | NOT REAL | Ice wash `rgba(127,178,224,0.08)` | Dashed ice | Clone only. Saturday arrival. |
| **DELTA** | IF THIS RUNS | Watch wash `rgba(240,180,76,0.10)` | Solid watch | What changes. Never “success.” |

Rules:

- A persistent banner: `SIMULATION · NOT LIVE BUSINESS STATE`.
- LIVE column never uses ice. SIMULATION column never uses orange attention as its identity.
- Delta never uses `--aurora-success` / green. A worse cash-timing move is watch/attention, labeled in words.
- Isolation line is always visible after a run: `Isolation verified · twin fingerprint unchanged`.
- Discarding returns the operator to live language. The Saturday arrival must disappear.

---

## CANONICAL DATA (verified 2026-09-27)

Anchor: SH-204 already delayed Monday → Wednesday. Scenario adds **another 3 days**.

### Headline (engine)

```
+2 commitments missed
+1 customer deadline affected
160,000 DZD cash moves into next period
```

`PLAN.md` §9 once said “540K cash moves into next period.” That is **not** current repository behavior. The test wins.

### LIVE (baseline, after supplier delay)

| Fact | Value |
| --- | --- |
| SH-204 arrives | Wed 30 Sep 2026 09:00 |
| Commitments missed | 1 — Deliver Order A to Oran Fresh Tuesday |
| Orders late | Order A — Oran Fresh (`320,000 DZD`) |
| Customer deadlines affected | Oran Fresh Market |
| Revenue on late orders | `320,000 DZD` |
| Cash this period | `540,000 DZD` (Invoices A 200K + B 180K + C 160K) |
| Associated revenue on the cascade | `850,000 DZD` (320 + 280 + 250) — **not lost** |
| Attention on the live cascade | `NEEDS_YOU` (unchanged by simulation) |

### SIMULATION (Wednesday + 3 → Saturday)

| Fact | Value |
| --- | --- |
| SH-204 arrives | Sat 03 Oct 2026 09:00 |
| Commitments missed | 3 — Order A delivery, Receive SH-204 Monday, Deliver Order B |
| Orders late | Order A + Order B — Constantine Clinic (`280,000 DZD`) |
| Customer deadlines newly affected | Constantine Clinic |
| Order C — Sétif Depot | Moves 3 days · **still inside** Mon 06 Oct deadline (slack) |
| Revenue on late orders | `600,000 DZD` |
| Cash this period | `380,000 DZD` |
| Invoice C cash expected | Mon 05 Oct 09:00 — **out of** week ending Sun 04 Oct 23:59 |

### DELTA

| Change | Value | Language |
| --- | --- | --- |
| Shipment shift | +3 days | Arrival timing |
| Commitments missed | +2 | Newly missed |
| Customer deadlines | +1 Constantine Clinic | Deadline affected |
| Revenue on late orders | +280,000 DZD | Order B now late — **not** “lost 850K” |
| Cash timing | **160,000 DZD** Invoice C | **Moves into next period** — not lost revenue |
| Isolation | unchanged | Reality not written |

850,000 DZD remains **associated revenue** on the three-order cascade. Simulation does not delete orders.

---

## ATTENTION / STATUS / WARNING / VERIFICATION

Canonical only. No invented scores or probabilities.

| Token | On this screen |
| --- | --- |
| `NEEDS_YOU` | Live cascade attention. Simulation does not change it. |
| `MONITORING` | Live cash week still in period in baseline. |
| `AT_RISK` | Live Order A delivery — already late vs Tuesday. |
| `ON_TRACK` | Order C still meets Mon 06 Oct in the simulation. |
| `MISSED` | Only for commitments the propagator marks `late`. |
| `HANDLED` | Never from a simulation run. |
| `BLOCKED` | Not used here (policy is later). |

Warning: Invoice C timing is a **cash-period classification**, not a miss of the 850K associated revenue.

Verification: isolation fingerprint before === after. Shown as `Isolation verified`. Failure would be `WARNING · REAL STATE CHANGED` — this prototype never produces that path because it never writes.

---

## FINANCIAL LANGUAGE (locked)

Allowed:

- `850,000 DZD associated revenue`
- `540,000 DZD` expected cash **this period** (baseline)
- `160,000 DZD cash moves into next period`
- `Invoice C` timing
- `Revenue on late orders` (320K → 600K)

Forbidden:

- “Lost 850K”
- “Lost revenue” for Invoice C
- “540K cash moves into next period”
- Invented floor-breach / probability scores from the legacy Time Machine HTML

---

## LAYOUT

Workspace mode: **CANVAS** (Control OS). 24px gutter.

| Width | Behavior |
| --- | --- |
| **1440** | Sidebar 240. Inspector 360. Three worlds in one row. |
| **1280** | Sidebar 220. Inspector 320. Three worlds remain a row; type 13/12. |
| **1024** | Sidebar collapsible. Inspector overlays. Worlds stack. No horizontal scroll. |

Clock: **Sun 27 Sep 2026 · 08:18 Africa/Tunis**.

---

## ACCESSIBILITY

- Skip link to workspace
- Buttons are `<button>`. Command is a `<form>`
- Status always includes a text label (`LIVE`, `NOT REAL`, `IF THIS RUNS`)
- Focus: 2px `#FF7A45` offset. Never `outline: none` without a replacement
- `aria-live="polite"` on run / discard results
- Contrast: ink `#E8ECF1` on `#07090C`; muted `#7C8796` only for 11px+ labels
- Target size ≥ 32px
- `prefers-reduced-motion`: no staged delay
- Esc discards / closes inspector overlay at 1024

---

## ANTI-PATTERNS

- No charts, sparklines, donuts, cash-floor graphs
- No CRM pipeline / ERP ledger chrome
- No ChatGPT transcript as the answer
- No stack of generic metric cards
- No Simulate item in the sidebar
- No rewriting the locked shell or inspector chrome
- No production edits outside `design/screens/08-simulation/`

---

## FILES

| File | Role |
| --- | --- |
| `simulation.html` | Reviewable prototype (1440 / 1280 / 1024) |
| `simulation-image-prompt.md` | Still frame if image generation is unavailable |
| `README.md` | This contract |
