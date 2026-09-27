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

**Lane lock:** Events, Graph, Detect, Impact, and Control stay **out of shell chrome and Aurora tokens** unless their emit / seed / expect-match / explore-timeline-impact / goal-plan-policy-verify wiring drifts. Design language does not get a second event store, graph store, deadline store, or impact store.

---

## Owning engines (specialist lane locks)

Every KEEP / MOVE below cites one of these engines. Surfaces **consume** the store; they do not fork it.

| Engine | Owns | Store / API (do not fork) | Control OS surfaces that consume it | Out of chrome unless |
| --- | --- | --- | --- | --- |
| **Events** | Typed history only | `events` + `EventService` append / list / replay | **TIMELINE** is Event Layer-backed. Causal, Twin, Goals **consume** this stream. | Emit wiring drifts |
| **Graph** | Relational topology + deps/impact reads | `graph_nodes` / `graph_edges` + `lib/graph` (`GET` dependencies / impact). SQLite only. **No Neo4j.** | **BUSINESS** Graph + Causal **Why?**. Twin, Causal, Time Machine **consume** this graph. | Seed / API wiring drifts |
| **Detect** | Expected vs actual; software miss/match only | `expectations` + `ExpectedEventMatcher`. **No LLM deadline truth.** Typed exceptions (`missed_commitment`, `delivery_delay`, `dependency_failure`, …) feed Impact. **No second deadline store.** | **PULSE** situations + **TIMELINE** “what is expected next”. Twin, Goals, Verify **consume** this pulse. | Expect / match path drifts |
| **Impact** (P7–P9) | Factual cascade + temporal modes | `calculateGraphImpact` (sums from **graph node amounts**; `commitments_at_risk` scoped **downstream**) + `/explore` cause → event → dependency → consequence + `/timeline` PAST / NOW / FUTURE. **No second impact store. No hardcoded 850K / 540K in UI. No LLM loss forecast.** | Causal **Why?**, **TIMELINE** Time Machine, impact totals. Twin, Pulse, Goals, Simulate **consume** this cascade. | Explore / timeline / impact wiring drifts |
| **Control** (P11–P17) | Goal → act → verify → learn | Structured **Goal → Plan (catalog actions only) → deterministic Policy (`AUTO` / `APPROVAL_REQUIRED` / `BLOCKED`) → Action emit via Event Layer → Verification creates new expectations (send ≠ solved) → Outcome Ledger / StrategyMemory** (sample thresholds). Humans accountable. | **GOALS** + contextual **Act** under **PULSE**. AgentRuntime / COMMAND (Ask / Search / Navigate / Simulate / Act) **must not bypass policy**. | Goal / plan / policy / verify wiring drifts |

**Impact IA lock (also in screen sections):** KEEP Causal path + Time Machine temporal modes + **graph-sourced amounts**. EVOLVE old CAUSE / TIME global nav into contextual **Why?** under **PULSE** and **TIMELINE**. REMOVE the 64px engine rail as primary IA.

**Control IA lock (also in §04):** KEEP goal → generated plan → policy badges → action progression. EVOLVE old ACT global rail into **GOALS** + contextual Act under **PULSE**; wire AgentRuntime / universal command into the **same** loop. REMOVE solve-on-send and plan-generated = goal-achieved. MOVE Simulation / Impact **before** Policy when shown: **GOAL → PLAN → SIM/IMPACT → POLICY → ACTION → VERIFY → OUTCOME**.

---

## IA map (old rail → Control OS)

| Legacy chrome | Do not keep as primary | Control OS home | Engine |
| --- | --- | --- | --- |
| TWIN icon rail | Business Twin as the OS home | **BUSINESS** (capability / live model). Attention moves to **PULSE**. | Graph (model) + Detect (attention) |
| CAUSE icon rail | Global Causal Explorer | **Why?** from a Pulse situation → contextual Causal. Full graph under **BUSINESS**. | Graph + Impact |
| TIME icon rail | “Time Machine” as an engine | **TIMELINE** (happened / changed / happening / expected / at-risk future). | Events + Detect + Impact |
| ACT icon rail | Action inbox as an engine | **GOALS** + contextual Act under **PULSE**. Sequence: GOAL → PLAN → SIM/IMPACT → POLICY → ACTION → VERIFY → OUTCOME (AgentRuntime). | Control (emits via Events; Verify writes Detect) |
| Header `Ask your business…` (380×34) | Small global search field | **COMMAND** (ASK / SEARCH / NAVIGATE / SIMULATE / ACT) — **must not bypass Policy**. | Control |
| 64px icon rail + 56px dark header | Old chrome | Control OS shell (not specified here; do not clone the rail). | None — chrome only |

Shared demo spine across all four files: Atlas Steel, SHP-2291 +2d, cascade `SUP-EVT-0927`, Friday cash, two owner decisions. That story maps to `PLAN.md` §26–§29 and the existing seed/demo loop — do not invent a second narrative. HTML numerals (`540K`, `300K`, `850K`) are **prototype fixtures**. Control OS UI must render **Impact** totals from `calculateGraphImpact` (graph node amounts), never hardcoded 850K / 540K.

---

## 01 — Business Twin

File: [`design/references/legacy-html/01-business-twin.html`](./references/legacy-html/01-business-twin.html)

