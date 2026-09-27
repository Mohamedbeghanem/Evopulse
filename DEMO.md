# EvoPulse — 90-second demo

Record this cold. Do not type. Seed is already at the miss.

**Clock on screen:** Sunday 27 Sep 2026.  
**Country / event:** Algeria · GOMYCODE Come Build with AI.  
**Team:** 2–5 · Final Team Confirmation done · names on [PROJECT_CARD.md](./PROJECT_CARD.md).  
**NVIDIA Brev:** not used.  
**Line to say:** “Businesses don’t fail from missing dashboards. They fail from forgotten promises.”

## Shot list (90 seconds)

| Sec | Shot | Say / show | Rubric |
| --- | --- | --- | --- |
| 0–8 | `/` Pulse, cold start | “320,000 DZD needs you. Atlas asked for a revised proposal Thursday. We never sent it.” | **Problem & User Value (20)** — forgotten commitment, not another CRM |
| 8–20 | Click the exception | Quote on screen: *“Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.”* Point at Expected vs Actual, 94% confidence, source. | **Quality of AI Use (20)** + **Responsible AI (10)** — evidence, no hidden chain-of-thought |
| 20–32 | Dependency chain | “Our promise and their promise. Their Friday decision **depends on** our Thursday send. One miss, two broken expectations.” | **Functional Execution (20)** — primitives from PLAN §3 |
| 32–48 | `/exceptions/exc_proposal_missed/plan` | Three actions: prepare proposal, draft follow-up, Monday checkpoint. Badge **APPROVAL_REQUIRED** because `external_message_requires_approval=true`. Click **Approve & execute**. Pulse flips to HANDLED. | **Functional Execution (20)** + **UX & Demo (15)** — human gate, state actually changes |
| 48–70 | Demo bar → **Later message: 10%** | Customer: *“I'll sign today if you give me 10%.”* AI proposes 10%. Policy `discount_max=5%` → **BLOCKED**. Alternatives: 5% (304,000 DZD) or Net-14 + pulled slot. | **Quality of AI Use (20)** + **Responsible AI (10)** — AI proposes, software refuses |
| 70–82 | `/timeline` | Past (message + missed Thursday), Now (320K overdue), Future (checkpoint). “This is the Business Time Machine.” | **UX & Demo (15)** — signature interface |
| 82–90 | `/command` click canned “What is putting revenue at risk?” | Grounded answer cites the live exception and the blocked 10%. End on tagline: **Nothing falls through.** | **Testing & Reliability (15)** — offline fallback, seeded path, no typing |

If time dies at 70s, skip Timeline and land on Command.

## Second scenario (after the 90s loop)

Reset → **Trigger Supplier Delay**. EvoPulse records `shipment.delayed`, moves SH-204 Monday → Wednesday (+2), walks the persisted graph, and calculates 3 orders / 3 customers / 850K associated revenue / 540K expected cash timing. Pulse and Twin update. `/impact/exc_shipment_delay` shows why Order B is affected. No API key.

## Rubric map (100 pts)

| Criterion | Pts | Where it lives in this build |
| --- | --- | --- |
| Problem & User Value | 20 | Pulse headline is money + a broken promise, not a chart wall. PLAN thesis on screen. |
| Functional Execution | 20 | Full loop: ingest → extract → expect vs actual → exception → impact → plan → policy → approve → execute. `npm test` covers it. |
| Quality of AI Use | 20 | Structured commitment extraction + recovery copy. AI never writes expectation state or policy outcomes. |
| Testing & Reliability | 15 | `npm test` (heuristic extract, policy, state engine, end-to-end loop). Hard offline fallback. Seed + Reset. |
| User Experience & Demo | 15 | Five screens, demo bar, 90s click-through, Time Machine. |
| Responsible AI & Data | 10 | Evidence pack, confidence, model name, audit log, approval, synthetic data, Brev unused, disclosure below. |

## Voice-over (optional, ~90s)

“EvoPulse is a Business Control System. Wednesday, Atlas said: send the revised 320,000 Dinar proposal tomorrow, I’ll decide Friday. Thursday came. We didn’t send. Pulse is not a dashboard — it is that 320K asking for a human. Here is the evidence, the dependency, the impact. Recovery is ready: prepare, draft, checkpoint — but the customer message stays behind approval. I approve. State updates. Later they say they’ll sign today for 10%. AI proposes it. Policy blocks it. Here is the 5% alternative. Ask EvoPulse what is putting revenue at risk — it answers from this graph, not from vibes. Nothing falls through.”

## AI disclosure template

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
