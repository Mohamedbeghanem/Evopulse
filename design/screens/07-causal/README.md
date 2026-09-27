# 07 — Causal

## SCREEN

Causal workspace. Why, along the Business Graph.

## USER QUESTION

Why did this happen, and what does it touch?

## ROUTE

Target: `/causal/:id`

Production today: `/explore`.

## PURPOSE

Show cause → event → dependency → consequence without teaching graph theory. Opened from “Why?” or “View causal path,” not from the sidebar.

## PRIMARY OBJECT

A path (nodes + edges) rooted at a Situation or Entity.

## PRIMARY ACTION

Select a node to see source, evidence, timestamp, confidence.

## SECONDARY ACTIONS

Open Object · Simulate from a node · Open Situation · Zoom to full Graph.

## DATA SOURCES

`lib/engine/causal.ts` · `GET /api/graph/:entity` · dependencies · impact.

## ENGINE OWNERS

`lib/engine/causal.ts` · `lib/graph/traverse.ts` · impact for totals on the path.

## STATES

Path ready · node selected · no path (isolated object) · stale (event replayed).

The Situation’s operational state is inherited, not restated as a sixth status.

## EMPTY STATE

“No causal path stored. Open the object or the graph.”

## ERROR STATE

“The path could not be traced.” Fall back to the Situation page.

## LOADING STATE

CANVAS with a quiet skeleton path. No physics animation required.

## RELATED SCREENS

06 Situation · 05 Risk · 13 Graph · 08 Simulation · 16 Evidence.

## INSPECTOR BEHAVIOR

Selected node → Inspector (source, evidence, timestamp, confidence). Workspace keeps the path.

## COMMANDS THAT OPEN IT

`Why?` · `View causal path` · `Show why Atlas is late.`