This screen is a **Pulse + Twin hybrid**. The eyebrow says `BUSINESS TWIN · LIVE STATE`, but the composition is an attention briefing: “Good afternoon. **2 decisions** need you today.” That is Autopilot-home language from `PLAN.md` §26 (`184 events / 171 normal / 9 handled automatically / 2 need you`), not a graph of the company.

Twin **consumes** Graph (domains), Detect (situations), Events (handled transcript), and Impact (exposure). It must not grow a second activity, graph, deadline, or impact store.

### KEEP

- **Events + Detect — triage math, not a health score.** The 112px `EVENTS · 24H` strip: `184` total, `171` NORMAL (muted), `9` HANDLED AUTOMATICALLY (`#7FB2E0`), `2` NEED YOU (orange wash + `→`). Counts come from the Event Layer plus typed exception attention — not an LLM health score. The headline only interprets.
- **Detect — need-you as the only emphasized cell.** The `2` tile uses `rgba(255,90,31,0.08)` fill, `#FF6A2B` numeral, and is the only clickable summary cell. Orange is reserved for owner work on Detect situations.
- **Events — event-rate sparkline (last 60 min).** ~48 grey `#2E3844` bars, then three `#FF5A1F` spikes, then two `#7FB2E0` handled bars. Rate `3.1 / min` is labeled in mono. Anomaly is `EventService` list density, not a second telemetry store.
- **Graph + Detect + Impact — domain rows as situation lines, not KPI tiles.** Each of Sales / Cash / Operations / Customers / Suppliers is: status dot (pulsing if AT RISK) · domain name · 15px situation headline · 12.5px consequence line · mono exposure (`300K DZD EXPOSED`, `540K DZD INFLOW · 7D`, `94.2% ON-TIME · 30D`, `+2.0d LEAD-TIME DRIFT`) · 90×32 sparkline · status chip · chevron. Status is Detect; topology is Graph; money is Impact (`calculateGraphImpact` / node amounts — do not freeze the HTML 300K / 540K).
- **Detect — three-state domain legend:** NORMAL `#5E6B7A` · WATCH `#F0B44C` · AT RISK `#FF5A1F`. Customers stays NORMAL (“42 active accounts, no escalations”) so quiet domains remain visible.
- **Detect + Control + Impact — `NEEDS YOU · 2` rail** (420px, orange border `rgba(255,90,31,0.45)`): decision title, money delta (`+180K`, `+96K`), policy reason (`Broker fee 38,000 DZD · needs approval (FIN-02)`), dual CTAs **Review** (Control) and **Why?** (Impact / Graph).
- **Events + Control — `HANDLED AUTOMATICALLY · 9` log:** `14:21` / `09:17` timestamps in mono + one-line action (“Reserved 14t HR coil at Rouiba depot”). AUTO actions **emit via Event Layer**; this is that stream, not a second activity store.
- **Graph — live-ops metadata, not decoration:** `TWIN SYNC 0.4s AGO`, `SOURCES 38 CONNECTED`, `MODEL v4.2`. Twin is a read of `graph_nodes` / `graph_edges`, not a parallel model.
- **Events — clock as stream time, not chrome identity:** prototype shows pulsing `LIVE` + `SUN 27 SEP · 14:32:08 CET` and tenant crumb `/ Atlas Steel Distribution / Business Twin`. Keep *freshness of the event clock*; do not promote it to Aurora token work.

### EVOLVE

- **Twin is not home.** Keep the live-state model on **Graph**. **Detect** owns “what needs you” on **PULSE**. BUSINESS owns domains, sources, model version, sync.
- **Headline briefing stays, typeface may change.** “Good afternoon. 2 decisions need you today.” is Detect-count voice. Aurora may set heading type; do not turn it into a marketing hero.
- **`Ask your business… e.g. why is Friday's cash at risk?`** is **Control** COMMAND (ASK / SEARCH / NAVIGATE / SIMULATE / ACT) — must not bypass Policy — not a 34px header field.
- **Domain row click targets are overloaded.** Sales and Suppliers go to Causal; Cash and Customers go to Time. In Control OS a domain row opens a **Detect** Pulse situation (or a **Graph** Business domain) with Why? (**Impact**) / Timeline (**Events + Detect**) / Plan (**Control**) as contextual exits.
- **Sparkline + event strip** stay compact as **Events** telemetry on Pulse (expected vs actual rate via **Detect**), not a Twin vanity chart.
- **“Review”** enters **Control** Goal → Plan → SIM/IMPACT → Policy → Action — not a generic ACT inbox.

### REMOVE

- 64px icon rail (`TWIN` active, CAUSE / TIME / ACT waiting) as primary IA.
- 56px `#090C10` header with the small global input, `LIVE` + clock + `MO` avatar clustered as persistent chrome.
- Engine-nav mental model: opening the product *on* Business Twin.
- Decorative mark-as-home orange logo square cloned as the only brand moment (the mark can survive; the rail stack cannot).
- Any Twin-local event log, graph, or deadline table that is not `events` / `graph_*` / `expectations`.

### MOVE

