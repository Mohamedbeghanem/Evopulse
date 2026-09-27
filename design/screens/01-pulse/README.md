# Pulse

Standalone Control OS prototype. Not production. Does not call engines.

## SCREEN

Pulse — the first surface of EvoPulse Control OS. It answers one question and only that question.

## USER QUESTION

WHAT NEEDS MY ATTENTION?

## PURPOSE

Show the live Attention projection: what needs a human, what is being watched, and what was handled. Pulse is a calm control room, not a KPI dashboard. One situation is one top-level object.

Hierarchy on the canvas:

- Your business is running.
- X need you
- X monitoring
- X handled automatically

Sections: **NEEDS YOU** / **MONITORING** / **HANDLED**.

## ROUTE / FUTURE ROUTE

- Current product route: `/` (`app/page.tsx`)
- Future Control OS route: `/pulse`
- Prototype file: `design/screens/01-pulse/pulse.html`

## PRIMARY OBJECT

An **attention situation** — a single projected object from Pulse / Exception / Policy / Verification.

Canonical primary object (after `Trigger Supplier Delay` on the seeded miss):

- Atlas Supply · Shipment **SH-204** Monday → Wednesday (+2)
- Product **RK-7**
- 3 orders · 3 customers
- **850,000 DZD associated revenue** (320,000 + 280,000 + 250,000)
- **540,000 DZD expected cash timing** (200,000 + 180,000 + 160,000)

Second object in the same projection (not a duplicate card):

- Atlas Q4 warehouse fit-out · **320,000 DZD proposal value**
- Stored exception attention is `NEEDS_YOU`; plan status is `approval_required`
- Pulse **projects** it as **NEEDS APPROVAL**

## PRIMARY ACTION

Act on the selected situation.

- SH-204: **Open cascade** (future `/impact/exc_shipment_delay` or `/explore`)
- 320K recovery: **Review and approve recovery** (future `/exceptions/exc_proposal_missed/plan`)
- 10% policy: **Review policy-safe alternatives**

## SECONDARY ACTIONS

- Open the selected situation in **Timeline**
- Open **Command** (“What requires my attention?”)
- Small **Ask EvoPulse about this…** affordance in the Inspector (one grounded sentence, not a chat window)
- Change prototype state (seeded / recovered / blocked / empty / loading / error) — design-only

## DATA SOURCES

Read-only. Amounts, dates, names, and statuses come from the repository.

| Fact | Source |
| --- | --- |
| Attention enum `NEEDS_YOU` / `MONITORING` / `HANDLED` / `HEALTHY` | `lib/types.ts` |
| Pulse counts and headline | `lib/engine/pulse.ts` |
| Seeded miss + 320,000 DZD + Amine Khelifi + Atlas Retail Group | `lib/seed.ts` |
| SH-204, RK-7, 3 orders, 3 customers, 850k / 540k | `lib/engine/seed-graph.ts`, `tests/fixtures/atlas-supply.ts` |
| Associated revenue / expected cash timing (not lost) | `lib/engine/impact.ts` |
| Supplier delay exception | `lib/engine/supplier.ts` |
| Recovery plan + `APPROVAL_REQUIRED` | `lib/engine/recovery.ts`, `lib/engine/policy.ts` |
| Execution → `MONITORING` / `awaiting_verification` | `lib/engine/execute.ts`, `lib/learning/verification.ts` |
| Customer reply resolves miss to `HANDLED`; 10% is a new exception | `tests/loop.test.ts`, `lib/engine/ingest.ts` |
| Policy `discount_max=5%` BLOCKED | `lib/engine/policy.ts`, `lib/engine/ingest.ts` |
| Clock | `lib/clock.ts` (`Africa/Tunis`) |
| Canned Command question | `lib/prompts.ts` |

## ENGINE OWNERS

- **Pulse / Exception** — `lib/engine/pulse.ts`, `lib/engine/matcher.ts`
- **Impact** — `lib/engine/impact.ts` (factual graph sums)
- **Policy** — `lib/engine/policy.ts`
- **Recovery / Action** — `lib/engine/recovery.ts`, `lib/engine/execute.ts`
- **Verification** — `lib/learning/verification.ts`
- **Ask** — `lib/engine/ask.ts` (Inspector affordance only)
- **Twin** — `lib/engine/twin.ts` (not rendered as a KPI strip on Pulse)

## STATES

Attention **stored** on exceptions: `NEEDS_YOU` · `MONITORING` · `HANDLED` · `HEALTHY`.

Attention **projected** on Pulse (Control OS):

| Projection | When |
| --- | --- |
| **NEEDS YOU** | Human must decide. SH-204 delay is this. |
| **NEEDS APPROVAL** | Same situation as the 320K miss, because the recovery plan is already `approval_required`. Not a second object. |
| **BLOCKED** | Policy refused an action (`discount_max=5%` vs 10%). Governed autonomy, not an app error. |
| **MONITORING** | Action executed; verification `PENDING`. |
| **HANDLED** | Verification `SUCCESS`. |
| **AT RISK — NOT MISSED** | Secondary warning on SH-204. Deadline has not passed. Detect owns a miss only after the clock. |

