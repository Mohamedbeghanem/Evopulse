# 03 — Timeline

## SCREEN

Timeline. The business Time Machine.

Not a calendar. Not an activity feed. A tape of what was supposed to happen against what did, with one attention object at NOW.

## USER QUESTION

HOW DID WE GET HERE AND WHAT HAPPENS NEXT?

## PURPOSE

Make time a first-class control surface.

Model: **PAST → NOW → EXPECTED FUTURE**.

Every mark on the tape is one of:

| Kind | Meaning |
| --- | --- |
| **EXPECTED** | What the twin believed would happen |
| **OBSERVED** | What actually entered the event stream |
| **DETECTED** | Engine found divergence (miss, block, exception) |
| **PLANNED** | Recovery proposed. Not done. |
| **EXECUTED** | An action ran. Not the same as resolved. |
| **VERIFIED** | Outcome confirmed. Send ≠ solved. |

Pulse answers *what needs you*. Timeline answers *how we arrived, and what is still expected*.

## ROUTE / FUTURE ROUTE

Target: `/timeline`

Production today: `/timeline` + `GET /api/timeline`.

Future Control OS: same route. Inspector for objects. Situation page for the NOW attention object (`/situations/:id` → today’s `/exceptions/:id`).

## PRIMARY OBJECT

One **Situation** at NOW — the Atlas 320,000 DZD missed proposal — plus the Event / Expectation that explains each mark on the tape.

One situation = one top-level attention object.

## PRIMARY ACTION

**Review recovery** — open the 320K situation / planned recovery.

## SECONDARY ACTIONS

- Filter the tape by kind (EXPECTED · OBSERVED · DETECTED · PLANNED · EXECUTED · VERIFIED)
- Jump to NOW
- Inspect a mark (source, quote, expected vs observed, confidence)
- Ask EvoPulse about this… (one command, not a chat)
- Open a clearly labeled SIMULATION (not mixed with LIVE)

## DATA SOURCES

Authoritative repo data only. Seeded clock: **Sunday 27 Sep 2026, 08:18 Africa/Tunis** (`DEMO_NOW_ISO`). `demo_phase=seeded`. `supplier_phase=stable`.

| Source | Use |
| --- | --- |
| `lib/clock.ts` | Demo now, proposal due, decision due, SH-204, checkpoint, cash week |
| `lib/seed.ts` | Atlas Retail / Amine Khelifi / 320K proposal miss |
| `lib/engine/extract.ts` | Quote: *Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.* |
| `lib/engine/timeline.ts` | PAST / NOW / FUTURE lanes |
| `lib/engine/seed-graph.ts` | SH-204 Monday, Order A/B/C, invoices, 540K cash week |
| `lib/engine/recovery.ts` | Planned recovery (not executed) |
| `lib/engine/execute.ts` + `lib/learning/verification.ts` | After execute → MONITORING, verification pending |
| `lib/simulation/` + `tests/simulation.test.ts` | +3-day SH-204 SIMULATION numbers |
| `GET /api/timeline` | Future production bind |

**Do not invent amounts, dates, customers, or statuses.**

## ENGINE OWNERS

`lib/engine/timeline.ts` · `lib/events/` · clock (`lib/clock.ts`) · expectations (`lib/engine/expectations.ts`) · matcher / detect · verification (`lib/learning/verification.ts`). Simulation numbers belong to `lib/simulation/` and must stay labeled SIMULATION.

## STATES

| State | What the operator sees |
| --- | --- |
| **LIVE · seeded** (primary) | NOW = 320K NEEDS YOU. Recovery PLANNED. Nothing EXECUTED. Nothing VERIFIED. SH-204 still EXPECTED Monday. |
| **After execute** | Actions EXECUTED. Situation = MONITORING (verification pending). Not HANDLED. |
| **Empty** | “Nothing on the tape for this scope.” |
| **Loading** | Three quiet lane labels. No animated clock. |
| **Error** | “Timeline could not be read.” Pulse remains reachable. |

Situation attention on a mark: **NEEDS YOU · NEEDS APPROVAL · MONITORING · BLOCKED · HANDLED**. Secondary: **AT RISK — NOT MISSED**.