| Pattern | Control OS | Engine |
| --- | --- | --- |
| “2 decisions need you” + NEED YOU / HANDLED / NORMAL counts | **PULSE** (home) | **Detect** (typed exceptions → attention). Counts may roll up **Events**. |
| Event-rate sparkline, 24h event strip | **PULSE** telemetry; optional deep-link to **TIMELINE** | **Events** (`EventService` list). TIMELINE stays Event Layer-backed. |
| Domain situation rows (Sales at risk, Cash watch, …) | **PULSE** situations first; durable domain model under **BUSINESS** | **Detect** (situation) + **Graph** (domain) + **Impact** (exposure from `calculateGraphImpact`) |
| Why? on a decision | Contextual **Causal** from that Pulse situation — not a global CAUSE item | **Graph** + **Impact** (P7 `/explore`) |
| Review | **GOALS** (plan / policy / action) + contextual Act under **PULSE** | **Control** (P11–P17). Catalog actions only; Policy before execute. |
| Handled-automatically transcript | **PULSE** Autopilot slice + **TIMELINE** (happened) | **Events** (action emit) consumed by Twin / Goals — no second activity store |
| Twin sync / sources / model / domain inventory | **BUSINESS** | **Graph** (`graph_nodes` / `graph_edges` + `lib/graph`) |
| Ask field | **COMMAND** | **Control** — Ask / Search / Navigate / Simulate / Act must not bypass Policy |
| LIVE clock | Shell status, not a nav item | Not an engine. Do not invent Aurora tokens for Events/Graph/Detect/Impact/Control. |

### REASON

`PLAN.md` §3 (Business Twin domains) and §26 (Autopilot home counts) are **two products on one HTML page**. Shipping Twin as home made Causal/Time/Act feel like sibling engines. Control OS splits them: **Detect** on PULSE is the exception surface; **Graph** on BUSINESS is the live model. Why? is **Impact** over that graph. Handled lines are **Events**. Review is **Control**. None of those engines get a Twin-shaped fork.

---

## 02 — Causal Explorer

File: [`design/references/legacy-html/02-causal-explorer.html`](./references/legacy-html/02-causal-explorer.html)

Signature **Impact** screen (`PLAN.md` §7 / P7): CAUSE → EVENT → DEPENDENCY → CONSEQUENCE on `/explore`. Title is a sentence, not a chart caption: “Supplier delay +2 days → **300K DZD** of Friday's cash at risk.” Eyebrow IDs the cascade: `CAUSAL EXPLORER · CASCADE SUP-EVT-0927`.

Amounts on this page are **Impact** (`calculateGraphImpact`, graph node amounts, `commitments_at_risk` downstream). Do not hardcode 850K / 540K / 300K in product UI. Do not ask an LLM for a loss forecast.

### KEEP

- **Graph + Impact — layered propagation, top → down, labeled.** Left rail `L0 TRIGGER` / `L1 LOGISTICS` / `L2 ORDERS` / `L3 DEADLINES` / `L4 CASH`. Depth is an operational fact (`NODES 9`, `DEPTH 4`, `EXPOSED 300,000 DZD`, `COMPUTED 1.2s ago`) from `lib/graph` + `calculateGraphImpact`, not a drawn-only diagram.
- **Graph — node anatomy.** Mono kind + id (`TRIGGER · SUP-EVT-0927`, `SHIPMENT · SHP-2291`, `ORDER A · ORD-1184`) · status chip (`ROOT` / `AT RISK` / `WATCH`) · human title · money or time in mono (`180,000 DZD`, `ETA Tue → Thu`, `p 0.91`). IDs are graph nodes (and Detect probabilities where an expectation exists).
- **Impact — Causal path (edge language).** Animated dashed `#FF5A1F` at-risk flow (`.flow`), `#F0B44C` watch dashes, solid `#3A4552` normal. Edge labels: `+2d · p 0.96`, `−180K`, `+240K safe`, `−120K`. KEEP this path visual; money labels must bind to graph-sourced amounts.
- **Impact — cash sink node** (380×124, white `.ring` selection): expected cash + 8px split bar (safe vs at-risk) + per-order attribution. HTML shows `540,000` / `240K SAFE · ORDER B` / `300K AT RISK · A + C` as fixtures; product reads node amounts.
- **Graph — dotted canvas** `#0B0F14` with `radial-gradient(#18202A 1px, transparent 1px)` @ 22px — board, not a card list. Same `graph_nodes` / `graph_edges` as BUSINESS Graph.
- **Impact + Detect — NODE INSPECTOR** (selected: expected cash, `CF-W40`). 21px situation line; AT RISK amount; **CONFIDENCE 89%** with a 4px ink bar; keyed rows `CAUSED BY` → `DL-1184 (−180K), DL-1203 (−120K)` and `AFFECTS` → `Supplier payment Mon 5 Oct · payroll buffer`. Confidence is evidence metadata, not LLM deadline truth (**Detect** owns miss/match).
- **Events + Impact + Control — evidence stack with source chips:** `BANK` / `MODEL` / `POLICY` on `#0A0D11` rows. BANK is Event Layer fact; MODEL is Impact/Simulate scenario (not a loss-forecast oracle); POLICY is Control (floor / spend rules).
- **Control + Impact + Events — exit verbs:** **Generate plan** (Control catalog plan) and **See on timeline** (Events + Detect + Impact PAST/NOW/FUTURE). Header **Replay cascade** is Impact/Simulate on the **same** graph — no second impact store.
- **Graph + Impact — click-a-node contract** (`PROPAGATION · TOP → DOWN · CLICK A NODE FOR EVIDENCE`) — shipped `/explore` inspector (source, evidence, timestamp, confidence) over `GET` dependencies / impact.