Prototype view states (bottom bar):

| View | What it shows |
| --- | --- |
| Cascade + approval (**primary**) | SH-204 NEEDS YOU + 320K NEEDS APPROVAL. Clock 27 Sep 2026 09:14. |
| Cold start | Seed only: 320K NEEDS APPROVAL. Clock 08:18. Supplier still expected Monday — not an attention object. |
| Verification pending | 320K MONITORING. Execution ≠ resolution. |
| Policy blocked | 10% BLOCKED + original miss HANDLED. One situation for the discount. |
| Empty | 0 / 0 / 0. Quiet canvas. |
| Loading | “Listening for expected versus actual.” |
| Error | Read failure. No engine change. |

## EMPTY STATE

“Your business is running.” Tally is 0 / 0 / 0. Section copy: nothing needs you; nothing is being watched; nothing handled automatically.

## LOADING STATE

Clock reads “Reading clock…”. Banner: Pulse is listening for expected versus actual. No invented scores.

## ERROR STATE

Banner: Pulse could not read attention. Prototype only — engines are untouched.

## INSPECTOR BEHAVIOR

Locked Inspector pattern from Causal Explorer (`components/CausalExplorer.tsx`): source, evidence quote, expected, actual, timestamp, confidence, chain, value, affected objects.

- Selecting a row fills the Inspector. One situation only.
- Locked fields stay visible: source, expected, actual, timestamp, confidence, value.
- **Open cascade** / **Review and approve recovery** sit under the quote so the primary action is on screen.
- Chain, affected objects, and one-object notes sit behind **Show chain and objects**.
- At 1440 and 1280 the Inspector is a right column.
- At 1024 it overlays the canvas and can be dismissed (Close / Escape / overlay).
- **Ask EvoPulse about this…** reveals one grounded sentence from `lib/engine/ask.ts` / impact notes. It does not open a composer.

## RELATED SCREENS

| Screen | Relation |
| --- | --- |
| Command | Outcome utterances and canned “What requires my attention?” |
| Timeline | Past / Now / Future for the same objects |
| Business | Twin domains — not a Pulse KPI strip |
| Goals | Plans that address attention |
| Situation / Exception | Evidence + recovery for one object |
| Cascade / Explore | SH-204 cause → consequence |
| Simulation | What-if only. Never mixed into Pulse counts |

## COMMANDS THAT CAN OPEN IT

- “What requires my attention?”
- “What changed today?” / “What should I do?”
- Opening `/` or future `/pulse`
- After ingest, reset, supplier delay, or recovery — operator returns to Pulse

## LEGACY REFERENCES USED

- Current Pulse page `app/page.tsx` (attention, not charts)
- Causal Explorer Inspector `components/CausalExplorer.tsx`
- Impact page `app/impact/[exceptionId]/page.tsx` (850k / 540k language)
- Recovery plan `app/exceptions/[id]/plan/page.tsx`
- Aurora tokens from `tailwind.config.ts` and `app/globals.css` (ink / paper / sand / mute / need)
- Fonts from `app/layout.tsx`: Instrument Serif, IBM Plex Sans, IBM Plex Mono
- Control OS nav concept only: **PULSE · COMMAND · TIMELINE · BUSINESS · GOALS**. Explore / Simulate / Graph are not global nav.
- Reference HTML prototypes `01-business-twin.html`, `02-causal-explorer.html`, `03-time-machine.html`, `04-goal-plan-action.html` were **not present** in this repository at build time.

## KNOWN LIMITATIONS

- Prototype only. No backend, no `lib/` writes, no live SQLite.
- `NEEDS_APPROVAL` and `BLOCKED` are a **Pulse projection**. Stored exception attention for those rows is still `NEEDS_YOU` (`lib/types.ts`). Feature freeze: not implemented in production.
- `HEALTHY` exists in the engine and is not a Pulse section (assignment sections are NEEDS YOU / MONITORING / HANDLED).
- Primary nav targets besides Pulse are placeholders owned by other screens.
- Mobbin was used for quiet-sidebar / focused-workspace / progressive-disclosure structure only. No vendor branding copied.
- Image generation was not used for the screen; see `pulse-image-prompt.md`.
- Ask copy is canned from engine strings. It does not call `/api/ask`.
- `ask.ts` currently cites “Wednesday Atlas message” for any NEEDS YOU item; Pulse uses the situation’s own evidence quote instead.
- DEMO.md still says Pulse flips to HANDLED on approve. Engines now set **MONITORING** until verification (`tests/loop.test.ts`). Prototype follows the engines.
