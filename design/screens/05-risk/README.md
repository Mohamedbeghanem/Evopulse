# 05 — Risk

## SCREEN

Risk. Associated value and timing while the clock has not necessarily missed.

## USER QUESTION

What is at risk, is it missed, and what cash or orders sit behind the number?

## ROUTE

Target: `/risk/:situationId` or Inspector “Impact” on a Situation.

Production today: `/impact/:exceptionId` for the Atlas delay.

## PURPOSE

Separate **AT RISK — NOT MISSED** from a miss. Show associated revenue, cash timing, and affected objects without a chart wall.

## PRIMARY OBJECT

Impact attached to a Situation (orders, invoices, cash timing).

## PRIMARY ACTION

View causal path / open affected Order.

## SECONDARY ACTIONS

Simulate another delay · protect affected orders · open Evidence.

## DATA SOURCES

`GET /api/exceptions/:id/impact` · `GET /api/graph/:entity/impact` · `lib/engine/impact.ts` · graph amounts (not hardcoded 850K / 540K).

## ENGINE OWNERS

`lib/engine/impact.ts` · `lib/graph/` · `lib/engine/supplier.ts` for the delay cascade.

## STATES

AT RISK — NOT MISSED · MISSED (temporal, on the expectation) · MONITORING · NEEDS YOU.

Do not add “high/medium/low” heat maps.

## EMPTY STATE

“No associated value stored.” Still show affected objects if the graph has them.

## ERROR STATE

“Impact could not be totaled.” Show object list without a currency if amounts fail.

## LOADING STATE

Muted “Associated” label. No ticking numbers.

## RELATED SCREENS

06 Situation · 07 Causal · 08 Simulation · 16 Evidence · 13 Graph.

## INSPECTOR BEHAVIOR

This screen often **is** the Inspector: 3 orders, 850K associated, 540K cash timing, [View causal path]. Full page only when the operator asks for the path or the full Situation.

## COMMANDS THAT OPEN IT

`Why is 850K at risk?` · `Show impact for Atlas` · `Show Order A.`