### EVOLVE

- **Not a global CAUSE app.** EVOLVE old CAUSE nav into contextual **Why?** under **PULSE** (Detect situation) or COMMAND (“what else does this delay touch?”). Same **Graph + Impact** cascade. Breadcrumb names the situation, not the engine.
- **Replay cascade** is Simulate consuming **Impact** / **Graph**, not a Causal-nav feature. Keep the compute stamp.
- **Generate plan** enters **Control** GOAL → PLAN → **SIM/IMPACT** → POLICY → ACTION (catalog actions only). Must not jump to a flat ACT list or bypass Policy.
- **Node hover lift** (`translateY(-1px)` + brightness) is fine; selection stays the white ring + inspector bind.
- **Order B as WATCH with slack** (`Slack 4 days left · p 0.18`) stays as the teaching fork — **Detect** slack on an expectation, **Impact** still scopes `commitments_at_risk` downstream (B may be out of the at-risk sum).

### REMOVE

- CAUSE as a primary rail item (`.rail.on` on this file).
- Shared 64px rail + 56px header + 380px ask field (64px engine rail is not primary IA).
- Treating `/explore` as a peer of Pulse in the Control OS nav.
- Hardcoded 850K / 540K / 300K in product UI; LLM “how much will we lose?” as truth.
- A Causal-local graph or impact cache that is not `graph_*` + `calculateGraphImpact`.

### MOVE

| Pattern | Control OS | Engine |
| --- | --- | --- |
| Cascade canvas + L0–L4 + node chips + Causal path | Contextual **Causal / Why?**, entered from **PULSE → Why?** | **Graph** + **Impact** (P7 `/explore`). Twin / Time Machine consume this graph — no fork. |
| Node inspector CAUSED BY / AFFECTS | Stays with Causal; **Evidence** drawer for BANK / MODEL / POLICY | **Graph** (edges) + **Impact** (downstream). BANK ⊂ **Events**. POLICY ⊂ **Control**. |
| Confidence + edge probabilities | Causal + Evidence | **Detect** (expectation confidence / p). Facts vs model: Impact sums stay factual (`PLAN.md` §6). No LLM deadline truth. |
| Replay cascade / “what else does this touch?” | Contextual **Simulate** (also from **COMMAND**) | **Impact** + **Graph** (same cascade). Simulate consumes; does not fork. COMMAND must not bypass **Control** Policy. |
| Generate plan | **GOALS** (Plan → SIM/IMPACT → Policy → Action) | **Control** (catalog actions). SIM/IMPACT before Policy when shown. |
| See on timeline | **TIMELINE** focused on the cascade / cash timing | **Events** (history) + **Detect** (expected next) + **Impact** (P8 PAST/NOW/FUTURE) |
| Full company topology | **BUSINESS → Graph** | **Graph** only (`graph_nodes` / `graph_edges` + `lib/graph`). This HTML is the Impact slice. |

### REASON

Causal is a **question about a Detect situation**, answered by **Impact** over **Graph**. `PLAN.md` §7 still wants this as a signature demo screen; the lane lock is that you reach it from Pulse Why? — never a standing CAUSE tab — and totals stay `calculateGraphImpact`. Evidence chips already separate Event fact, Impact scenario, and Control policy.

---

## 03 — Time Machine

File: [`design/references/legacy-html/03-time-machine.html`](./references/legacy-html/03-time-machine.html)

Eyebrow: `BUSINESS TIME MACHINE · WED 23 SEP → MON 5 OCT`. H1: “What changed, what needs you now, and what comes next.” This is **Impact P8** (`/timeline` PAST / NOW / FUTURE) elevated to **TIMELINE**, Event Layer-backed.

KEEP Time Machine **temporal modes** and **graph-sourced amounts**. EVOLVE old TIME global nav into **TIMELINE** (and Why? remains under PULSE, not a TIME sibling).

### KEEP

- **Events + Detect + Impact — cash position: actual + projected, one chart.** Solid `#C9D1DB` ACTUAL to NOW (**Events**); dashed `#8F9AA8` EXPECTED (**Detect** expectations); dashed `#FF5A1F` LIKELY IF NOTHING CHANGES (**Impact** cascade if idle — factual graph sums, not an LLM forecast). Fill under the likely path. HTML labels `+540K expected` vs `+240K likely` are fixtures — product binds `calculateGraphImpact`.
- **Control + Impact — policy drawn on the time axis.** Dotted cash-floor line + `FLOOR BREACH` callout. Policy is a Control rule rendered on the Impact/Detect axis, not a toast and not a second deadline store.
- **Impact — NOW as a cut.** Vertical `#FF5A1F` at x=652, pill `NOW 14:32`, orange vertex. Past is filled; future is dashed. KEEP P8 temporal mode.
- **Impact — range scrubber:** `−7D` `−24H` **`NOW`** `+24H` `+7D` (`.seg` in a `#0E1217` well). Window over the same Event / expectation / impact data.
- **Three lanes (P8 modes):**
  - **Events — ◀ PAST · WHAT CHANGED** — `4 SIGNIFICANT · 312 ROUTINE`. Rows: `WED 23 10:40` + sentence + tag (`PRICE` / `SALES` / `SIGNAL` / `TRIGGER`). Trigger row weighted. Typed history via `EventService` list — no second activity store.
  - **Detect — NOW · NEEDS YOU** — 240px orange-border column `#1A0F0A`, pulsing dot, giant `2`, exposed amount, the same two decisions, **Open plan**. Same Pulse situations — do not fork Detect.
  - **Detect — FUTURE · WHAT'S EXPECTED ▶** — date · sentence · tag · **probability**. Includes `AUTO`, `AT RISK` deadlines, `WATCH` Friday payment. **“What is expected next” stays on expectations + `ExpectedEventMatcher`.** Software miss/match only.
