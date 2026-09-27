# 01 — Pulse

## SCREEN

Pulse. Attention home. Not a dashboard. Not Twin-as-home.

## USER QUESTION

What needs me?

## ROUTE

Target `/`. Production `/` (`app/page.tsx`). Do not design cards in this phase.

## PURPOSE

Surface Situations. Briefing voice from legacy Twin KEEP: “2 decisions need you” is Detect, not a health score.

## PRIMARY OBJECT

Situation.

## PRIMARY ACTION

Open the Situation that most needs the operator.

## SECONDARY ACTIONS

Ask your business · Why? · Review / Open plan · Today scope.

## DATA SOURCES

`GET /api/pulse` · pulseSummary · Twin headlines · exception attention · Impact amounts (not hardcoded).

## ENGINE OWNERS

Detect (`lib/engine/pulse.ts`, matcher) · Twin consume · Events for handled slice.

## STATES

NEEDS YOU · NEEDS APPROVAL · MONITORING · BLOCKED · HANDLED. Secondary: AT RISK — NOT MISSED.

## EMPTY STATE

Pulse / Your business is running. Composer remains.

## ERROR STATE

Pulse could not be read. No stale impact as current.

## LOADING STATE

Title + muted line. Quiet rows. No throbbing money.

## RELATED SCREENS

04 Situation · 05 Risk · 02 Command · 09 Goals · 03 Timeline · 07 Causal.

## INSPECTOR BEHAVIOR

Click company/amount → Inspector. Title → Situation page.

## COMMANDS THAT OPEN IT

`Open Pulse` · `What needs me?` · `Show me what changed today.`
