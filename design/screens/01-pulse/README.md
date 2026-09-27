# 01 — Pulse

## SCREEN

Pulse. The home of attention. Not a dashboard of charts.

## USER QUESTION

What needs me?

## ROUTE

Target: `/`

Production today: `/` (`app/page.tsx`). Do not redesign cards in this phase.

## PURPOSE

Surface Situations that require a human. Answer whether the business is running or something is at risk. Hand the user one primary object to open.

## PRIMARY OBJECT

Situation (one or many). Pulse is a list of attention objects, not a KPI board.

## PRIMARY ACTION

Open the Situation that most needs the operator.

## SECONDARY ACTIONS

Ask from the composer · change time scope (Today) · open Command · jump to a related Goal.

## DATA SOURCES

`GET /api/pulse` · `pulseSummary` · Business Twin domain headlines · exception attention counts · associated impact currency.

## ENGINE OWNERS

`lib/engine/pulse.ts` · `lib/engine/twin.ts` · `lib/engine/matcher.ts` (detection only).

## STATES

NEEDS YOU · NEEDS APPROVAL · MONITORING · BLOCKED · HANDLED.

Secondary: AT RISK — NOT MISSED.

Production still emits HEALTHY; Control OS treats that as “nothing needs you.”

## EMPTY STATE

Header: “Pulse” / “Your business is running.” No critical rows. Composer remains. Do not invent charts to fill space.

## ERROR STATE

“Pulse could not be read.” Retry. Do not show stale impact as current.

## LOADING STATE

Title + muted line. Two quiet placeholder rows. No throb on money.

## RELATED SCREENS

06 Exceptions / Situation · 04 Attention queue · 05 Risk · 02 Command · 09 Goals · 03 Timeline.

## INSPECTOR BEHAVIOR

Click a company, amount, or shipment on a row → Inspector. Click the Situation title → full Situation page.

## COMMANDS THAT OPEN IT

`Open Pulse` · `What needs me?` · `Show me what changed today.`
