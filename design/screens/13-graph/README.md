# 13 — Graph

## SCREEN

Business Graph canvas. How objects connect.

## USER QUESTION

What is connected to this object, and which way does impact travel?

## ROUTE

Target: `/business/graph` (local Business nav)

Production today: `/graph`.

## PURPOSE

CANVAS for relationships. Not a sidebar destination. Opened from Business or from “Open full graph” on a causal path.

## PRIMARY OBJECT

Graph (nodes + edges), focused on a selected entity when provided.

## PRIMARY ACTION

Select a node to inspect.

## SECONDARY ACTIONS

Dependencies · downstream impact · open Causal · open Object.

## DATA SOURCES

`GET /api/graph/:entity` · `/:entity/dependencies` · `/:entity/impact` · `lib/graph/`.

## ENGINE OWNERS

`lib/graph/repository.ts` · `traverse.ts` · `lib/engine/graph.ts`.

## STATES

Overview · focused entity · empty graph · too-large (progressive disclosure, not 2,000 nodes at once).

## EMPTY STATE

“No relationships stored for this object.”

## ERROR STATE

“Graph could not be read.”

## LOADING STATE

CANVAS with a faint lattice. No force-layout circus.

## RELATED SCREENS

12 Twin · 07 Causal · 05 Risk · Object view.

## INSPECTOR BEHAVIOR

Selected node: type, state, neighbors, [Open full view], [View causal path].

## COMMANDS THAT OPEN IT

`Open Graph` · `Show graph for Atlas` · `Show what Atlas supplies.`
