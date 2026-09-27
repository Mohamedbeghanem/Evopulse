# Legacy HTML audit

Offline design-language + product-concept reference for the four prototypes in [`design/references/legacy-html/`](./references/legacy-html/). These files are **not disposable** and are **not production UI**.

Combine, do not blindly replace:

- **(A)** strongest concepts from these HTML screens
- **(B)** ChatGPT Search / AI workspace simplicity (one command surface, few primary places)
- **(C)** canonical Evopulse architecture in `PLAN.md` (events → twin → pulse → impact → plan → policy → act → verify → learn)
- **(D)** Aurora Control OS visual system

Do **not** preserve the old shell. New primary nav is **PULSE | COMMAND | TIMELINE | BUSINESS | GOALS**. Causal, Simulate, Autopilot, Evidence, Policy, and Graph are **contextual**, not top-level engines.

Shipped app IA today (`components/AppShell.tsx`) is still Pulse / Explore / Timeline / Simulate / Command / Goals / Graph. MOVE notes below target the **Control OS** rail, not that interim list and not TWIN / CAUSE / TIME / ACT.

Visual DNA to keep through Aurora: dark operational environment, near-black canvas, high contrast, orange as attention/active control, restrained hairlines, compact controls, precise data typography. Aurora **evolves** this. It does not flatten into generic white SaaS.

---

## IA map (old rail → Control OS)

| Legacy chrome | Do not keep as primary | Control OS home |
| --- | --- | --- |
| TWIN icon rail | Business Twin as the OS home | **BUSINESS** (capability / live model). Attention moves to **PULSE**. |
| CAUSE icon rail | Global Causal Explorer | **Why?** from a Pulse situation → contextual Causal. Full graph under **BUSINESS**. |
| TIME icon rail | “Time Machine” as an engine | **TIMELINE** (happened / changed / happening / expected / at-risk future). |
| ACT icon rail | Action inbox as an engine | **GOALS** → Plan → Policy → Action, then Simulation/Impact → Verification → Outcome (AgentRuntime). |
| Header `Ask your business…` (380×34) | Small global search field | **COMMAND** (ASK / SEARCH / NAVIGATE / SIMULATE / ACT). |
| 64px icon rail + 56px dark header | Old chrome | Control OS shell (not specified here; do not clone the rail). |

Shared demo spine across all four files: Atlas Steel, SHP-2291 +2d, cascade `SUP-EVT-0927`, 540K Friday cash, 300K exposed, two owner decisions. That story maps to `PLAN.md` §26–§29 and the existing seed/demo loop — do not invent a second narrative.

---

## 01 — Business Twin

File: [`design/references/legacy-html/01-business-twin.html`](./references/legacy-html/01-business-twin.html)

This screen is a **Pulse + Twin hybrid**. The eyebrow says `BUSINESS TWIN · LIVE STATE`, but the composition is an attention briefing: “Good afternoon. **2 decisions** need you today.” That is Autopilot-home language from `PLAN.md` §26 (`184 events / 171 normal / 9 handled automatically / 2 need you`), not a graph of the company.

### KEEP

