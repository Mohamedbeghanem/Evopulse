# 00 — Shell

## SCREEN

Persistent Control OS chrome. Sidebar + workspace + optional inspector + universal command.

This is the only screen visually designed in Phase 0. It validates architecture, not Pulse cards.

## USER QUESTION

Where am I? How do I ask EvoPulse anything? How do I stay in context while I inspect something?

## ROUTE

Persistent. Wraps every destination.

Artifacts: `shell.html` · `command-overlay.html` · `inspector.html`

## PURPOSE

Hide architectural complexity. Present five destinations. Make Command and the Inspector the ways depth appears.

## PRIMARY OBJECT

The operating session (who is acting, which destination is active, whether Command or Inspector is open).

## PRIMARY ACTION

Navigate Pulse / Command / Timeline / Business / Goals, or invoke Command (`⌘K` / composer).

## SECONDARY ACTIONS

Open Inspector · close overlays with Escape · collapse sidebar at 1024 · open Settings / Policies / User.

## DATA SOURCES

Not bound to an engine. Chrome may later read a Pulse count and the signed-in operator. No production binding in this phase.

## ENGINE OWNERS

None. Shell is presentation. Future: Pulse count badge (read-only from `lib/engine/pulse.ts`) without listing exceptions in the rail.

## STATES

| State | Chrome |
| --- | --- |
| Default | Sidebar + workspace. Inspector closed. Command closed. |
| Command open | Overlay over the same shell. Focus in the field. |
| Inspector open | 360px rail. Workspace compresses. |
| Sidebar collapsed | 1024 only. |
| Offline / demo | No marketing banners. Demo controls stay out of this foundation. |

## EMPTY STATE

Workspace shows the destination empty contract. Shell itself is never empty: wordmark, nav, composer affordance remain.

## ERROR STATE

Shell does not fail independently. Child screens render their error inside the workspace. Command overlay can show “EvoPulse could not complete that.”

## LOADING STATE

Nav is immediate. Workspace may show a 56px quiet skeleton. No full-page spinner.

## RELATED SCREENS

All 01–16. Command overlay (02). Inspector (object, evidence, 16).

## INSPECTOR BEHAVIOR

Closed by default. Opens from an object, a number, or Evidence. Never reserved when empty.

## COMMANDS THAT OPEN IT

The shell is already open. `⌘K` opens Command. `Esc` returns to the workspace.
