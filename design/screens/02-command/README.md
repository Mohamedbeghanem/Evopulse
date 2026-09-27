# 02 — Command

## SCREEN

Command. Universal ask / search / operate surface.

## USER QUESTION

What can I ask, find, or do without walking six modules?

## ROUTE

Target: `/command` (full FOCUSED workspace) and the `⌘K` overlay (any screen).

Production today: `/command` (`app/command/page.tsx`) + `POST /api/ask`.

## PURPOSE

Make the input part of navigation. Infer ASK, SEARCH, NAVIGATE, ACT. Ground answers in business objects and evidence.

## PRIMARY OBJECT

A command (query + inferred intent + result). Results may be Situations, Objects, Goals, or an Act preview.

## PRIMARY ACTION

Submit natural language (or `/ask` `/search` `/simulate` `/act`).

## SECONDARY ACTIONS

Open a grouped hit · attach later · jump to Simulation · send an Act to approval.

## DATA SOURCES

`POST /api/ask` · Pulse · Graph · Goals · Events · Policy outcomes. Search index of entities + situations (not built as a new engine in this phase).

## ENGINE OWNERS

`lib/engine/ask.ts` · Goals planner (`lib/goals/`) for ACT · Simulation (`lib/simulation/`) when intent is `/simulate` · Policy (`lib/engine/policy.ts`) before any Act.

## STATES

Idle composer · inferring intent · streamed / returned answer · grouped search · act preview (NEEDS APPROVAL / BLOCKED) · no results.

## EMPTY STATE

Sentence + composer + a short list of suggested commands (business, not trivia).

## ERROR STATE

“EvoPulse could not ground that.” Offer Search or Pulse. Never fabricate impact.

## LOADING STATE

Agent trace steps (inspecting, tracing, checking policy) — not a raw spinner. See 16 Evidence / agent trace.

## RELATED SCREENS

00 Shell overlay · 01 Pulse · 06 Situation · 08 Simulation · 09 Goals · 16 Evidence.

## INSPECTOR BEHAVIOR

Selecting a search hit (Atlas Supply) opens Inspector on top of Command. “Open full view” leaves Command.

## COMMANDS THAT OPEN IT

`⌘K` · `Open Command` · `Why is 850K at risk?` · `Show Order A.` · `Protect everything at risk this week.`
