# 08 — Simulation

## SCREEN

Simulation. Read-only what-if on a detached graph slice.

## USER QUESTION

What happens if Atlas is another 3 days late?

## ROUTE

Target: `/simulate` or `/situations/:id/simulate`

Production today: `/simulate` · `GET/POST /api/simulations`.

## PURPOSE

Let the operator see baseline vs simulated consequence before acting. Nothing is written. This is a contextual capability, never a sidebar module.

## PRIMARY OBJECT

A scenario (target entity + change + delta).

## PRIMARY ACTION

Run the scenario currently in the composer or inspector (`/simulate`).

## SECONDARY ACTIONS

Compare WHY paths · protect affected orders · discard (leave without write).

## DATA SOURCES

`lib/simulation/` snapshot of `lib/graph/` · content-hash proof of no writes.

## ENGINE OWNERS

`lib/simulation/engine.ts` · `propagate.ts` · `source.ts`. Policy is not applied until an Act is proposed.

## STATES

Idle · running (agent trace: simulating recovery) · compared · failed · discarded.

Use `--aurora-simulation` only as a quiet accent. Never green “success” for a worse delta.

## EMPTY STATE

Composer prompt: “What happens if…” Suggested: another 3 day delay on Atlas.

## ERROR STATE

“Simulation did not run. The twin was not changed.” 

## LOADING STATE

Agent trace step “Simulating recovery” with Evidence closed.

## RELATED SCREENS

06 Situation · 07 Causal · 09 Goals · 02 Command · 13 Graph.

## INSPECTOR BEHAVIOR

Inspector lists delta objects (orders, cash timing). Workspace is CANVAS (baseline vs sim).

## COMMANDS THAT OPEN IT

`Open Simulation` · `Simulate another 3 day delay` · `What happens if Atlas is another 3 days late?`