- **Triage math, not a health score.** The 112px `EVENTS · 24H` strip: `184` total, `171` NORMAL (muted), `9` HANDLED AUTOMATICALLY (`#7FB2E0`), `2` NEED YOU (orange wash + `→`). Software counts; the headline only interprets.
- **Need-you as the only emphasized cell.** The `2` tile uses `rgba(255,90,31,0.08)` fill, `#FF6A2B` numeral, and is the only clickable summary cell. Orange is reserved for owner work.
- **Event-rate sparkline (last 60 min).** ~48 grey `#2E3844` bars, then three `#FF5A1F` spikes, then two `#7FB2E0` handled bars. Rate `3.1 / min` is labeled in mono. Anomaly is visible without a chart library.
- **Domain rows as situation lines, not KPI tiles.** Each of Sales / Cash / Operations / Customers / Suppliers is: status dot (pulsing if AT RISK) · domain name · 15px situation headline · 12.5px consequence line · mono exposure (`300K DZD EXPOSED`, `540K DZD INFLOW · 7D`, `94.2% ON-TIME · 30D`, `+2.0d LEAD-TIME DRIFT`) · 90×32 sparkline · status chip · chevron.
- **Three-state domain legend:** NORMAL `#5E6B7A` · WATCH `#F0B44C` · AT RISK `#FF5A1F`. Customers stays NORMAL (“42 active accounts, no escalations”) so quiet domains remain visible.
- **`NEEDS YOU · 2` rail** (420px, orange border `rgba(255,90,31,0.45)`): decision title, money delta (`+180K`, `+96K`), policy reason (`Broker fee 38,000 DZD · needs approval (FIN-02)`), dual CTAs **Review** (primary orange) and **Why?**.
- **`HANDLED AUTOMATICALLY · 9` log:** `14:21` / `09:17` timestamps in mono + one-line action (“Reserved 14t HR coil at Rouiba depot”). Autopilot is shown as a transcript, not a badge farm.
- **Live-ops metadata, not decoration:** `TWIN SYNC 0.4s AGO`, `SOURCES 38 CONNECTED`, `MODEL v4.2`, pulsing `LIVE` pill, `SUN 27 SEP · 14:32:08 CET`.
- **Tenant crumb in mono:** `/ Atlas Steel Distribution / Business Twin`.

### EVOLVE

- **Twin is not home.** Keep the live-state model; stop treating this layout as the first screen. PULSE owns “what needs you.” BUSINESS owns domains, sources, model version, sync.
- **Headline briefing stays, typeface may change.** “Good afternoon. 2 decisions need you today.” is the right voice. Aurora may set heading type; do not turn it into a marketing hero.
- **`Ask your business… e.g. why is Friday's cash at risk?`** is the right *capability* and the wrong *chrome*. Elevate to COMMAND (ASK / SEARCH / NAVIGATE / SIMULATE / ACT), not a 34px header field.
- **Domain row click targets are overloaded.** Sales and Suppliers go to Causal; Cash and Customers go to Time. In Control OS a domain row should open a **Pulse situation** (or a Business domain) with Why? / Timeline / Plan as contextual exits.
- **Sparkline + event strip** can stay compact but should read as Pulse telemetry (expected vs actual rate), not a Twin vanity chart.
- **“Review”** should enter the Goal → Plan → Policy → Action sequence, not a generic ACT inbox.

### REMOVE

- 64px icon rail (`TWIN` active, CAUSE / TIME / ACT waiting).
- 56px `#090C10` header with the small global input, `LIVE` + clock + `MO` avatar clustered as persistent chrome.
- Engine-nav mental model: opening the product *on* Business Twin.
- Decorative mark-as-home orange logo square cloned as the only brand moment (the mark can survive; the rail stack cannot).

### MOVE

| Pattern | Control OS |
| --- | --- |
| “2 decisions need you” + NEED YOU / HANDLED / NORMAL counts | **PULSE** (home) |
| Event-rate sparkline, 24h event strip | **PULSE** telemetry; optional deep-link to **TIMELINE** |
| Domain situation rows (Sales at risk, Cash watch, …) | **PULSE** situations first; durable domain model under **BUSINESS** |
| Why? on a decision | Contextual **Causal** from that Pulse situation — not a global CAUSE item |
| Review | **GOALS** (plan / policy / action for that decision) |
| Handled-automatically transcript | **PULSE** Autopilot slice + **TIMELINE** (happened) |
| Twin sync / sources / model / domain inventory | **BUSINESS** |
| Ask field | **COMMAND** |
| LIVE clock | Shell status, not a nav item |

### REASON

`PLAN.md` §3 (Business Twin domains) and §26 (Autopilot home counts) are **two products on one HTML page**. Shipping Twin as home made Causal/Time/Act feel like sibling engines. Control OS splits them: PULSE is the exception surface; BUSINESS is the live model you inspect when you are not in an incident. Why? must launch from a situation so Causal stays a question, not a destination.

---

## 02 — Causal Explorer

File: [`design/references/legacy-html/02-causal-explorer.html`](./references/legacy-html/02-causal-explorer.html)

