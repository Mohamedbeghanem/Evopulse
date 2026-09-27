# 17 — Learning

## SCREEN

Learning. Verified outcomes.

## USER QUESTION

What have we learned, and what should we not repeat?

## ROUTE

`/business/learning`. Production APIs, no UI.

## PURPOSE

Strategy memory. Must not train on simulated rows.

## PRIMARY OBJECT

Outcome / strategy row.

## PRIMARY ACTION

Open originating Situation / Evidence.

## SECONDARY ACTIONS

Exclude simulations (default on).

## DATA SOURCES

lib/learning/*.

## ENGINE OWNERS

Control P16–P17.

## STATES

Verified · expired · failed · excluded (simulation).

## EMPTY STATE

No verified outcomes yet.

## ERROR STATE

Learning could not be read.

## LOADING STATE

Ledger rows.

## RELATED SCREENS

03 · 19 · 18 · 13.

## INSPECTOR BEHAVIOR

Row → confidence + source.

## COMMANDS THAT OPEN IT

`What did we learn?`