- **Detect — moved / cancelled future.** `Original SHP-2291 arrival` strikethrough, tag `MOVED`, probability `0.00`. Matcher resolved / revised the expectation — not a calendar delete.
- **Impact + Control — WHAT HAPPENS NEXT** scenario strip. `IF YOU APPROVE BOTH` vs `IF NOTHING CHANGES`. Beat cards through Friday collection. This is Simulate **consuming** the Impact cascade (and Control approvals), not a third timeline store.

### EVOLVE

- **Elevate TIME into TIMELINE.** Keep chart + lanes + temporal modes. Product surface: happened / changed / happening / expected / at-risk future. Old TIME global nav dies.
- **NOW column is Detect Pulse, rendered in time.** One situation list. The orange NOW card is the same PULSE items.
- **WHAT HAPPENS NEXT** is Simulate on **Impact** (approve-both vs do-nothing). Bind to existing `/simulate` + plan expected impact. Still no second impact store; still no hardcoded 850K / 540K.
- **Ask** “what changed since Wednesday?” is **Control** COMMAND that *lands* on TIMELINE (**Events** query) — not a header search, and not a policy bypass.
- **Significant vs routine** (`4 · 312`) compresses **Events** for ChatGPT-like simplicity — default significant; routine is a disclosure of the same store.

### REMOVE

- TIME as a 64px rail engine (64px engine rail is not primary IA).
- Shared header chrome / small ask field.
- A calendar-grid reading of this page.
- A Timeline-local event, deadline, or impact table that is not `events` / `expectations` / `calculateGraphImpact`.
- LLM “will we miss Friday?” as deadline truth (**Detect** owns miss/match).

### MOVE

| Pattern | Control OS | Engine |
| --- | --- | --- |
| Actual / expected / likely chart, NOW cut, floor line | **TIMELINE** (primary) | **Events** (actual) + **Detect** (expected) + **Impact** (likely-if-idle, graph-sourced amounts) + **Control** (floor rule drawn on the axis) |
| −7D … +7D scrubber | **TIMELINE** time control | **Impact** P8 window over Events / Detect |
| Past significant events + trigger | **TIMELINE** · happened / changed | **Events** (`EventService` append/list/replay). Causal / Twin / Goals consume — no fork. |
| Future dated rows + probability + MOVED | **TIMELINE** · expected / at-risk future | **Detect** (`expectations` + `ExpectedEventMatcher`). Typed exceptions feed **Impact**. |
| NOW · 2 decisions | **PULSE** (source of truth), mirrored on **TIMELINE** | **Detect**. Twin / Goals / Verify consume this pulse. |
| Open plan | **GOALS** + contextual Act under **PULSE** | **Control** (catalog plan; Policy; humans accountable) |
| IF YOU APPROVE BOTH / IF NOTHING CHANGES | Contextual **Simulate** (from TIMELINE or GOALS) | **Impact** cascade consumed by Simulate. SIM/IMPACT before **Control** Policy when shown. |
| Cash-floor breach | **TIMELINE** annotation + **BUSINESS** cash domain | **Control** (policy) + **Graph** (cash node) + **Impact** (totals) |

### REASON

`PLAN.md` §8 already defined PAST / NOW / FUTURE. The HTML adds likely-if-idle vs expected, policy floor on the series, probability on future rows, strikethrough moved events, and a decision-gated future. Lane locks assign those to **Events / Detect / Impact / Control** on one TIMELINE surface — not a clock engine with its own stores.

---

## 04 — Goal → Plan → Action

File: [`design/references/legacy-html/04-goal-plan-action.html`](./references/legacy-html/04-goal-plan-action.html)

Eyebrow: `GOAL → PLAN → POLICY → ACTION`. H1: “EvoPulse is executing your plan. **2 steps wait on you.**” Header counters: `AUTO 3` · `NEED YOU 2` · `BLOCKED 1` · `POLICIES CHECKED 14`.

This is **Control P11–P17**. KEEP goal → generated plan → policy badges → action progression. EVOLVE old ACT rail into **GOALS** + contextual Act under **PULSE**. MOVE Simulation / Impact **before** Policy when shown.

Actions **emit via Event Layer**. Verification creates **new** expectations (send ≠ solved). Outcome Ledger / StrategyMemory use sample thresholds. Humans accountable. COMMAND Ask / Search / Navigate / Simulate / Act **must not bypass Policy**.

### KEEP

