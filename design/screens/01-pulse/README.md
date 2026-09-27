# 01 — Pulse

## SCREEN

Pulse. The home of the Business Control OS. Not a dashboard, CRM home, activity feed, or chat product.

## USER QUESTION

What needs my attention?

## ROUTE

Target: `/`

Artifact: `pulse.html`

Open via `file://` from the repo, or serve the repo / `design/` root so `../../AURORA_TOKENS.css` and `../00-shell/os.css` resolve. Do not serve only this folder.

## PURPOSE

Give the operator one prioritized view of business situations requiring awareness or intervention. In five seconds they should know the business is running, where they are needed, why, and what EvoPulse can do.

## PRIMARY OBJECT

Situation / AttentionItem. One business situation = one top-level Pulse item.

## DATA SOURCE

`lib/attention` (`projectAttention`) — canonical projection on `cursor/final-integration-hardening-e6b9`.

This artifact is a **static projection** of that model. It does not call production APIs and does not change engines.

### Snapshot used

After `triggerSupplierDelay()`, before recovery execute and before the 10% message.

| Item | Classification | Why this snapshot |
| --- | --- | --- |
| Atlas Supply / SH-204 | `NEEDS_YOU` | Warning + exception + impact fold to one situation |
| 320,000 DZD proposal | `NEEDS_APPROVAL` | Plan exists; customer-facing send is `APPROVAL_REQUIRED` |
| 10% discount | *not on Pulse* | Surfaces only after `Later message: 10%`, as `BLOCKED`. Not fabricated here |
| Monitoring | none | Order A buffer is a layer under Atlas, not a second card |
| Handled | none | Nothing is verified yet. Execute ≠ handled |

Hero counts follow that projection: **2 need you · 0 monitoring · 0 handled automatically**.

### Canonical values (verified)

- Atlas title (exception): `Supplier delay — SH-204 Monday → Wednesday`
- Atlas impact: **3 orders · 3 customers · 850,000 DZD associated revenue · 540,000 DZD expected cash timing**
- Orders: Oran Fresh 320,000 · Constantine Clinic 280,000 · Sétif Depot 250,000
- Causal chain: Atlas Supply → SH-204 → RK-7 → 3 orders → 3 customers
- Buffer (Order A, after delay): available **−23h** · required **18h** · shortfall **−41h** (`lib/warnings` defaults 6+4+8 hours). **Not** the stale 23h / 18h / 5h example
- Clock: `2026-09-27T09:14:00+01:00`
- 320K title: `Our commitment missed — revised proposal never sent`
- 320K amount: **320,000 DZD** associated
- Prepared: proposal · draft follow-up · Monday 28 Sep 10:00 checkpoint
- 10% (not shown): requested 10% · `discount_max = 5%` · alternatives 5% or Net-14

850,000 is **associated revenue**. Never lost / saved.

## PRIMARY ACTION

Review situation (Atlas → future Situation / Why. 320K → Review & approve).

## SECONDARY ACTIONS

Simulate · Evidence · Approve where appropriate · Composer command (`⌘K`)

## STATES

`NEEDS_YOU` · `NEEDS_APPROVAL` · `MONITORING` · `BLOCKED` · `HANDLED`

Secondary: `AT RISK — NOT MISSED`

Verification law: `EXECUTED` → `VERIFYING` / `MONITORING` (`verifications.status = PENDING`) → `HANDLED` only after `SUCCESS`.

## EMPTY STATE

Monitoring and Handled stay visible and quiet when the projection has no items. Do not invent situations for density.

## ERROR STATE

Not bound in this artifact. Production: “Pulse could not be read.”

## LOADING STATE

Not bound. Title + muted line would remain.

## RELATED SCREENS

00 Shell · 02 Command (not built this phase) · 06 Situation / Why · 08 Simulation · 16 Evidence

## INSPECTOR BEHAVIOR

Click **850,000 DZD associated** or **540,000 DZD** → Inspector IMPACT (orders, customers, cash, View causal path). Evidence can open Inspector + a short sheet. Workspace stays on Pulse.

## COMMANDS THAT OPEN IT

`Open Pulse` · `What needs me?` · `What changed today?` · `What am I about to miss?`

## VISUAL RULES

- Dark Aurora on locked Control OS chrome
- Status sentence, not four KPI cards
- Composer is an operating input, not the product
- NEEDS YOU dominates. Monitoring quieter. Handled almost disappears
- Structured rows and hairlines. No card disease
- Orange only for attention / primary action
- Engine names stay out of the main presentation

## PRODUCTION CODE

None modified. `app/` and `lib/` are untouched.
