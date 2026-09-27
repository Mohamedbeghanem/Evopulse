# 02 — Command Center

**AGENT_D · Control OS · Aurora (dark-first)**  
**Artifact:** `command.html` · **Prompt:** `command-image-prompt.md`  
**Production today:** `/command` (`app/command/page.tsx`) + `POST /api/goals` + `POST /api/ask`  
**This pass does not edit production.**

---

## SCREEN

Command. The operating console. Universal ask / search / operate surface.

This is the screen that answers: **what do I want EvoPulse to understand or do?**

It is not ChatGPT. It is not a developer console. It is not a chatbot page with business copy pasted into bubbles. The signature is a **live business operation trace** — inspect, trace, assess, simulate, plan, check policy, execute safe, verify, wait for approval — with **sources**, never hidden model chain-of-thought.

## USER QUESTION

What do I want EvoPulse to understand or do?

Secondary phrasings the same console answers:

- What can I ask, find, or do without walking six modules?
- What should happen next?
- What can you handle without me?

## ROUTE

Target: `/command` (full **FOCUSED** workspace) and the `⌘K` overlay (any screen).

Standalone design: open `command.html` via `file://` or any static server. Tokens are embedded so the file does not depend on `00-shell`.

## PURPOSE

Make the input part of navigation. Infer ASK, SEARCH, NAVIGATE, ACT.

The **primary demonstration** is an outcome command:

> Protect everything at risk this week.

That utterance creates a Goal (`protect_business` / `this_week`) and a structured Plan. It does not return a chat essay. AI may interpret language. Software owns deadlines, policy, and state. Humans approve anything that leaves the building.

## PRIMARY OBJECT

**One situation = one attention object.**

After the Protect command, the object is:

**Protect this week's business** — not a thread, not two cards, not a KPI wall.

Inside that one object live two observed threats (they are facts, not sibling attention objects):

1. Atlas Supply · SH-204 delayed Monday → Wednesday (+2)
2. Atlas Retail · 320,000 DZD proposal missed Thursday; Friday decision blocked

850,000 DZD is **associated revenue** on the cascade. 320,000 DZD is the **approval / recovery path**. They must never be summed or swapped.

## PRIMARY STATE

**NEEDS YOU** at issue. After safe execution: **NEEDS APPROVAL**.

Never **HANDLED** from execution alone. `EXECUTION ≠ RESOLUTION`.

| State | When |
| --- | --- |
| Idle | Composer + suggested outcomes. No situation mounted. |
| Interpreting | Command accepted. Trace not yet written. |
| Operating | Trace steps appear. Situation is **NEEDS YOU**. |
| Safe executed | AUTO actions ran. Situation is **NEEDS APPROVAL**. Verification pending. |
| Approved (local) | Human recorded Approve on the 320K send. Still not HANDLED. |
| Blocked (shown) | 10% remains **BLOCKED**. Not an error toast. |

## PRIMARY ACTION

**Execute safe actions** — AUTO only.

From `lib/goals/execute-safe.ts`: prepare proposal, review affected orders, prioritize Order A, update cash expectation, finance checkpoint. Rechecks policy. Never sends a customer message. Never applies a discount.

## SECONDARY ACTIONS

| Action | Policy | Result |
| --- | --- | --- |
| Approve 320K send | `external_message_requires_approval` | Human records approval. EvoPulse cannot approve itself. |
| Review 5% (304,000 DZD) | `discount_max=5%` + financial approval | Stays **NEEDS APPROVAL**. |
| Hold / reject 10% | `discount_max=5%` | Already **BLOCKED**. No override. |
| Approve Net-14 | financial commitment | **NEEDS APPROVAL**. |
| Open evidence | — | Expands a trace step or Inspector Sources. |
| ⌘K / New command | — | Focuses the composer. |
| Suggested outcomes | — | Fill the field. Only Protect is fully staged. |

## ATTENTION SEMANTICS

Do not invent twenty statuses. Five operational states, labeled in type (color is reinforcement):

| State | Means | On this screen |
| --- | --- | --- |
| **NEEDS YOU** | A human decision or action is required now. | Situation at issue. |
| **NEEDS APPROVAL** | EvoPulse can act; policy requires a person. | 320K send, 5%, Net-14, delay notice. |
| **MONITORING** | Tracked. No human action yet. | 540,000 DZD cash timing. |
| **BLOCKED** | Policy or dependency forbids the recommended act. | 10% discount. |
| **HANDLED** | Closed. Remains on Timeline. | **Not reachable from this run.** Safe execute does not close the situation. |

Production today uses `NEEDS_YOU | MONITORING | HANDLED | HEALTHY` plus policy `APPROVAL_REQUIRED`. Control OS folds `HEALTHY` into the absence of attention, and `APPROVAL_REQUIRED` into **NEEDS APPROVAL**.

