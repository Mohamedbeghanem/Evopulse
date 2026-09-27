# 03 — Timeline

## SCREEN

Timeline. The business time machine.

## USER QUESTION

What happened, what is happening, what comes next?

## ROUTE

Target: `/timeline`

Production today: `/timeline` + `GET /api/timeline`.

## PURPOSE

Show Past / Now / Future as one operational tape. Events, expectations, and handled situations live here so Pulse can stay about attention.

## PRIMARY OBJECT

Event (and the Expectation or Situation it belongs to).

## PRIMARY ACTION

Open the object or Situation attached to an event.

## SECONDARY ACTIONS

Filter by object · jump to a clock time · replay (operator / demo, not a primary customer verb) · ask “what changed today.”

## DATA SOURCES

`GET /api/timeline` · `lib/events/` · `lib/engine/timeline.ts` · expectations · verifications.

## ENGINE OWNERS

`lib/engine/timeline.ts` · `lib/events/service.ts` · clock (`lib/clock.ts`).

## STATES

Past · Now · Future. Rows inherit Situation state when linked (NEEDS YOU, HANDLED, …).

## EMPTY STATE

“Nothing on the tape for this scope.” Composer: `Show me what changed today.`

## ERROR STATE

“Timeline could not be read.” Keep Pulse reachable.

## LOADING STATE

Three quiet lane labels. No animated clock.

## RELATED SCREENS

01 Pulse · 06 Situation · 12 Twin · 16 Evidence · 15 Learning (outcomes after HANDLED).

## INSPECTOR BEHAVIOR

Click an entity on a row → Inspector. Click the event title if it is a Situation → full page.

## COMMANDS THAT OPEN IT

`Open Timeline` · `Show me what changed today.` · `What happens next for Atlas?`
