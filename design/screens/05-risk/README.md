# 05 — Risk

## SCREEN

Risk. Associated value and timing.

## USER QUESTION

What is at risk, is it missed, what cash or orders sit behind the number?

## ROUTE

`/risk/:id` or Inspector Impact. Production `/impact/:exceptionId`.

## PURPOSE

AT RISK — NOT MISSED vs miss. Graph-sourced amounts only.

## PRIMARY OBJECT

Impact on a Situation.

## PRIMARY ACTION

View causal path / open affected Order.

## SECONDARY ACTIONS

Simulate · Protect orders · Evidence.

## DATA SOURCES

calculateGraphImpact · graph node amounts. No hardcoded 850K / 540K in product.

## ENGINE OWNERS

Impact · Graph.

## STATES

AT RISK — NOT MISSED · MISSED · MONITORING · NEEDS YOU.

## EMPTY STATE

No associated value stored. Still list objects.

## ERROR STATE

Impact could not be totaled.

## LOADING STATE

Muted Associated label.

## RELATED SCREENS

04 · 07 · 08 · 18 · 15.

## INSPECTOR BEHAVIOR

Often IS the Inspector.

## COMMANDS THAT OPEN IT

`Why is 850K at risk?` · `Show impact for Atlas`