Signature screen (`PLAN.md` §7): CAUSE → EVENT → DEPENDENCY → CONSEQUENCE. Title is a sentence, not a chart caption: “Supplier delay +2 days → **300K DZD** of Friday's cash at risk.” Eyebrow IDs the cascade: `CAUSAL EXPLORER · CASCADE SUP-EVT-0927`.

### KEEP

- **Layered propagation, top → down, labeled.** Left rail `L0 TRIGGER` / `L1 LOGISTICS` / `L2 ORDERS` / `L3 DEADLINES` / `L4 CASH`. Depth is an operational fact (`NODES 9`, `DEPTH 4`, `EXPOSED 300,000 DZD`, `COMPUTED 1.2s ago`).
- **Node anatomy.** Mono kind + id (`TRIGGER · SUP-EVT-0927`, `SHIPMENT · SHP-2291`, `ORDER A · ORD-1184`) · status chip (`ROOT` / `AT RISK` / `WATCH`) · human title · money or time in mono (`180,000 DZD`, `ETA Tue → Thu`, `p 0.91`).
- **Edge language.** Animated dashed `#FF5A1F` at-risk flow (`.flow`), `#F0B44C` watch dashes, solid `#3A4552` normal. Edge labels: `+2d · p 0.96`, `−180K`, `+240K safe`, `−120K`.
- **Cash sink node** (380×124, white `.ring` selection): `540,000 DZD EXPECTED` + 8px split bar (240K safe grey / 300K at-risk orange) + `240K SAFE · ORDER B` / `300K AT RISK · A + C`.
- **Dotted canvas** `#0B0F14` with `radial-gradient(#18202A 1px, transparent 1px)` @ 22px — graph reads as a board, not a card list.
- **NODE INSPECTOR (selected: expected cash, `CF-W40`).** 21px situation line; AT RISK amount `300,000 DZD`; **CONFIDENCE 89%** with a 4px ink bar; keyed rows `CAUSED BY` → `DL-1184 (−180K), DL-1203 (−120K)` and `AFFECTS` → `Supplier payment Mon 5 Oct · payroll buffer`.
- **Evidence stack with source chips:** `BANK` / `MODEL` / `POLICY` on `#0A0D11` rows (“3 scenarios run: base 540K, likely 240K, worst 160K.”; “Cash floor 1.2M DZD breached in likely scenario on Mon 5 Oct.”).
- **Exit verbs on the inspector:** **Generate plan** (primary) and **See on timeline**. Plus header **Replay cascade**.
- **Click-a-node contract** (toolbar: `PROPAGATION · TOP → DOWN · CLICK A NODE FOR EVIDENCE`) — matches shipped `/explore` inspector intent (source, evidence, timestamp, confidence).

### EVOLVE

- **Not a global CAUSE app.** Same cascade, opened from a Pulse **Why?** (or a COMMAND “what else does this delay touch?”). Breadcrumb should name the situation, not the engine.
- **Replay cascade** is a simulation control, not a Causal-nav feature. Promote to contextual **Simulate** (baseline vs replay / what-if). Keep the 1.2s compute stamp.
- **Generate plan** must enter the full GOALS sequence (including simulation/impact + policy), not jump to a flat ACT list.
- **Node hover lift** (`translateY(-1px)` + brightness) is fine; selection should stay the white ring + inspector bind, not a second page.
- **Order B as WATCH with slack** (`Slack 4 days left · p 0.18`) is the teaching contrast — keep the three-order fork, including the safe path.

### REMOVE

- CAUSE as a primary rail item (`.rail.on` on this file).
- Shared 64px rail + 56px header + 380px ask field.
- Treating `/explore` (or this HTML) as a peer of Pulse in the Control OS nav.

### MOVE

