# 04 — Situation / Why

AGENT_C · Aurora Control OS · isolated prototype.

Chrome is **locked** from `design/screens/00-shell/` and `design/AURORA_TOKENS.css` on `origin/cursor/control-os-dark-os-d1bc`. This folder does not redesign the shell or Inspector. Causal Explorer (`07`) is not forked — the path lives on this screen because the user question is *why it matters*, not *open a second product*.

---

## SCREEN

Situation. The one attention object Pulse surfaces for the Atlas Supply delay.

Standalone artifact: [`situation.html`](./situation.html)

## USER QUESTION

**WHY DOES THIS MATTER?**

Answered in this order, on one page:

1. WHAT CHANGED
2. WHY IT MATTERS
3. WHAT IT AFFECTS
4. EVIDENCE
5. WHAT CAN HAPPEN NEXT

## PURPOSE

Show an operator that **one observed supplier revision** is already a business situation — not a second warning, not a dashboard tile, and not a loss forecast.

Atlas Supply moved SH-204 Monday → Wednesday. RK-7 rides on that shipment. Three customer orders share RK-7. The money on those orders is **associated revenue**. Invoice cash that still sits in the week of 28 Sep is **expected cash timing**. Nothing here is lost or saved.

Progressive disclosure stays on this object: Why? · Evidence · Simulate · Act. Simulate is labeled **SIMULATION · NOT LIVE BUSINESS STATE** and never writes this situation.

## ROUTE

Target: `/situations/:id`  
Prototype: `design/screens/04-situation/situation.html`  
Production today: `/exceptions/exc_shipment_delay` + `/impact/exc_shipment_delay` + `/explore`

Query states:

| Query | State shown |
| --- | --- |
| *(default)* | `NEEDS YOU` — delay observed |
| `?state=monitoring` | `MONITORING` — watching cash timing |
| `?state=blocked` | `BLOCKED` — policy refuses an outbound notice |
| `?state=handled` | `HANDLED` — verified, not merely executed |
| `?state=empty` | No situation to open |
| `?state=loading` | Identity + state phrase first |
| `?state=error` | This situation could not be opened |

## PRIMARY OBJECT

**Situation** — Supplier delay · Shipment SH-204.

One top-level attention object. The supplier message, the `shipment.delayed` event, the warning layer, and the delivery exception are **the same event**. They are not two problems.

Layer, not a second title: **AT RISK — NOT MISSED.** Tuesday 29 Sep has not passed.

## PRIMARY ACTION

**Prioritize Order A** — protect the earliest customer deadline (Oran Fresh, Tuesday 29 Sep 10:00).

This is the one human move this situation asks for. It does not mark the situation HANDLED.

## SECONDARY ACTIONS

- **Prepare delay notice** — customer-facing; `external_message_requires_approval` → **NEEDS APPROVAL**. EvoPulse cannot approve itself.
- **Open evidence** — jump to the business-source pack on this page (not a hidden model trace).
- **Simulate +3 days** — drawer only. Isolation hash unchanged. Invoice C `160,000 DZD` timing is the delta — **never 540,000**.
- **Ask EvoPulse about this…** — three grounded questions, not a chat page:
  - Why is 850K at risk?
  - Which customer is affected first?
  - What if Atlas is another 3 days late?

## DATA SOURCES

Canonical Atlas cascade after `triggerSupplierDelay` (engine tests win if HTML disagrees):

| Source | What it contributes |
| --- | --- |
| Supplier message | “Your shipment will arrive Wednesday instead of Monday.” · Sun 27 Sep 2026 · 09:13 · Atlas Supply |
| Event | `message.received` → `shipment.delayed` · SH-204 Monday 28 Sep 09:00 → Wednesday 30 Sep 09:00 · +2 · confidence 0.96 |
| Expectation | `Shipment SH-204 arrives Monday` → **AT RISK** (not MISSED) |
| Commitment | Receive SH-204 Monday · Deliver Order A to Oran Fresh Tuesday · both `at_risk` |
| Graph | Atlas Supply —supplies→ SH-204 —contains→ RK-7 —required_by→ Orders A/B/C —belongs_to→ customers —produces→ invoices —expected_payment→ cash week |
| Impact | `calculateGraphImpact` sums stored amounts: 3 orders · 3 customers · **850,000 DZD associated revenue** (320+280+250) · **540,000 DZD expected cash timing** (200+180+160) |
| Twin | OPERATIONS / SUPPLIERS = AT_RISK · CASH = MONITORING · customers = ATTENTION |
| Policy | Outbound customer notice = APPROVAL_REQUIRED |
| Verification | Send ≠ solved. Execution ≠ HANDLED. |

