# 09 — Goals

## SCREEN

Goals. Outcomes we protect or pursue.

## USER QUESTION

What outcomes are we protecting, and what plan addresses them?

## ROUTE

Target: `/goals` · `/goals/:id`

Production today: the same routes + `GET/POST /api/goals`.

## PURPOSE

Turn “Protect everything at risk this week” into a structured goal and a governed plan. Goals are a primary destination; plans are not.

## PRIMARY OBJECT

Goal (then its Plan and Actions).

## PRIMARY ACTION

Open the goal that is AT RISK, or create from Command.

## SECONDARY ACTIONS

Generate plan · execute safe · send remaining actions to approval · inspect affected domains.

## DATA SOURCES

`lib/goals/` · Pulse risks · graph impact · policy decisions on each action.

## ENGINE OWNERS

`lib/goals/service.ts` · `planner.ts` · `interpret.ts` · `execute-safe.ts` · policy.

## STATES

Goal: DRAFT · ACTIVE · AT RISK · COMPLETED · CANCELLED (existing engine).

Actions still surface as NEEDS APPROVAL / BLOCKED / HANDLED in OS language.

## EMPTY STATE

“No goals yet.” Composer suggestion: `Protect everything at risk this week.`

## ERROR STATE

“The goal could not be planned.” Show the objective; do not invent actions.

## LOADING STATE

Goal identity first. Plan actions skeleton after.

## RELATED SCREENS

01 Pulse · 02 Command · 10 Autopilot · 11 Approvals · 14 Policies.

## INSPECTOR BEHAVIOR

Selecting an action → Inspector (policy reason, expected impact). Goal page stays.

## COMMANDS THAT OPEN IT

`Open Goals` · `Protect everything at risk this week.` · `Show cash timing goal.`
