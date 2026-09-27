# 15 — Learning

## SCREEN

Learning. What we learned from outcomes.

## USER QUESTION

What have we learned, and what should we not repeat?

## ROUTE

Target: `/business/learning` (local Business nav)

Not in the primary sidebar.

Production today: `lib/learning/` + `/api/outcomes` · `/api/verifications` · `/api/learning/strategies`. No dedicated UI.

## PURPOSE

Show strategy memory and verified outcomes as a quiet ledger. Learning must not train on simulated rows.

## PRIMARY OBJECT

Outcome / strategy memory row.

## PRIMARY ACTION

Open the originating Situation or Evidence pack.

## SECONDARY ACTIONS

Filter by domain · exclude simulations (default on).

## DATA SOURCES

`lib/learning/outcomes.ts` · `verification.ts` · `strategy-memory.ts` · `confidence.ts`.

## ENGINE OWNERS

Learning package. Verification writes; Pulse does not learn on its own.

## STATES

Verified · expired · failed verification · excluded (simulation). Not a sixth operational status.

## EMPTY STATE

“No verified outcomes yet.” Point at Timeline.

## ERROR STATE

“Learning could not be read.” Do not invent confidence.

## LOADING STATE

Ledger rows, muted.

## RELATED SCREENS

03 Timeline · 16 Evidence · 10 Autopilot · 12 Twin.

## INSPECTOR BEHAVIOR

Row → Inspector (confidence, source situation, “simulation excluded” if relevant).

## COMMANDS THAT OPEN IT

`What did we learn?` · `Show strategies` · `Show verification for the recovery.`