- **Control — numbered stage chips.** `01 GOAL` tile (56×56, mono index + label) beside the quoted objective `“Protect this week's revenue”` and provenance `SET BY MOHAMED · VOICE · 09:14`. Structured Goal — not a chat reply.
- **Control — goal chips, not a form dump:** `TARGET ≥ 500K of 540K by Fri 2 Oct` · `HORIZON Mon 28 → Fri 2` · `SCOPE sales · ops · cash`. Target numbers in product come from Impact / Goal metric, not HTML fixtures.
- **Control — 02 PLAN table.** Header: `6 ACTIONS · GENERATED IN 1.8s FROM CASCADE SUP-EVT-0927` + `VIEW CAUSE`. Columns: `#` · `ACTION · POLICY REASON` · `DECISION` · `EXECUTION`. Plan is **catalog actions only**.
- **Control — every action carries a policy citation.** Shield + `OPS-01 · Stock reservations under 25t are pre-approved` / `CUS-02` / `FIN-02` / `OPS-05` / `FIN-07` / `MON-00`. Decision in-row: deterministic Policy.
- **Control — three decision tags (map HTML → engine enums; do not collapse):**
  - HTML `AUTO` (`.t-auto`, ice `#7FB2E0`) → engine `AUTO` — already `DONE · 09:16` / `SENT · 09:17`
  - HTML `NEEDS APPROVAL` (`.t-appr`, orange) → engine `APPROVAL_REQUIRED` — rows 3–4 with **Approve / Decline**
  - HTML `BLOCKED` (`.t-blk`, lock) → engine `BLOCKED` — row 5 dimmed, `BLOCKED BY POLICY` (2% discount > 1.5%)
- **Impact — money on the actions that move cash:** `+180K` / `+96K` next to approval titles. Show graph-sourced / `calculateGraphImpact` deltas, not hardcoded copy.
- **Control — in-progress execution.** Row 6: blinking `● RUNNING` + 42% bar. AgentRuntime is visible while it works — still inside Policy.
- **Control — 03 OUTCOME as a ledger, not a green check.** Giant secured vs target, `SHORT BY 260K`, breakdown including `Cost of plan`. Persist via Outcome Ledger / StrategyMemory (sample thresholds). Pending ≠ achieved.
- **Events + Control — 04 EXECUTION LOG** on `#0A0D11` with `● STREAMING`. Columns: `14:31:52` · verb (`AUTO` / `WAIT` / `DENY` / `DONE` / `CHECK` / `PLAN` / `GOAL`) · sentence. Action emit is Event Layer history that Twin / Timeline consume.

### EVOLVE

- **Lengthen the signature, don’t replace it.** Shown sequence: **GOAL → PLAN → SIM/IMPACT → POLICY (`AUTO` / `APPROVAL_REQUIRED` / `BLOCKED`) → ACTION → VERIFY → OUTCOME**. HTML stops at outcome-as-projection; P14–P17 already have verification + outcome ledger. Same page family; not new top-level nav.
- **Old ACT global rail → GOALS + contextual Act under PULSE.** Owner approvals appear on the Pulse situation *and* the Goal plan. One Control loop.
- **Wire AgentRuntime / COMMAND into that loop.** `State a goal…` is COMMAND ACT. Ask / Search / Navigate / Simulate / Act **must not bypass Policy**. Creating a goal from Command already exists (`/command` + `/goals`).
- **Outcome panel is idle/pending** (`SHORT BY 260K` while approvals wait). Bind live numbers to **Impact** / verification, not “plan generated ⇒ goal achieved.” Time Machine “IF YOU APPROVE BOTH / 516K” is the Simulate sibling **before** Policy commit.
- **VIEW CAUSE** is contextual **Graph + Impact** Why?, not a CAUSE app.
- **Approve / Decline** stay inline. Policy reason visible at click (`PLAN.md` §12: policy, decision, reason, timestamp). Humans accountable.

### REMOVE

- ACT as a primary rail item (64px engine rail is not primary IA).
- Shared 64px rail + 56px header + 380px goal field in the chrome.
- Flattening this into a to-do list without policy tags, outcome bar, or execution log.
- **Solve-on-send** (HTML `SENT · 09:17` must not mean the customer/cash problem is closed).
- **Plan-generated = goal-achieved** framing (H1 “executing your plan” is fine; the outcome chip must not read done because a plan exists).
- Plans that invent actions outside the catalog; Policy decided by an LLM; a Goals-local event/deadline/impact store.

### MOVE

