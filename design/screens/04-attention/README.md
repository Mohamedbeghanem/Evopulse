# 04 — Attention

## SCREEN

Attention queue. The full list of Situations Pulse summarizes.

## USER QUESTION

What is in the queue, and what can wait?

## ROUTE

Target: `/situations`

Not a primary sidebar item. Opened from Pulse (“All situations”) or Command.

Production today: no dedicated route; Pulse inlines the list.

## PURPOSE

Let an operator triage without turning Pulse into a registry. Group by operational state, not by engine.

## PRIMARY OBJECT

Situation.

## PRIMARY ACTION

Open the next NEEDS YOU Situation.

## SECONDARY ACTIONS

Filter by state · sort by associated value · ask “What needs me?” · assign / snooze later (out of Phase 0).

## DATA SOURCES

Same exception + impact payload as Pulse. `GET /api/exceptions` · `GET /api/pulse`.

## ENGINE OWNERS

`lib/engine/pulse.ts` · matcher · policy (for NEEDS APPROVAL / BLOCKED).

## STATES

NEEDS YOU · NEEDS APPROVAL · MONITORING · BLOCKED · HANDLED (HANDLED is a quiet archive, not the default filter).

## EMPTY STATE

“Nothing needs you.” Return to Pulse empty.

## ERROR STATE

Same as Pulse. Do not show a partial queue as complete.

## LOADING STATE

State headers + placeholder rows.

## RELATED SCREENS

01 Pulse · 06 Situation · 05 Risk · 11 Approvals.

## INSPECTOR BEHAVIOR

Row focus may preview impact in the Inspector. Enter / title click opens the Situation page.

## COMMANDS THAT OPEN IT

`What needs me?` · `Show all situations` · `Show approvals waiting.`