Clock on this screen: **Sun 27 Sep 2026 · 09:14 Africa/Tunis** (`SUPPLIER_CASCADE_ISO`). Seed clock before the delay is 08:18.

## ENGINE OWNERS

| Lane | Owner | This screen reads |
| --- | --- | --- |
| Events | `lib/events` | message + shipment.delayed + exception.created |
| Graph | `lib/graph` | path Atlas Supply → … → customers |
| Detect | matcher + `lib/engine/supplier.ts` | AT RISK, not MISSED |
| Impact | `lib/engine/impact.ts` | 3 / 3 / 850K / 540K |
| Control | policy + planner | approval on customer notice; primary action catalog |

AI does not write expectation state, impact totals, or policy outcomes.

## STATES

Canonical attention: **NEEDS YOU · NEEDS APPROVAL · MONITORING · BLOCKED · HANDLED.**

Secondary layer: **AT RISK — NOT MISSED.**

| State | Meaning on this screen |
| --- | --- |
| NEEDS YOU | Delay observed. Order A is the first customer. Human must prioritize. |
| NEEDS APPROVAL | A prepared customer notice waits. Not a second situation. |
| MONITORING | Cash week still dated next week. Watch timing. Not a miss. |
| BLOCKED | Policy refused an unauthorized outbound or concession. |
| HANDLED | Verification SUCCESS. Executing a notice is not this. |
| AT RISK | Tuesday has not passed. Buffer shortfall −41h. |

Do not render MISSED for Order A on 27 Sep.

## EMPTY / LOADING / ERROR

**Empty** — “No situation to open.” Still name the clock. Do not invent a cascade.

**Loading** — Identity first: `Situation · SH-204` + state phrase `NEEDS YOU`. Then a 56px workspace skeleton. No full-page spinner.

**Error** — “This situation could not be opened.” Offer return to Pulse. Do not show a partial cascade as complete.

## INSPECTOR BEHAVIOR

Locked Inspector (360px / 320px at 1280 / overlay at 1024). Closed is the OS default; **this screen opens it** because a Situation always has a selected object.

- Default selected: **Shipment SH-204**
- Click a path node, an order row, or an evidence source → Inspector updates in place
- Fields: type · current state · relationship · source · evidence · timestamp · confidence · affected objects
- Escape / × closes on 1024 overlay
- Do not redesign Inspector chrome

## RELATED SCREENS

| # | Screen | Relation |
| --- | --- | --- |
| 01 | Pulse | Origin. Review opens this Situation. |
| 03 | Timeline | 09:13 message · 09:14 cascade · NOW 850K associated |
| 05 | Risk | Buffer / associated-value layer — not a second object |
| 06 | Exception | Same Situation, fully told |
| 07 | Causal | Why along the graph — inlined here, not a sidebar item |
| 08 | Simulation | What-if +3 days. Isolation only. |
| 12 | Approval | Customer notice gate |
| 13 | Business Twin | OPERATIONS AT RISK · CASH MONITORING |
| 18 | Evidence | Business sources pack |
| 19 | Verification | Send ≠ solved |

## COMMANDS THAT CAN OPEN IT

- `Show Atlas delay`
- `Why is Atlas at risk?`
- `Why does this matter?`
- `Why is 850K at risk?`
- `Which customer is affected first?`
- `What if Atlas is another 3 days late?` → lands on Simulate from this Situation, not a new problem

## LEGACY REFERENCES USED

Read-only. Nothing copied into production.