| Pattern | Control OS | Engine |
| --- | --- | --- |
| 01 Goal statement + target/horizon/scope | **GOALS** (utterance via **COMMAND**) | **Control** (P11 Goal). Metric/target may read **Impact** / **Detect**. |
| 02 Plan rows (catalog actions) | **GOALS** · Plan | **Control** (P12). Catalog only. |
| AUTO / `APPROVAL_REQUIRED` / BLOCKED + Approve / Decline | **GOALS** + contextual **Policy** + contextual Act under **PULSE** | **Control** (P13 deterministic Policy). Humans accountable. |
| SIM/IMPACT beat (missing in HTML order) | Contextual **Simulate** / **Why?** **before** Policy when shown | **Impact** (P7–P9) + Simulate. Goals / Pulse consume the cascade — no fork. |
| VIEW CAUSE / cascade id | Contextual **Causal** from the goal’s situation | **Graph** + **Impact** |
| Action execute | **GOALS** runtime / AgentRuntime | **Control** (P14) **emits via Event Layer** — Timeline / Twin consume **Events** |
| Verification (“did it work?”) | **GOALS** after ACTION; open loops appear on **PULSE** | **Control** (P15) creates **new expectations**. **Detect** (`ExpectedEventMatcher`) miss/matches. **Send ≠ solved.** |
| 03 Outcome + cost of plan | **GOALS** outcome | **Control** (P16–P17 Outcome Ledger / StrategyMemory, sample thresholds) |
| 04 Execution log verbs | **GOALS** runtime + **TIMELINE** (happened) + Evidence | **Events** (typed history). No second activity store. |
| AUTO 3 / NEED YOU 2 / BLOCKED 1 counters | **GOALS** header; NEED YOU also on **PULSE** | **Control** (decision mix) + **Detect** (NEED YOU rollup) |

### REASON

This file is the only prototype that shows **Policy as the product**. Lane lock: that is **Control P11–P17**, emitting **Events**, verifying through **Detect**, measuring with **Impact** amounts. COMMAND and AgentRuntime are the same loop — they do not get a side door around `AUTO` / `APPROVAL_REQUIRED` / `BLOCKED`. Send is an event, not a solution.

---

## Shared reusable system

What to steal once and reuse. What to leave in the HTML. Engines named here are the same five locks — still out of Aurora tokens unless wiring drifts.

### Layout ideas

- **1440×900 dark stage**, `#07090C` canvas, 22–28px page padding, 10px radius panels, 1px `#1F2630` / `#1A2029` hairlines. Keep the *density* and *panel grammar*; do not keep the fixed pixel artboard as a product constraint.
- **Briefing row:** mono eyebrow (letter-spacing ~`.14em`) + 24–26px Sans H1 with one orange clause + right-aligned mono stats (`TWIN SYNC`, `NODES/DEPTH/EXPOSED`, `AUTO/NEED YOU/BLOCKED`).
- **Main + inspector.** Twin and Causal use a wide stage + ~420px rail. Time Machine uses chart → 3 lanes → scenario strip. Goals uses 860px sequence + outcome/log stack. Control OS should pick **one shell** and slot these as page bodies.
- **ChatGPT-like simplicity at the OS level** (five primary places, one COMMAND). Density belongs *inside* Pulse situations, Causal, Timeline, and Goals — not in five more nav items, and not as extra stores.

### Components (reuse as Aurora primitives, not copy-paste HTML)

| Primitive | Where it already appears | Control OS use | Engine |
| --- | --- | --- | --- |
| Primary / ghost 32–36px buttons (`.btn` / `.btn.pri`) | All four | Approve, Review, Generate plan, Open plan | **Control** |
| Why? text button | Twin NEEDS YOU | Pulse situation → Causal | **Impact** + **Graph** |
| Status chip (NORMAL / WATCH / AT RISK / AUTO / TRIGGER / MOVED) | Twin, Causal, Time | Shared status token | **Detect** (MOVED / AT RISK) + **Events** (TRIGGER) + **Control** (AUTO) |
| Policy tag (`AUTO` / `APPROVAL_REQUIRED` / `BLOCKED`) | Goals (`NEEDS APPROVAL` → `APPROVAL_REQUIRED`) | Policy decision | **Control** |
| Evidence source chip (BANK / MODEL / POLICY) | Causal inspector | Evidence | **Events** / **Impact** / **Control** |
| LIVE pill + 8px pulse dot | All headers; Time NOW | Shell / happening | Not an engine token |
| Domain / plan row | Twin domains; Goals actions | Pulse situation row; Goal action row | **Detect** + **Graph** / **Control** |
| Node card (kind+id, chip, title, money) | Causal | Contextual graph | **Graph** + **Impact** (amounts) |
| Inspector metric pair (amount + confidence bar) | Causal | Evidence / impact | **Impact** (amount) + **Detect** (confidence) |
| Segmented control (`.seg`) | Time range; What happens next | Timeline + Simulate | **Impact** P8 / Simulate |
| NOW cut + floor line | Time chart | Timeline annotations | **Impact** + **Control** (floor) |
| Outcome bar vs target tick | Goals 03 | Goals + Pulse goal-drift | **Control** + **Detect** |
| Execution log (time · verb · sentence) | Goals 04; Twin handled list | AgentRuntime / Timeline | **Events** |
| Ask / goal field | All headers | **COMMAND only** | **Control** (no policy bypass) |

### Status patterns

Keep a **small, shared vocabulary**. Do not invent per-page colors for the same idea.

| Token | Color in HTML | Meaning | Engine |
| --- | --- | --- | --- |
| AT RISK / NEED YOU / ROOT / TRIGGER | `#FF5A1F` / `#FF7A45` / `#FF6A2B` | Owner attention or active control | **Detect** (NEED YOU / AT RISK) + **Events** (TRIGGER) + **Impact** (ROOT path) |
| WATCH / SIGNAL | `#F0B44C` | Elevated, not yet owner work | **Detect** |
| NORMAL / quiet | `#5E6B7A` / `#A3ADBA` | Healthy / dimmed / blocked-by-policy | **Detect** / **Control** (`BLOCKED`) |
| AUTO / HANDLED / ice | `#7FB2E0` | Machine completed or running | **Control** (`AUTO`) + **Events** (handled emit) |
| Confidence / ink bar | `#E8ECF1` on `#1F2630` | Model / expectation confidence — not health, not LLM deadline truth | **Detect** |

