# 02 — Command

## SCREEN

Command. Universal ask / search / operate. Elevated legacy “Ask your business…”

## USER QUESTION

What can I ask, find, simulate, or do without six modules?

## ROUTE

`/command` + ⌘K overlay. Production `/command` + `POST /api/ask`.

## PURPOSE

ASK · SEARCH · NAVIGATE · SIMULATE · ACT. Must not bypass Policy.

## PRIMARY OBJECT

A command (query + intent + result).

## PRIMARY ACTION

Submit natural language (or /ask /search /simulate /act).

## SECONDARY ACTIONS

Open a hit · jump to Simulation · send Act to approval.

## DATA SOURCES

`POST /api/ask` · Pulse · Graph · Goals · Events · Policy.

## ENGINE OWNERS

Control (`ask.ts`, goals planner, policy) · Simulation when /simulate.

## STATES

Idle · inferring · answer · grouped search · act preview · no results.

## EMPTY STATE

Ask your business… + suggested operational commands.

## ERROR STATE

Could not ground that. Offer Search or Pulse. Never fabricate impact.

## LOADING STATE

Agent trace steps — not a raw spinner.

## RELATED SCREENS

00 overlay · 01 Pulse · 04 Situation · 08 Simulation · 09 Goals · 18 Evidence.

## INSPECTOR BEHAVIOR

Search hit opens Inspector on Command.

## COMMANDS THAT OPEN IT

`⌘K` · `Why is Friday's cash at risk?` · `Open Atlas Supply.` · `Protect everything at risk this week.`