| Pattern | Control OS |
| --- | --- |
| Cascade canvas + L0–L4 + node chips | Contextual **Causal / Graph**, entered from **PULSE → Why?** |
| Node inspector CAUSED BY / AFFECTS | Stays with Causal; **Evidence** drawer for BANK / MODEL / POLICY |
| Confidence + probabilities on edges | Causal + Evidence (facts vs model — `PLAN.md` §6) |
| Replay cascade / “what else does this touch?” | Contextual **Simulate** (also addressable from **COMMAND**) |
| Generate plan | **GOALS** (Plan → Simulation/Impact → Policy → Action) |
| See on timeline | **TIMELINE** focused on `SUP-EVT-0927` / Friday cash |
| Full company topology | **BUSINESS → Graph** (shipped `/graph` is the data surface; this HTML is the *impact* view) |

### REASON

Causal is a **question about a situation**, not a fourth OS. `PLAN.md` §7 still wants this as a signature *demo screen*; Mohamed’s lock is that you reach it from Pulse (Why?) or Command, never from a standing CAUSE tab. Evidence chips already separate bank fact, model scenario, and policy floor — that split is architecture, not styling.

---

## 03 — Time Machine

File: [`design/references/legacy-html/03-time-machine.html`](./references/legacy-html/03-time-machine.html)

Eyebrow: `BUSINESS TIME MACHINE · WED 23 SEP → MON 5 OCT`. H1: “What changed, what needs you now, and what comes next.” This is the strongest argument for **TIMELINE** as a primary nav item (`PLAN.md` §8 PAST / NOW / FUTURE), elevated beyond a clock metaphor.

### KEEP

- **Cash position: actual + projected, one chart.** Solid `#C9D1DB` ACTUAL to NOW; dashed `#8F9AA8` EXPECTED; dashed `#FF5A1F` LIKELY IF NOTHING CHANGES. Fill under the likely path (`fill-opacity 0.12`). Labels `+540K expected` vs `+240K likely`.
- **Policy drawn on the time axis.** Dotted `CASH FLOOR 1.2M DZD` at y=86; `FLOOR BREACH` callout on Mon 5. Policy is a line in time, not a toast.
- **NOW as a cut.** Vertical `#FF5A1F` at x=652, pill `NOW 14:32`, orange vertex on the series. Past is filled; future is dashed.
- **Range scrubber:** `−7D` `−24H` **`NOW`** `+24H` `+7D` (`.seg` in a `#0E1217` well). Time is a control, not a filter chip soup.
- **Three lanes under the chart:**
  - **◀ PAST · WHAT CHANGED** — `4 SIGNIFICANT · 312 ROUTINE`. Rows: `WED 23 10:40` + sentence + tag (`PRICE` / `SALES` / `SIGNAL` / `TRIGGER`). Trigger row is weighted (`font-weight: 600`, orange time, `TRIGGER` chip).
  - **NOW · NEEDS YOU** — 240px orange-border column `#1A0F0A`, pulsing dot, giant `2`, `EXPOSED 300,000 DZD`, the same two decisions, **Open plan**.
  - **FUTURE · WHAT'S EXPECTED ▶** — date · sentence · tag · **probability** (`0.97`, `0.91`, `0.44`). Includes `AUTO` (Rouiba stock), `AT RISK` deadlines, `WATCH` Friday payment.
- **Moved / cancelled future.** `Original SHP-2291 arrival` is strikethrough, tag `MOVED`, probability `0.00`. Timeline tells the truth about revised ETAs.
- **WHAT HAPPENS NEXT** scenario strip. Segmented `IF YOU APPROVE BOTH` vs `IF NOTHING CHANGES`. Five beat cards: `MON 09:00 IF APPROVED` → … → `FRI 2 OCT TARGET MET` / `516K of 540K collected`, with `p 0.78` and `+180K` / `+96K` on the middle beats.

### EVOLVE

- **Elevate the metaphor.** Keep the chart + lanes, rename the product surface **TIMELINE**: happened / changed / happening / expected / at-risk future. “Time Machine” can remain as an internal name.
- **NOW column is Pulse, rendered in time.** Do not maintain a second decision inbox. The orange NOW card should be the same two PULSE items, scoped to “now” on this axis.
- **WHAT HAPPENS NEXT** is a **Simulate** comparison (approve-both vs do-nothing), not a third timeline. Keep the beat-card form; bind it to the planner + simulator already in the repo (`/simulate`, plan expected impact).
- **Ask placeholder** “what changed since Wednesday?” is a COMMAND query that should *land* on TIMELINE, not a header search.
- **Significant vs routine** (`4 · 312`) is the right compression for ChatGPT-like simplicity — default to significant; routine stays a disclosure.

