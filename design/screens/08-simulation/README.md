# 08 — Simulation

## SCREEN

Simulation. Read-only what-if.

## USER QUESTION

What happens if Atlas is another 3 days late?

## ROUTE

`/simulate` or situation simulate. Production `/simulate`.

## PURPOSE

Baseline vs simulated. Same graph. No writes. Contextual.

## PRIMARY OBJECT

A scenario.

## PRIMARY ACTION

Run the scenario.

## SECONDARY ACTIONS

Compare WHY paths · protect orders · discard.

## DATA SOURCES

lib/simulation/ snapshot of lib/graph/.

## ENGINE OWNERS

Impact consumed by simulation. Policy not applied until Act.

## STATES

Idle · running · compared · discarded.

## EMPTY STATE

What happens if…

## ERROR STATE

Simulation did not run. Twin unchanged.

## LOADING STATE

Simulating recovery.

## RELATED SCREENS

04 · 07 · 09 · 03.

## INSPECTOR BEHAVIOR

Delta objects. Workspace CANVAS.

## COMMANDS THAT OPEN IT

`Simulate another 3 day delay` · `What if Atlas is another 3 days late?`