One situation stays one object when both the cascade and the 320K miss are in play.

## FINANCIAL SEMANTICS

Canonical figures (engine tests win if HTML disagrees):

| Figure | Meaning | Source |
| --- | --- | --- |
| **850,000 DZD** | Associated revenue on SH-204 (Order A 320 + B 280 + C 250) | `lib/goals/seed-risks.ts`, cascade tests |
| **540,000 DZD** | Expected cash timing (Invoice A 200 + B 180 + C 160) | same |
| **320,000 DZD** | Atlas Q4 proposal / approval / recovery path | PR #1 seed, `IDS.opportunity` |
| **304,000 DZD** | 5% policy-max alternative | `discount_max=5%` |
| **10%** | Requested concession | “I'll sign today if you give me 10%.” |
| **5%** | Policy ceiling | `policies.discount_max` |

Never label 850K “lost”, “at-risk cash”, or “needs approval”.  
Never label 320K as the cascade total.  
Never sum 850K + 320K. The 320K opportunity is Order A’s amount on the graph, already inside 850K.

## WARNING SEMANTICS

AT RISK — NOT MISSED. Sunday 27 Sep 2026 · 08:18. Order A is due Tuesday 29 Sep 10:00. The clock has not crossed that deadline. Impact is still recoverable.

Policy block is **governance**, not a system error. No red toast. No “failed” banner for `discount_max=5%`.

## VERIFICATION SEMANTICS

From `lib/learning/verification.ts` and `lib/goals/status.ts`:

- Action executed ≠ exception resolved ≠ goal completed.
- After a customer-facing prepare / draft, EvoPulse creates a verification: **customer.response within 24h**.
- SUCCESS requires the event. FAIL is the deadline passing.
- Goal stays **ACTIVE** after `executeSafeActions`. Plan generated ≠ goal achieved.

On this screen: after Execute safe, the trace ends on **VERIFYING** then **WAITING FOR APPROVAL**. The situation chip must not flip to HANDLED.

## SIMULATION SEPARATION

`lib/simulation/` clones a detached snapshot, applies a what-if (e.g. supplier +3 days), and proves isolation with a content hash. **Nothing is written to live state.**

The SIMULATING step is labeled:

```
SIMULATION · NOT LIVE BUSINESS STATE
Scenario prepared. Isolation hash unchanged.
```

Ice (`--aurora-auto`) marks machine / simulated work. Orange never appears on a simulation row.

## OPERATIONAL TRACE (visible, not CoT)

Business operations + evidence. Never `tool_call`, never “thinking…”, never JSON.

| # | Operation | Evidence shown |
| --- | --- | --- |
| 1 | Inspecting business | Twin domains. 2 situations require attention. |
| 2 | Tracing dependencies | Atlas Supply → SH-204 → RK-7 → Orders A / B / C → Oran Fresh · Constantine Clinic · Sétif Depot |
| 3 | Assessing impact | 850,000 DZD associated · 540,000 DZD cash timing · 3 orders · 3 customers |
| 4 | Simulating | Detached +3d scenario. Not live. |
| 5 | Building plan | Protect cascade + recover 320,000 DZD proposal. Catalog actions only. |
| 6 | Checking policy | 1+ safe · 3+ approval · 1 blocked (`discount_max=5%`) |
| 7 | Executing safe actions | AUTO only. No outbound send. |
| 8 | Verifying | Safe step verified. Situation not HANDLED. |
| 9 | Waiting for approval | 320K send + 5% + delay notice. |

Agent states used: INTERPRETING → INSPECTING → SIMULATING → PLANNING → CHECKING POLICY → EXECUTING → VERIFYING → WAITING FOR APPROVAL.

Each step expands to Sources. Sources are business objects, not web citations.

## DATA SOURCES

`POST /api/goals` (`utterance`, `plan: true`) · `lib/goals/interpret.ts` · `lib/goals/planner.ts` · `lib/goals/execute-safe.ts` · `lib/engine/policy.ts` · `lib/engine/ask.ts` · `lib/simulation/` · Pulse / Graph / Events.

Canned outcomes from `lib/prompts.ts`:

- Protect everything at risk this week.
- Protect this month's cash.
- Recover stalled opportunities.
- What requires my attention?
- What promises did we make customers?
- What is putting revenue at risk?

## ENGINE OWNERS

`lib/goals/` for ACT · `lib/engine/ask.ts` for ASK · `lib/simulation/` when intent is `/simulate` · `lib/engine/policy.ts` before any Act.

## EMPTY / ERROR / LOADING

| State | Chrome |
| --- | --- |
| Empty | Sentence + composer + suggested outcomes. No ghost chat. |
| Error | “EvoPulse could not ground that.” Offer Pulse. Never fabricate impact. |
| Loading | Trace steps, 420ms each (instant if `prefers-reduced-motion`). Not a raw spinner. |

