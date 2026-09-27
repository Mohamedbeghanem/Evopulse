# 11 — Approvals

## SCREEN

Approvals. Human gates on governed action.

## USER QUESTION

What is waiting on a person?

## ROUTE

Contextual. Target: `/approvals` as a filtered Attention view, or Inspector on a plan.

Not in the primary sidebar.

Production today: approve buttons on `/exceptions/:id/plan` and plan/action API routes.

## PURPOSE

Make NEEDS APPROVAL a first-class state without a sixth module. The operator sees what EvoPulse will do, why policy stopped short, and the evidence.

## PRIMARY OBJECT

Action (or Plan) with `APPROVAL_REQUIRED`.

## PRIMARY ACTION

Approve & execute — or reject / choose the alternative.

## SECONDARY ACTIONS

Open policy · edit is out of scope unless the engine supports an alternative (5% / Net-14) · view Evidence.

## DATA SOURCES

`POST /api/plans/:id/approve` · `POST /api/plans/:id/actions/:actionId/approve` · policy reasons · impact.

## ENGINE OWNERS

`lib/engine/policy.ts` · `lib/engine/execute.ts` · recovery planner · goals planner.

## STATES

NEEDS APPROVAL · BLOCKED (cannot approve this act) · HANDLED after execute.

## EMPTY STATE

“Nothing is waiting on you.” Pulse empty.

## ERROR STATE

“Approval did not apply. State may have changed.” Reload the Situation.

## LOADING STATE

The action stays visible. Button shows “Applying policy…” not a blank page.

## RELATED SCREENS

06 Situation · 10 Autopilot · 14 Policies · 04 Attention · 09 Goals.

## INSPECTOR BEHAVIOR

Approve can happen from Inspector on a Situation. Deep review uses the Situation page.

## COMMANDS THAT OPEN IT

`What needs approval?` · `Show the 10% block` · `Approve recovery for Atlas.`
