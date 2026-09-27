# 06 — Exceptions (Situation view)

## SCREEN

Situation. The most important UI primitive. Product language is **Situation**, not “exception.”

The folder keeps `exceptions` to match the current engine and route family.

## USER QUESTION

What changed, why it matters, what it affects, and what needs me?

## ROUTE

Target: `/situations/:id`

Production today: `/exceptions/:id` and `/exceptions/:id/plan`.

## PURPOSE

One attention object, fully told, with progressive disclosure into engines the user should not have to name.

Order:

1. What changed
2. Why it matters
3. What it affects
4. What EvoPulse recommends
5. What EvoPulse can do
6. What needs you
7. Evidence

## PRIMARY OBJECT

Situation.

## PRIMARY ACTION

The one thing that moves the Situation (approve, simulate, protect, acknowledge). Contextual — not a toolbar of engines.

## SECONDARY ACTIONS

Open Graph · Simulate · View policy · View plan · Open object · Trace.

## DATA SOURCES

`GET /api/exceptions/:id` · impact · plan · policy · evidence_json · graph neighbors.

## ENGINE OWNERS

`lib/engine/pulse.ts` (serialize) · impact · recovery / planner · policy · execute · verification.

## STATES

NEEDS YOU · NEEDS APPROVAL · MONITORING · BLOCKED · HANDLED.

Plus AT RISK — NOT MISSED when the expectation is still inside the clock.

## EMPTY STATE

A Situation without impact still has “what changed.” Omit empty sections (no fake graph).

## ERROR STATE

“This situation could not be opened.” Link Pulse.

## LOADING STATE

Identity + state phrase first. Sections appear as they resolve.

## RELATED SCREENS

01 Pulse · 05 Risk · 07 Causal · 08 Simulation · 10 Autopilot · 11 Approvals · 14 Policies · 16 Evidence.

## INSPECTOR BEHAVIOR

Inspector shows the clicked object or evidence item. The Situation page stays the workspace.

## COMMANDS THAT OPEN IT

`Show Atlas delay` · `Open the 320K recovery` · `Why is Atlas at risk?`