### REMOVE

- TIME as a 64px rail engine.
- Shared header chrome / small ask field.
- A calendar-grid reading of this page (the HTML is already not a calendar; do not regress).

### MOVE

| Pattern | Control OS |
| --- | --- |
| Actual / expected / likely chart, NOW cut, floor line | **TIMELINE** (primary) |
| −7D … +7D scrubber | **TIMELINE** time control |
| Past significant events + trigger | **TIMELINE** · happened / changed |
| Future dated rows + probability + MOVED | **TIMELINE** · expected / at-risk future |
| NOW · 2 decisions | **PULSE** (source of truth), mirrored on **TIMELINE** |
| Open plan | **GOALS** |
| IF YOU APPROVE BOTH / IF NOTHING CHANGES | Contextual **Simulate** (from TIMELINE or GOALS) |
| Cash-floor breach | **TIMELINE** annotation + **BUSINESS** cash domain + **Policy** (floor rule) |

### REASON

`PLAN.md` §8 already defined PAST / NOW / FUTURE and “What happens next?”. The HTML adds the missing product ideas: **likely-if-idle vs expected**, **policy floor on the series**, **probability on future rows**, **strikethrough moved events**, and a **decision-gated future**. Those belong on TIMELINE as a first-class OS surface — not buried under an icon clock.

---

## 04 — Goal → Plan → Action

File: [`design/references/legacy-html/04-goal-plan-action.html`](./references/legacy-html/04-goal-plan-action.html)

Eyebrow literally prints the signature: `GOAL → PLAN → POLICY → ACTION`. H1: “EvoPulse is executing your plan. **2 steps wait on you.**” Header counters: `AUTO 3` · `NEED YOU 2` · `BLOCKED 1` · `POLICIES CHECKED 14`. This is the product loop, not a task app.

### KEEP

- **Numbered stage chips.** `01 GOAL` tile (56×56, mono index + label) beside the quoted objective `“Protect this week's revenue”` and provenance `SET BY MOHAMED · VOICE · 09:14`.
- **Goal chips, not a form dump:** `TARGET ≥ 500K of 540K by Fri 2 Oct` · `HORIZON Mon 28 → Fri 2` · `SCOPE sales · ops · cash`.
- **02 PLAN table.** Header: `6 ACTIONS · GENERATED IN 1.8s FROM CASCADE SUP-EVT-0927` + `VIEW CAUSE`. Column row: `#` · `ACTION · POLICY REASON` · `DECISION` · `EXECUTION`.
- **Every action carries a policy citation.** Shield + `OPS-01 · Stock reservations under 25t are pre-approved` / `CUS-02` / `FIN-02` / `OPS-05` / `FIN-07` / `MON-00`. Decision is explained in-row, not in a modal.
- **Three decision tags (do not collapse):**
  - `AUTO` (`.t-auto`, ice `#7FB2E0`) — already `DONE · 09:16` / `SENT · 09:17`
  - `NEEDS APPROVAL` (`.t-appr`, orange) — rows 3–4 highlighted `rgba(255,90,31,0.05)` with **Approve / Decline**
  - `BLOCKED` (`.t-blk`, lock) — row 5 dimmed title, `BLOCKED BY POLICY` (2% discount > 1.5%)
- **Money on the actions that move cash:** `+180K` / `+96K` next to the approval titles.
- **In-progress execution.** Row 6: blinking `● RUNNING` + 42% bar (`#7FB2E0`). Autonomy is visible while it works.
- **03 OUTCOME · FRIDAY REVENUE.** Giant `240K / 540K DZD secured`, chip `SHORT BY 260K`, bar vs `TARGET 500K` tick, breakdown: Order B 240K safe · Orders A/C `0 · pending` · `Cost of plan −38K`. Outcome is a ledger, not a green check.
- **04 EXECUTION LOG** on `#0A0D11` with `● STREAMING`. Columns: `14:31:52` · verb (`AUTO` / `WAIT` / `DENY` / `DONE` / `CHECK` / `PLAN` / `GOAL`) · sentence. This is AgentRuntime / audit DNA.