## RELATED SCREENS

00 Shell overlay · 01 Pulse · 03 Timeline · 06 Situation · 08 Simulation · 09 Goals · 11 Approvals · 16 Evidence.

## INSPECTOR BEHAVIOR

Closed at idle. After Protect, the 360px Inspector opens on **What EvoPulse wants to do** (320K send) with Why / Impact / Policy / Evidence. Escape closes it. Workspace stays FOCUSED (840). At 1024 the Inspector overlays.

## COMMANDS THAT OPEN IT

`⌘K` · `Open Command` · `Protect everything at risk this week.` · `Why is 850K at risk?` · `Show Order A.` · `What if Atlas is another 3 days late?`

Deep links: `command.html?run=protect` and `command.html#approve` stage the completed run.

## LAYOUT

Locked Aurora / Control OS. Dark-first. IBM Plex Sans + IBM Plex Mono.

| Width | Behavior |
| --- | --- |
| **1440** | Sidebar 240. FOCUSED column 840. Inspector 360 when open. |
| **1280** | Sidebar 220. FOCUSED 740–840. Inspector 320. |
| **1024** | Sidebar collapsible (Menu). Single column. Inspector overlay 320. Composer full remaining width. No mobile sprint. |

## ACCESSIBILITY

- Contrast: ink on canvas ≥ 12:1; muted 12px ≥ 4.5:1
- Visible focus: `--focus-ring`. Never `outline: none` without replacement
- Buttons are `<button>`. Composer has a `<label>`
- Status always includes a text label (not color alone)
- `aria-live="polite"` on the operation trace
- Keyboard: Tab through nav, composer, suggestions, actions; Enter issues; Esc closes Inspector / sidebar
- Targets ≥ 32px
- `prefers-reduced-motion`: trace is instant

## WHAT THIS SCREEN IS NOT

| Pattern | Verdict |
| --- | --- |
| CRM-like | No. No contact list, pipeline, or activity feed. |
| ERP-like | No. No SKU tables, inventory modules, or finance ledgers. |
| Dashboard-like | No. No KPI tiles, charts, or twin-domain card wall. |
| ChatGPT-clone | No. No bubbles, avatars, markdown essay, “thinking” sparkle. |
| Card-disease | No. One situation + one trace + one inspector. Not a card grid. |
| Developer console | No. No JSON, `tool_call`, logs, or stack traces. |

## CANONICAL DATA USED

Atlas Retail Group · Amine Khelifi · Atlas Supply · SH-204 · RK-7 · Order A Oran Fresh 320,000 · Order B Constantine Clinic 280,000 · Order C Sétif Depot 250,000 · Invoice A/B/C 200/180/160 · Clock Sun 27 Sep 2026 · 08:18 Africa/Tunis · Quote: “Your shipment SH-204 will arrive Wednesday instead of Monday.” · Quote: “Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.” · Quote: “I'll sign today if you give me 10%.” · Policy `discount_max=5%` · Policy `external_message_requires_approval=true`.

## REFERENCE PROTOTYPE

`design/html/command.html` on `cursor/aurora-master-screens-e54a` (Ask EvoPulse + staged Protect trace). Content and interaction carried forward. Visual system locked to Control OS dark Aurora (`design/AURORA_TOKENS.css` on `cursor/control-os-dark-os-d1bc`), not the bronze master-screen palette and not the refused light-paper pass.

## MOBBIN / EXTERNAL PATTERNS

Used as structural references only — no branding, pixels, or copy copied.

- [Fey command palette](https://mobbin.com/screens/ff52ac90-4d18-4765-98da-df1e362a5ee1) — take: command as navigation. Do not take: ticker UI.
- [Better Stack command overlay](https://mobbin.com/screens/5a17a91b-e40a-46bc-b93f-57e720abd6dc) — take: “type a command” over a live workspace. Do not take: incident-module IA.
- [incident.io incident timeline](https://mobbin.com/screens/3b6c434a-3e1a-4b30-bfb9-1e732f143f2d) — take: operational steps with status, not chat. Do not take: SaaS white chrome or “mark as resolved” as the hero.
- [Superhuman command](https://mobbin.com/screens/68b22cd4-b6ef-48ee-a6a9-592e1c460570) — take: one field, keyboard-first. Do not take: email verbs.
- ChatGPT sources rail (via Control OS `MOBBIN_RESEARCH.md`) — take: evidence as a secondary panel. Do not take: bubbles, green send, web citations, chat history as IA.

## KNOWN LIMITATIONS

- Standalone HTML. No production binding. Approve / Execute are local prototype state.
- Only the Protect command is fully staged. Other suggestions fill the composer.
- Shell chrome is rendered inside this artifact for isolation; `00-shell` remains the shell owner.
- No image file generated (image models are not a reliable 1440 Control OS screenshot). Use `command.html` + `command-image-prompt.md`.
)
