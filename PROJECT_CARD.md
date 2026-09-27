# Project card — GOMYCODE Come Build with AI

Paste into the gallery / project card. Replace only `[…]` slots you know. Do not invent teammates.

## Team

| Field | Value |
| --- | --- |
| Event | GOMYCODE Come Build with AI · 27 Sep 2026 · **Algeria** |
| Final Team Confirmation | **Done** |
| Team size | **2–5** |
| NVIDIA Brev | **Not used** (window closed / optional — no Brev compute requested) |

| # | Full name | Role | GOMYCODE / campus |
| --- | --- | --- | --- |
| 1 | Mohamed Beghanem | Lead · repo owner | [TEAMMATE_1_CAMPUS] |
| 2 | [TEAMMATE_2_NAME] | [TEAMMATE_2_ROLE] | [TEAMMATE_2_CAMPUS] |
| 3 | [TEAMMATE_3_NAME] | [TEAMMATE_3_ROLE] | [TEAMMATE_3_CAMPUS] |
| 4 | [TEAMMATE_4_NAME] | [TEAMMATE_4_ROLE] | [TEAMMATE_4_CAMPUS] |
| 5 | [TEAMMATE_5_NAME] | [TEAMMATE_5_ROLE] | [TEAMMATE_5_CAMPUS] |

Leave unused rows blank if the team is 2, 3, or 4.

**One-line team field (paste):**  
`Mohamed Beghanem, [TEAMMATE_2_NAME], [TEAMMATE_3_NAME], [TEAMMATE_4_NAME], [TEAMMATE_5_NAME] · team size 2–5 · Final Team Confirmation done · Algeria`

## Project

| Field | Value |
| --- | --- |
| Project name | EvoPulse |
| Tagline | Nothing falls through. |
| One-liner | AI-native Business Control System: expected vs actual, with evidence. |
| Category | AI-native operations / business control |
| Repo | https://github.com/Mohamedbeghanem/Evopulse |
| PR | https://github.com/Mohamedbeghanem/Evopulse/pull/1 |
| Run | `npm install && npm run dev` → http://localhost:3000 |
| API key | **Not required.** Seed path is deterministic and offline. |
| 90s shot list | [DEMO.md](./DEMO.md) |

### Problem

Businesses do not fail because they lack dashboards. They fail because promises are forgotten, dependencies break, and nobody sees the money at risk until it is too late.

### Solution (one loop, not a full OS)

1. Ingest: “Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.”
2. Extract OUR commitment + CUSTOMER commitment + dependency (offline heuristic; optional live model).
3. Time passes, proposal not sent → **Exception** with evidence + **320,000 DZD** impact.
4. Recovery: prepare proposal, draft follow-up, checkpoint → **APPROVAL_REQUIRED**.
5. Approve → execute → state updates (HANDLED).
6. Later: “I'll sign today if you give me 10%.” → policy `discount_max=5%` → **BLOCKED** → 5% / Net-14 alternative.

### Demo (no typing)

Cold start Pulse → exception → recovery Approve → demo bar **Later message: 10%** → Timeline → Command canned question. Reset is in the demo bar.

## Rubric (100)

| Criterion | Pts | In this build |
| --- | --- | --- |
| Problem & User Value | 20 | 320K forgotten promise, not another CRM |
| Functional Execution | 20 | Full loop; `npm test`; actions change state |
| Quality of AI Use | 20 | Extract + recover; software owns policy/state |
| Testing & Reliability | 15 | Offline fallback, seed, 11 tests |
| User Experience & Demo | 15 | Clickable 90s path, Time Machine |
| Responsible AI & Data | 10 | Evidence, approval, synthetic data, Brev unused |

## AI disclosure (paste as-is after filling names)

```
Project: EvoPulse — AI-native Business Control System
Event: GOMYCODE Come Build with AI · 27 Sep 2026 · Algeria
Team size: 2–5 (Final Team Confirmation: done)
Team: Mohamed Beghanem, [TEAMMATE_2_NAME], [TEAMMATE_3_NAME], [TEAMMATE_4_NAME], [TEAMMATE_5_NAME]
NVIDIA Brev: not used (window closed / optional — no Brev compute requested)

AI systems
- Cursor Grok 4.6 (implementation assistant)
- Optional live extractor: OpenAI / Groq / Gemini (structured JSON)
- Default path: deterministic heuristic extractor (no network)

AI is allowed to
- Extract commitments, amounts, discounts, dependencies from text
- Draft recovery language and Command answers

Software (not AI) enforces
- Expectation state (ON_TRACK → MISSED / BLOCKED / FULFILLED)
- Policies (discount_max=5%, external_message_requires_approval)
- Approvals, execution side-effects, audit log

Humans govern
- Any customer-facing send
- Any commercial concession inside policy

Data
- 100% synthetic (Atlas Retail Group, Amine Khelifi, 320,000 DZD)
- No personal data of real customers
- SQLite local file; no third-party analytics

Limitations
- Single opportunity graph
- No production connectors
- Voice ingest not in this MVP
```
