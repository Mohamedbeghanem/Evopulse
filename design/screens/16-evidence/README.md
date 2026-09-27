# 16 — Evidence

## SCREEN

Evidence. Business sources for a conclusion or agent step.

## USER QUESTION

What are the sources? Can I trust this?

## ROUTE

Target: `/evidence/:id` (FOCUSED) or Inspector “Evidence”.

Production today: `evidence_json` on exceptions, citations on `/ask`, node evidence on `/explore`. No dedicated route.

## PURPOSE

Feel like Sources in an AI search product, but the corpus is the business: messages, shipments, deadlines, commitments, policy rules, verification events.

Every important EvoPulse conclusion can expose this.

## PRIMARY OBJECT

Evidence pack (list of business sources).

## PRIMARY ACTION

Open a source (object, event, or policy).

## SECONDARY ACTIONS

Open Situation · copy citation later · expand an agent-trace step.

## DATA SOURCES

Exception `evidence_json` · event rows · ask citations · verification events · policy reasons.

## ENGINE OWNERS

Owning engine of the conclusion (Pulse, Ask, Causal, Verify). Evidence is a presentation contract, not a new engine.

## STATES

Listed · source selected · missing source · low confidence (shown in type, not color-only).

## EMPTY STATE

“No sources attached.” The conclusion should be visually weaker.

## ERROR STATE

“A source could not be opened.” Keep the rest of the pack.

## LOADING STATE

“Sources” header + 2 quiet rows.

## RELATED SCREENS

02 Command · 06 Situation · 07 Causal · 10 Autopilot · Agent trace (same language).

## INSPECTOR BEHAVIOR

Default home for Evidence. Full FOCUSED page when the operator is investigating a contested conclusion.

## COMMANDS THAT OPEN IT

`Show evidence` · `Show sources` · `Show the supplier message.`

### Agent trace (same visual language)

```
Inspecting business          done
Tracing dependencies         done
Simulating recovery          done
Checking policy              done
Executing safe action        done
Waiting for approval         current
```

Each step expands to this Evidence pack. Do not show raw logs.
