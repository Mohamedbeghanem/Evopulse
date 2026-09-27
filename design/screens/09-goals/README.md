# 09 — Goals

## SCREEN

Goals. Outcomes we protect.

## USER QUESTION

What outcomes are we protecting, and what plan addresses them?

## ROUTE

`/goals` · `/goals/:id`. Production same.

## PURPOSE

Turn “Protect everything at risk this week” into a governed goal.

## PRIMARY OBJECT

Goal.

## PRIMARY ACTION

Open the AT RISK goal or create from Command.

## SECONDARY ACTIONS

Generate plan · execute safe · approvals.

## DATA SOURCES

lib/goals/ · Pulse risks · graph impact · policy.

## ENGINE OWNERS

Control.

## STATES

DRAFT · ACTIVE · AT RISK · COMPLETED · CANCELLED. Actions: AUTO / APPROVAL_REQUIRED / BLOCKED.

## EMPTY STATE

No goals yet. Suggested command.

## ERROR STATE

Could not plan. Do not invent actions.

## LOADING STATE

Goal identity first.

## RELATED SCREENS

10 · 11 · 12 · 16 · 02.

## INSPECTOR BEHAVIOR

Action → policy reason.

## COMMANDS THAT OPEN IT

`Protect everything at risk this week.` · `Keep Friday's cash above the floor.`