### EVOLVE

- **Lengthen the signature, don’t replace it.** Locked sequence: **GOAL → PLAN → SIMULATION/IMPACT → POLICY (AUTO / APPROVAL / BLOCKED) → ACTION → VERIFICATION → OUTCOME**, driven by AgentRuntime. The HTML stops at outcome-as-projection; shipped `PLAN.md` §14–§16 already have verification + outcome ledger. Add those stages to this *same* page family (not new top-level nav).
- **`State a goal…` input** is COMMAND (ACT), not an ACT-header field. Creating a goal from Command already exists in the repo (`/command` + `/goals`).
- **Outcome panel currently shows the idle/pending world** (`SHORT BY 260K` while two approvals wait). Bind it to simulation (if approved) vs live verification (did Friday cash land?). The Time Machine “IF YOU APPROVE BOTH / 516K” is the missing sibling state.
- **VIEW CAUSE** stays a contextual jump, not a return to a CAUSE app.
- **Approve / Decline** stay inline (do not hide behind a drawer). Policy reason must remain visible at the moment of the click (`PLAN.md` §12: policy, decision, reason, timestamp).

### REMOVE

- ACT as a primary rail item.
- Shared 64px rail + 56px header + 380px goal field in the chrome.
- Flattening this into a linear to-do list without policy tags, outcome bar, or execution log.

### MOVE

| Pattern | Control OS |
| --- | --- |
| 01 Goal statement + target/horizon/scope | **GOALS** (and origin utterance via **COMMAND**) |
| 02 Plan rows + AUTO / APPROVAL / BLOCKED | **GOALS** · Plan + contextual **Policy** |
| Approve / Decline / blocked lock | **GOALS** (human-in-the-loop); never a silent auto |
| VIEW CAUSE / cascade id | Contextual **Causal** (same `SUP-EVT-0927`) |
| Missing SIMULATION/IMPACT beat | Contextual **Simulate** before/beside policy (from GOALS or TIMELINE) |
| 03 Outcome + cost of plan | **GOALS** outcome; persist via Outcome Ledger (`PLAN.md` §15) |
| Verification (“did it work?”) | **GOALS** after ACTION; exceptions/expectations feed **PULSE** |
| 04 Execution log verbs | **GOALS** runtime + **TIMELINE** (happened) + contextual **Evidence** |
| AUTO 3 / NEED YOU 2 / BLOCKED 1 counters | **GOALS** header; NEED YOU also rolls up to **PULSE** |

### REASON

This file is the only prototype that shows **policy as the product**, not a settings page. `PLAN.md` §10–§16 and the 320K seed demo (approve recovery, block 10% discount) already implement that loop. Control OS should make GOALS the home of the sequence and COMMAND the way you *state* a goal — without promoting ACT, Policy, or Autopilot to primary nav.

---

## Shared reusable system

What to steal once and reuse. What to leave in the HTML.

### Layout ideas

- **1440×900 dark stage**, `#07090C` canvas, 22–28px page padding, 10px radius panels, 1px `#1F2630` / `#1A2029` hairlines. Keep the *density* and *panel grammar*; do not keep the fixed pixel artboard as a product constraint.
- **Briefing row:** mono eyebrow (letter-spacing ~`.14em`) + 24–26px Sans H1 with one orange clause + right-aligned mono stats (`TWIN SYNC`, `NODES/DEPTH/EXPOSED`, `AUTO/NEED YOU/BLOCKED`).
- **Main + inspector.** Twin and Causal use a wide stage + ~420px rail. Time Machine uses chart → 3 lanes → scenario strip. Goals uses 860px sequence + outcome/log stack. Control OS should pick **one shell** and slot these as page bodies.
- **ChatGPT-like simplicity at the OS level** (five primary places, one COMMAND). Density belongs *inside* Pulse situations, Causal, Timeline, and Goals — not in five more nav items.

