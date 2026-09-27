# 10 — Autopilot

## SCREEN

Autopilot. Safe actions EvoPulse can run without a human.

## USER QUESTION

What can run without me, and what already did?

## ROUTE

Contextual only. No primary nav.

Target: Inspector tab or `/situations/:id` disclosure. Optional later: `/control/autopilot`.

Production today: `execute-safe` on plans (`POST /api/plans/:id/execute-safe`). No screen.

## PURPOSE

Show AUTO policy outcomes as a calm capability, not a robot dashboard. Pair every run with Evidence and Verification.

## PRIMARY OBJECT

Action with policy `AUTO` (safe-execute).

## PRIMARY ACTION

Execute safe (or review what already ran).

## SECONDARY ACTIONS

Open policy · undo is not implied · jump to verification · promote to approval if policy changes.

## DATA SOURCES

Plan actions · `lib/goals/execute-safe.ts` · `lib/engine/execute.ts` · policy · verification.

## ENGINE OWNERS

Policy · execute-safe · verification (`lib/learning/verification.ts`) · outcome ledger.

## STATES

Eligible · running · verified · failed verification → NEEDS YOU. Never a free-floating “AUTOPILOT ON” brand switch in Phase 0.

## EMPTY STATE

“Nothing is safe to run alone.” Point at NEEDS APPROVAL.

## ERROR STATE

“Safe execute did not run. Policy was rechecked.” Show the new outcome.

## LOADING STATE

Agent trace: “Executing safe action.”

## RELATED SCREENS

11 Approvals · 14 Policies · 09 Goals · 16 Evidence · 15 Learning.

## INSPECTOR BEHAVIOR

Preferred home. Full page only for an audit of many AUTO actions.

## COMMANDS THAT OPEN IT

`What can you do without me?` · `Execute safe actions` · `Show autopilot for this plan.`