| Reference | What was taken |
| --- | --- |
| `origin/cursor/control-os-dark-os-d1bc` `00-shell` + `AURORA_TOKENS.css` + `CONTROL_OS_LAYOUT.md` + `CONTROL_OS_IA.md` | Locked chrome, tokens, Situation contract |
| `origin/cursor/aurora-master-screens-e54a` `design/html/risk-why.html` + `SCREEN_SPECS.md` | Combined Why: path + impact + evidence + simulate drawer; buffer −23h / 18h / −41h; Invoice C 160K sim delta |
| `origin/cursor/aurora-design-e6b9` `design/AURORA.md` | One situation, one state, associated ≠ lost, AT RISK ≠ MISSED, execution ≠ HANDLED |
| Production `/explore`, `/impact/exc_shipment_delay`, `components/CausalExplorer.tsx` | Path roles cause → event → dependency → consequence; Inspector fields |
| `lib/engine/seed-graph.ts`, `supplier.ts`, `impact.ts`, `twin.ts`, `timeline.ts` | Canonical numbers and quotes |
| `tests/fixtures/atlas-supply.ts`, `tests/cascade.test.ts` | 3/3/850K/540K authority |
| `PLAN.md` §6 Impact, §7 Causal, §29 Demo story | Operational cascade copy |
| Mobbin [incident.io incident](https://mobbin.com/screens/669e4230-efb6-4f79-a1a8-b042aa022cae) | One object, briefing + right metadata. Not copied chrome. |
| Mobbin [Better Stack incidents](https://mobbin.com/screens/8e53ee11-1a80-4f16-8269-e39b3d57a2a2) | One attention row, not three cards for one event. |

## FINANCIAL SEMANTICS

- **850,000 DZD** = associated revenue on Orders A + B + C. Never lost. Never saved. Never “at-risk cash” as a loss.
- **540,000 DZD** = expected cash timing on Invoices A + B + C (week of 28 Sep). Twin CASH = MONITORING.
- **320,000 DZD** on Order A is that order’s amount — also the separate proposal-recovery figure. Do not use 320K as cascade loss.
- Simulation +3 days moves **Invoice C 160,000 DZD** timing — not 540,000.

## WARNING SEMANTICS

Warning + exception of SH-204 are one Situation. Order B remaining on the calendar is MONITORING, not a second NEEDS YOU. Do not clone Order A as its own top-level problem.

## VERIFICATION SEMANTICS

Preparing or sending a delay notice is **execution**. HANDLED requires verification SUCCESS. The prototype states this in WHAT CAN HAPPEN NEXT.

## SIMULATION SEPARATION

The Simulate drawer clones nothing in the live Situation. Banner: `SIMULATION · NOT LIVE BUSINESS STATE`. Isolation hash unchanged.

## ACCESSIBILITY

- Skip link to workspace
- Contrast: ink on canvas ≥ 12:1; muted ≥ 4.5:1 at 12px
- Focus-visible uses `--focus-ring` (never `outline: none` without replacement)
- Status always includes a text label; color is not the only signal
- Buttons are `<button>`; path nodes are a `listbox`
- Keyboard: Tab through nav / path / orders / actions; Enter selects; Esc closes command and 1024 inspector
- Target size ≥ 32px
- `prefers-reduced-motion` kills pulse
- `aria-live="polite"` on Ask answers and Inspector identity

## RESPONSIVE

| Width | Behavior |
| --- | --- |
| 1440 | Canonical. Sidebar 240. Inspector 360. |
| 1280 | Sidebar 220. Inspector 320. Gutters 24. |
| 1024 | Sidebar collapsible. Inspector overlays 320. Single column. Actions wrap. No horizontal scroll. |

## ANTI-PATTERNS (this folder refuses)

- CRM contact / pipeline / activity feed
- ERP stock / PO / warehouse forms as the page
- Dashboard KPI tiles, sparklines, donuts
- ChatGPT bubble thread
- Card disease (no grid of metric cards for 850K / 540K / 3 / 3)
- Invented customers, amounts, or dates
- “Lost 850K” / “saved 540K”
- MISSED on 27 Sep
- Redesigning shell or Inspector
- Production edits under `app/` `lib/` `tests/`
