# 14 — Policies

## SCREEN

Policies / Control. What is allowed.

## USER QUESTION

What rules govern action, and which rule just fired?

## ROUTE

Target: `/business/policies` (also sidebar “Policies / Control”)

Contextual: Inspector on a BLOCKED or NEEDS APPROVAL action.

Production today: `lib/engine/policy.ts` only. No screen.

## PURPOSE

Make governance visible without turning Control OS into an admin console. Each policy is a business source in Evidence.

## PRIMARY OBJECT

Policy rule (e.g. `discount_max=5%`, `external_message_requires_approval`).

## PRIMARY ACTION

Open the Situation or Action that last hit this rule.

## SECONDARY ACTIONS

Read the rule · (editing policies is out of Phase 0 visuals).

## DATA SOURCES

`lib/engine/policy.ts` · action `policy_outcome` / `reason` · events `policy.blocked`.

## ENGINE OWNERS

Policy engine. Execute and planners consume it; they do not own the copy.

## STATES

Allow (AUTO) · NEEDS APPROVAL · BLOCKED. These are outcomes, not a separate policy status system.

## EMPTY STATE

“No policies loaded.” Should not happen in the seed.

## ERROR STATE

“Policy could not be evaluated.” Block the Act; do not default to AUTO.

## LOADING STATE

Rule name first, then last outcome.

## RELATED SCREENS

11 Approvals · 10 Autopilot · 06 Situation · 16 Evidence.

## INSPECTOR BEHAVIOR

On a blocked act, Inspector **is** the policy: rule, reason, alternative. Full page is the catalog.

## COMMANDS THAT OPEN IT

`Show policies` · `Why was 10% blocked?` · `Open Control.`
