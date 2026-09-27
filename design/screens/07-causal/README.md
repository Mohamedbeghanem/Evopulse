# 07 — Causal

## SCREEN

Causal Explorer. Reached through Why?

## USER QUESTION

Why did this happen, and what does it touch?

## ROUTE

`/causal/:id`. Production `/explore`. Not a sidebar item.

## PURPOSE

CAUSE → EVENT → DEPENDENCY → CONSEQUENCE. Legacy 02 KEEP: layers, node anatomy, path, inspector.

## PRIMARY OBJECT

A path rooted at a Situation or Entity.

## PRIMARY ACTION

Select a node for source / evidence / confidence.

## SECONDARY ACTIONS

Generate plan · See on timeline · Replay / Simulate.

## DATA SOURCES

causal.ts · graph GET · calculateGraphImpact.

## ENGINE OWNERS

Graph + Impact. Detect for p. Events for BANK.

## STATES

Path ready · node selected · no path.

## EMPTY STATE

No causal path stored.

## ERROR STATE

Path could not be traced.

## LOADING STATE

CANVAS skeleton. Compute stamp when ready.

## RELATED SCREENS

04 · 05 · 08 · 15 · 18.

## INSPECTOR BEHAVIOR

Selected node: CAUSED BY / AFFECTS / evidence chips.

## COMMANDS THAT OPEN IT

`Why?` · `What else does this delay touch?`