### Components (reuse as Aurora primitives, not copy-paste HTML)

| Primitive | Where it already appears | Control OS use |
| --- | --- | --- |
| Primary / ghost 32–36px buttons (`.btn` / `.btn.pri`) | All four | Approve, Review, Generate plan, Open plan |
| Why? text button | Twin NEEDS YOU | Pulse situation → Causal |
| Status chip (NORMAL / WATCH / AT RISK / AUTO / TRIGGER / MOVED) | Twin, Causal, Time | Shared status token |
| Policy tag (AUTO / NEEDS APPROVAL / BLOCKED) | Goals | Policy decision |
| Evidence source chip (BANK / MODEL / POLICY) | Causal inspector | Evidence |
| LIVE pill + 8px pulse dot | All headers; Time NOW | Shell / happening |
| Domain / plan row (title, sub, mono metric, spark, chip, chevron) | Twin domains; Goals actions | Pulse situation row; Goal action row |
| Node card (kind+id, chip, title, money) | Causal | Contextual graph |
| Inspector metric pair (amount + confidence bar) | Causal | Evidence / impact |
| Segmented control (`.seg`) | Time range; What happens next | Timeline + Simulate |
| NOW cut + floor line | Time chart | Timeline annotations |
| Outcome bar vs target tick | Goals 03 | Goals + Pulse goal-drift |
| Execution log (time · verb · sentence) | Goals 04; Twin handled list | AgentRuntime / Timeline |
| Ask / goal field | All headers | **COMMAND only** (do not repeat in every header) |

### Status patterns

Keep a **small, shared vocabulary**. Do not invent per-page colors for the same idea.

| Token | Color in HTML | Meaning | Where |
| --- | --- | --- | --- |
| AT RISK / NEED YOU / ROOT / TRIGGER | `#FF5A1F` / `#FF7A45` / `#FF6A2B` | Owner attention or active control | Pulse, Causal path, Timeline NOW, approval rows |
| WATCH / SIGNAL | `#F0B44C` | Elevated, not yet owner work | Domains, future Friday cash |
| NORMAL / quiet | `#5E6B7A` / `#A3ADBA` | Healthy / dimmed / blocked-by-policy | Twin Customers, blocked action title |
| AUTO / HANDLED / ice | `#7FB2E0` | Machine completed or running | Twin handled, Goals AUTO, log STREAMING |
| Confidence / ink bar | `#E8ECF1` on `#1F2630` | Model confidence (not health) | Causal inspector |

Orange is **attention and active control**, never decoration (no orange cards that are not actionable). Ice is **machine work**, never “success confetti.”

### Graph patterns

- Top-down **propagation layers** with L0–L4 labels, not a force-directed hairball.
- **One selected sink** (cash) with a selection ring; click node → inspector, not navigation away.
- Edges encode **severity + motion** (dashed flow on the at-risk path).
- Edge captions carry **delta time, probability, money**.
- Forked consequences (A/B/C) including a **safe** middle path so the graph can say “not everything is dying.”
- Full topology (all node kinds) lives under **BUSINESS → Graph**; this explorer is the **impact slice** of one exception.

### Timeline patterns

- One series, three truths: **actual / expected / likely-if-idle**.
- **NOW** is a labeled cut, not “today” highlighting.
- **Policy constraints** (cash floor) drawn on the same axis.
- Lanes: changed (significant vs routine) · happening/needs-you · expected (with **p**) · at-risk future.
- **MOVED** + strikethrough for retracted expectations (`PLAN.md` expectation matcher).
- Scenario strip is **Simulate**, visually adjacent to Timeline, not a fourth primary nav.

### Interaction patterns

- **Situation-first exits:** Why? · Review / Open plan / Generate plan · See on timeline · Replay cascade / Simulate. These become contextual tools, not rail items.
- **Inline policy decisions** (Approve / Decline next to FIN-02 / OPS-05). No hidden confirm.
- **Ask/Command is universal** but **one place**: COMMAND handles ASK, SEARCH, NAVIGATE, SIMULATE, ACT. Header fields in the HTML are sketches of that capability.
- **Replay / compute freshness** (`1.2s ago`, `generated in 1.8s`) — keep the operational honesty.
- **Streaming log** (`● STREAMING`, `● RUNNING`) for AgentRuntime. Prefer this over skeleton cards.
- Do **not** carry hover-only meaning; nodes and rows are explicit buttons/links (the HTML already uses `<button class="node">` and `<a class="row">`).

