# 15 — Graph

## SCREEN

Business Graph canvas.

## USER QUESTION

What is connected, and which way does impact travel?

## ROUTE

`/business/graph`. Production `/graph`.

## PURPOSE

Full topology. Same graph_nodes / graph_edges as Causal. No Neo4j.

## PRIMARY OBJECT

Graph, optionally focused.

## PRIMARY ACTION

Select a node.

## SECONDARY ACTIONS

Dependencies · impact · Causal · Object.

## DATA SOURCES

lib/graph GET endpoints.

## ENGINE OWNERS

Graph.

## STATES

Overview · focused · empty · too-large (disclose).

## EMPTY STATE

No relationships stored.

## ERROR STATE

Graph could not be read.

## LOADING STATE

Faint lattice.

## RELATED SCREENS

13 · 07 · 05 · 14.

## INSPECTOR BEHAVIOR

Selected node details.

## COMMANDS THAT OPEN IT

`Open Graph` · `Show graph for Atlas`
