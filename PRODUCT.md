# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The person in the chair is the business operator. They need to see what was supposed to happen, what diverged, how much money is at risk, and the next safe action. They approve anything that leaves the building: customer-facing messages and commercial concessions inside policy.

The shipped demo is that job on one deal: Atlas Retail Group, Amine Khelifi, a 320,000 DZD proposal. Hackathon judges watch the same click path. They are not a second product.

## Product Purpose

EvoPulse is an AI-native business control system. It understands what a business expects to happen, detects when reality diverges, shows the impact, and coordinates the next safe action.

Success for this build is one closed loop an operator can run without typing and without an API key: Pulse shows 320,000 DZD that needs them, they open the exception, see evidence and dependency, approve recovery, state updates, and a later “10%” request is blocked by policy with an alternative shown.

Tagline: Nothing falls through.

## Positioning

Other tools tell you what happened. EvoPulse holds the expectation, compares it to what actually happened, and will not let language override a deadline, a policy, or stored state. AI interprets language. Software owns deadlines, policy, and state.

## Operating Context

Local Next.js app at `http://localhost:3000`. SQLite file `data/evopulse.db`. The Atlas seed is deterministic and works with the network unplugged. Optional live extraction (OpenAI, Groq, or Gemini) is a fallback path only; the heuristic extractor wins when no key is set or the call fails.

The operator’s ritual is the 90-second click path in DEMO.md: Pulse, exception, recovery approve, demo bar “Later message: 10%”, timeline, command. Reset lives in the demo bar. No production CRM, WhatsApp, or voice.

## Capabilities and Constraints

Routes that exist and are in scope for the visual replacement:

- `/` Pulse — attention, NEEDS YOU, impact currency
- `/exceptions/[id]` evidence, impact, dependency
- `/exceptions/[id]/plan` recovery, policy, approve
- `/command` outcome commands and grounded questions
- `/explore` causal explorer
- `/timeline` past / now / future and the event stream
- `/impact/[exceptionId]` impact numbers for the supplier delay
- `/simulate` what-if, baseline versus simulation, read-only
- `/graph` commitment graph
- `/goals` and `/goals/[id]` cross-business goal and structured plan
- `/warnings` and `/warnings/[id]` early warning, AT RISK before a miss

These routes also exist on main `42cc9a2` and are in this visual pass: `/autopilot`, `/autopilot/[id]`, `/business`, `/policy`, `/autonomy`, `/learning`, `/evidence/[id]`, `/situations/[id]`, `/verification/[id]`. Do not invent behavior behind them. Restyle what the code already does.

Product facts that outrank mock copy:

- Amounts come from the graph and seed: 320,000 DZD proposal; 850,000 DZD revenue and 540,000 DZD expected cash are totals of graph amounts, not hardcoded display targets.
- Policy `discount_max=5%`. A 10% ask is BLOCKED. External messages require approval.
- Expectation state is software: ON_TRACK, MISSED, BLOCKED, FULFILLED. Early warning is AT RISK before a deadline is missed. The clock decides MISSED, not a model.
- Simulation is read-only. Replay updates `metadata.replay_count` only.
- Impact counts at-risk commitments only downstream of the asked node.
- No auth beyond an implicit operator stub. Single deal graph. Synthetic data only. NVIDIA Brev is not used.
- Team card placeholders stay placeholders. Do not invent teammates.

GitHub PR numbers are not PLAN.md product P-numbers. Mohamed decides merges.

## Brand Commitments

Name: EvoPulse. Tagline: Nothing falls through. Voice is direct and operational: expected versus actual, evidence, money at risk, the next safe action.

The operational UI follows the screen pack at `C:\Users\Moham\Downloads\evopulse-screens\evopulse-screens`. Where that pack and the app disagree on labels, numbers, or story, the app and PLAN.md win.

The agent face (command composer and agent turns) uses the MIT avatar engine from jeremy-prt/bloub (https://github.com/jeremy-prt/bloub, https://bloub.vercel.app/). That code recreates a bot avatar. EvoPulse is not an xAI product, and the UI must not say that it is.

## Evidence on Hand

- Synthetic demo only: Atlas Retail Group, Amine Khelifi, 320,000 DZD. No real customer data, testimonials, or case studies. Do not invent any.
- Product authority: PLAN.md. Demo shot list: DEMO.md. Project card: PROJECT_CARD.md.
- Screen pack (visual reference, not product authority): `C:\Users\Moham\Downloads\evopulse-screens\evopulse-screens`.
- Repo: https://github.com/Mohamedbeghanem/Evopulse

## Product Principles

- Show what requires attention. Expected versus actual beats a chart wall.
- Put evidence and the money at risk on screen before asking for an action.
- Software decides state, deadlines, and policy. Language can propose; it cannot override.
- A human approves anything that leaves the building.
- The offline seed path must keep working. A missing model key is not a broken product.