## EMPTY/LOADING/ERROR

- **Empty:** “Nothing on the tape for this scope.” Composer: `Show me what changed today.`
- **Loading:** PAST / NOW / EXPECTED FUTURE labels only. No spinner clock.
- **Error:** “Timeline could not be read.” Keep Pulse reachable.

Prototype review can switch these from the footer. The footer is a design control, not a product surface.

## INSPECTOR BEHAVIOR

Closed by default. Click a mark → Inspector (360px; overlay at 1024).

Shows: kind, clock, object, expected vs observed, source, quote, confidence, attention, related objects.

Click the NOW situation title → full Situation (not the inspector). Escape / × closes Inspector.

## RELATED SCREENS

01 Pulse · 04 Situation · 05 Risk · 07 Causal · 08 Simulation · 09 Goals · 12 Approval · 13 Twin · 18 Evidence · 19 Verification.

## COMMANDS THAT CAN OPEN IT

- `Open Timeline`
- `How did we get here?`
- `What happens next?`
- `Show me what changed today.`
- `What changed since Wednesday?`
- `What happens next for Atlas?`

## LEGACY REFERENCES USED

- `design/references/legacy-html/03-time-machine.html` — PAST / NOW / FUTURE tape, NOW as rare orange, “What happens next.” **Rejected:** 64px TWIN/CAUSE/TIME/ACT rail, invented SHP-2291 / 300K / cash-floor chart, activity-feed rows, decorative cash projection.
- `01-business-twin.html` — object identity, expected vs actual. Not copied as chrome.
- `02-causal-explorer.html` — click-to-inspect source / evidence / confidence. Not copied as a graph canvas.
- `04-goal-plan-action.html` — PLAN ≠ EXECUTE ≠ VERIFY. Used for the recovery strip.

Locked Control OS: `design/AURORA_TOKENS.css`, `design/CONTROL_OS_LAYOUT.md`, `design/CONTROL_OS_IA.md`, `design/AURORA_BRANDBOOK.md`, `design/screens/00-shell/`. This screen does not rewrite the shell or Inspector.

## FINANCIAL LANGUAGE

| Figure | Meaning | Source |
| --- | --- | --- |
| **320,000 DZD** | Associated revenue / proposal value of Atlas Q4 warehouse fit-out | Opportunity payload, impact |
| **540,000 DZD** | Expected cash timing (Invoice A 200,000 + B 180,000 + C 160,000) | Seed graph invoices |
| **850,000 DZD** | Associated revenue of Order A 320,000 + B 280,000 + C 250,000 (depends on SH-204) | Seed graph orders. Not the NOW situation while `supplier_phase=stable`. |

Never “lost revenue.” Never “missed cash” for a future invoice. AT RISK — NOT MISSED.

## SIMULATION SEPARATION

Default tape is **LIVE**.

`What if SH-204 is another 3 days late?` opens a hatched ice panel labeled **SIMULATION · NOT LIVE**, with an explicit **DELTA** column.

Verified against `tests/simulation.test.ts` on the **seeded** twin (delay not triggered):

- Baseline arrival: Monday 28 Sep 09:00
- Simulated arrival: Thursday 1 Oct 09:00
- Commitments missed (baseline): none
- DELTA customers: Oran Fresh Market
- Cash moved to next period: **0**

The **160,000 DZD Invoice C** move is from the *after supplier-delay* +3 run. It is **not** live seed. It must not appear as LIVE.

## KNOWN LIMITATIONS

- Prototype only. No `GET /api/timeline` bind. Numbers are copied from seed / tests, not live queries.
- Shell chrome is a local sketch of the locked Control OS. Do not treat this file as a new shell source of truth.
- Supplier delay (850K NEEDS YOU) is a second scenario, not the primary NOW.
- Image generation was not used; see `timeline-image-prompt.md`.
- Verified in Chrome at 1440 / 1280 / 1024. Screenshots: `/opt/cursor/artifacts/screenshots/timeline-*.png` and `design/screens/03-timeline/previews/` (local, not committed).