### Typography

HTML and the shipped app already load **IBM Plex Sans** + **IBM Plex Mono** (`app/layout.tsx`). The prototypes also use Sans for 24–26px headings; the app currently uses **Instrument Serif** for Pulse/Timeline/Goals titles.

Evaluation for Control OS:

- **IBM Plex Sans** — body, H1 briefings, domain/action titles, buttons. Keep. It is the operational UI face of these prototypes.
- **IBM Plex Mono** — **only** timestamps, IDs (`SUP-EVT-0927`, `SHP-2291`, `ORD-1184`, `FIN-02`, `CF-W40`), policy codes, status chips, financial traces (`300,000 DZD`, `+2.0d`, `p 0.91`, `14:32:08`), sync/model metadata, execution-log verbs, axis ticks. The HTML over-uses mono (40px event counts, 44px outcome, section eyebrows). Aurora should **narrow** mono to traces, not headlines.
- **Instrument Serif** — not in the HTML. Optional Aurora display voice for Pulse/Command emptiness; do not let it replace mono on numbers/IDs or turn Goals into a magazine. If Aurora keeps a display face, use it for briefings, not for `240K` or `FIN-02`.

Weights actually used: Sans 400/500/600/700; Mono 400/500/600. Letter-spacing on eyebrows is `.10–.14em`. Do not add a third UI sans.

### Colors

Dark-first Control OS **starting references** (from the HTML, **not** final Aurora tokens). Orange = attention / active control, not decoration.

| Role | Hex | HTML usage |
| --- | --- | --- |
| Canvas | `#07090C` | Page / artboard |
| Nav / header | `#090C10` | Rail + 56px bar (bar goes; value as shell bg) |
| Secondary panel | `#0E1217` | Cards, ask field, chart well |
| Graph board | `#0B0F14` | Causal canvas |
| Recessed / log | `#0A0D11` | Evidence rows, execution log, scenario beats |
| Raised | `#141A22` | Buttons, chips, rail hover |
| Active | `#1A212B` | Rail `.on`, avatar, chip wells |
| Hairlines | `#1C232C` / `#232B35` | Nav border, ask border; panels also use `#1F2630` / `#1A2029` |
| Ink primary | `#E8ECF1` | Body text, NOW labels |
| Ink secondary | `#A3ADBA` | Meta, NORMAL counts |
| Ink tertiary | `#7C8796` | Eyebrows, timestamps, axis |
| Ink quiet | `#8F9AA8` | Subcopy, dimmed actions |
| Signal orange | `#FF5A1F` / `#FF7A45` | Primary button, AT RISK, NOW cut, need-you |
| Orange on dark text | `#0A0C0F` | Text on `.btn.pri` and NOW pill |
| Watch | `#F0B44C` | WATCH chips / edges |
| Auto / ice | `#7FB2E0` | Handled, AUTO, streaming |
| At-risk node fill | `#2A140B` / `#16100D` / `#1E120C` | Causal trigger / path / cash sink |
| NOW column fill | `#1A0F0A` | Timeline needs-you |

Shipped `app/globals.css` is already dark (`#080a0d`) but warmer (paper `#efe7d6`, gold wash). Aurora should **converge toward this HTML cool near-black + ink + orange signal**, not toward a light dashboard. Treat the table as references to evolve, not a frozen palette.

---

## What this audit is not

- Not a rewrite of `app/` routes or components.
- Not permission to upload these HTML files into image-only design pickers (export PNG/JPG from [`references/legacy-html/README.md`](./references/legacy-html/README.md)).
- Not a request to rebuild the 64px rail “in Aurora.”
- Not a replacement for the 320K seed demo or Neo4j-free graph tables already in the repo.
