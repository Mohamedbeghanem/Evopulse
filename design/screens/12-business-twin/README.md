# 12 — Business Twin

## SCREEN

Business Twin overview. The living model of the company.

## USER QUESTION

How is the business holding, across domains?

## ROUTE

Target: `/business`

Local Business nav: Overview · Entities · Graph · Policies · Learning.

Production today: twin domain chips on Pulse (`lib/engine/twin.ts`). No `/business` page.

## PURPOSE

Give the Business destination a home that is not Graph and not Pulse. Domain headlines (sales, cash, supply, …) without becoming an analytics suite.

## PRIMARY OBJECT

The Twin (domains + notable objects).

## PRIMARY ACTION

Open the domain or object that is at risk.

## SECONDARY ACTIONS

Browse entities · open Graph · ask “Show Atlas Supply.”

## DATA SOURCES

`GET /api/business-state` · `businessTwin` · graph node counts · Pulse domain status.

## ENGINE OWNERS

`lib/engine/twin.ts` · `lib/graph/` · Pulse for attention overlay.

## STATES

Domain status stays in OS language: AT RISK — NOT MISSED, NEEDS YOU, MONITORING, HANDLED. Production also has STABLE / ATTENTION — map STABLE to quiet, ATTENTION to NEEDS YOU.

## EMPTY STATE

Should not happen on a seeded twin. If no domains: “Twin has no domains yet.”

## ERROR STATE

“Twin could not be derived.” Pulse remains available.

## LOADING STATE

Five quiet domain rows. No gauges.

## RELATED SCREENS

13 Graph · 01 Pulse · Object view · 14 Policies · 15 Learning.

## INSPECTOR BEHAVIOR

Click a company or domain object → Inspector. Overview stays.

## COMMANDS THAT OPEN IT

`Open Business` · `Show the twin` · `Open Atlas Supply.`