Orange is **attention and active control**, never decoration. Ice is **machine work**, never “success confetti.” `SENT` / `AUTO` ice does **not** mean verified (**Control**: send ≠ solved).

### Graph patterns

- Top-down **propagation layers** with L0–L4 labels — **Impact** view of **Graph**, not a force-directed hairball.
- **One selected sink** (cash) with a selection ring; click node → inspector (`GET` dependencies / impact).
- Edges encode **severity + motion** (dashed flow on the at-risk path).
- Edge captions carry **delta time, probability, money** — money from node amounts via `calculateGraphImpact`; `p` from **Detect**; no hardcoded 850K / 540K.
- Forked consequences (A/B/C) including a **safe** middle path; `commitments_at_risk` stays **downstream-scoped**.
- Full topology lives under **BUSINESS → Graph** on the **same** `graph_nodes` / `graph_edges`. Twin / Causal / Time Machine consume; **no Neo4j; no second graph store**.

### Timeline patterns

- TIMELINE is **Event Layer-backed** (`events` + `EventService` append / list / replay). Typed history only.
- One series, three truths: **actual (Events) / expected (Detect) / likely-if-idle (Impact)**.
- **NOW** is a labeled cut, not “today” highlighting.
- **Policy constraints** (cash floor) are **Control** drawn on the same axis.
- Lanes: changed (**Events**) · happening/needs-you (**Detect**) · expected / at-risk future (**Detect** + **Impact**).
- **MOVED** + strikethrough = `ExpectedEventMatcher` revision — **no second deadline store**.
- Scenario strip is **Simulate consuming Impact**, visually adjacent to Timeline, not a fourth primary nav or fourth store.

### Interaction patterns

- **Situation-first exits:** Why? (**Impact**) · Review / Open plan / Generate plan (**Control**) · See on timeline (**Events**) · Replay cascade / Simulate (**Impact**). Contextual tools, not rail items.
- **Inline policy decisions** (Approve / Decline next to FIN-02 / OPS-05). No hidden confirm. COMMAND / AgentRuntime use the same Policy gate.
- **Ask/Command is universal** but **one place**: COMMAND handles ASK, SEARCH, NAVIGATE, SIMULATE, ACT — **must not bypass Policy**.
- **Replay / compute freshness** (`1.2s ago`, `generated in 1.8s`) — operational honesty, not a second compute ledger.
- **Streaming log** (`● STREAMING`, `● RUNNING`) for AgentRuntime = Event Layer + Control. Prefer this over skeleton cards.
- Do **not** carry hover-only meaning; nodes and rows are explicit buttons/links.
- Do **not** treat send, plan generation, or AUTO complete as goal achievement.

### Typography

HTML and the shipped app already load **IBM Plex Sans** + **IBM Plex Mono** (`app/layout.tsx`). The prototypes also use Sans for 24–26px headings; the app currently uses **Instrument Serif** for Pulse/Timeline/Goals titles.

Evaluation for Control OS:

- **IBM Plex Sans** — body, H1 briefings, domain/action titles, buttons. Keep. It is the operational UI face of these prototypes.
- **IBM Plex Mono** — **only** timestamps, IDs (`SUP-EVT-0927`, `SHP-2291`, `ORD-1184`, `FIN-02`, `CF-W40`), policy codes, status chips, financial traces (`300,000 DZD`, `+2.0d`, `p 0.91`, `14:32:08`), sync/model metadata, execution-log verbs, axis ticks. The HTML over-uses mono (40px event counts, 44px outcome, section eyebrows). Aurora should **narrow** mono to traces, not headlines.
- **Instrument Serif** — not in the HTML. Optional Aurora display voice for Pulse/Command emptiness; do not let it replace mono on numbers/IDs or turn Goals into a magazine. If Aurora keeps a display face, use it for briefings, not for `240K` or `FIN-02`.

Weights actually used: Sans 400/500/600/700; Mono 400/500/600. Letter-spacing on eyebrows is `.10–.14em`. Do not add a third UI sans.

Mono IDs (`SUP-EVT-0927`, `ORD-1184`) are **Events** / **Graph** identifiers. Policy codes (`FIN-02`) are **Control**. Do not invent a parallel ID system in Aurora.

### Colors

Dark-first Control OS **starting references** (from the HTML, **not** final Aurora tokens). Orange = attention / active control, not decoration.

Events, Graph, Detect, Impact, and Control **do not get their own Aurora token sets** unless emit / seed / expect-match / explore-timeline-impact / goal-plan-policy-verify wiring drifts. The table is shell + data-type color, not per-engine theming.

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
- Not permission to add a second activity store, graph store, deadline store, or impact store — or to hardcode 850K / 540K, treat send as solved, or let COMMAND bypass Policy.
- Not permission to put Events / Graph / Detect / Impact / Control into shell chrome or Aurora tokens unless their named wiring drifts.
