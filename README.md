# EvoPulse

AI-native **Business Control System**. Other tools tell you what happened. EvoPulse understands what was supposed to happen, detects when reality diverges, shows the impact, and coordinates the next safe action.

Tagline: **Nothing falls through.**

Hackathon MVP for **GOMYCODE Come Build with AI — Algeria — 27 Sep 2026**. One closed loop, not the full OS. Product authority: [PLAN.md](./PLAN.md).

**Team size:** 2–5. **Final Team Confirmation:** already done. Fill names on [PROJECT_CARD.md](./PROJECT_CARD.md) — do not invent teammates.

- `[TEAMMATE_1_NAME]` · `[TEAMMATE_1_ROLE]` · `[TEAMMATE_1_CAMPUS]`
- `[TEAMMATE_2_NAME]` · `[TEAMMATE_2_ROLE]` · `[TEAMMATE_2_CAMPUS]`
- `[TEAMMATE_3_NAME]` · `[TEAMMATE_3_ROLE]` · `[TEAMMATE_3_CAMPUS]` *(optional if team is 2)*
- `[TEAMMATE_4_NAME]` · `[TEAMMATE_4_ROLE]` · `[TEAMMATE_4_CAMPUS]` *(optional)*
- `[TEAMMATE_5_NAME]` · `[TEAMMATE_5_ROLE]` · `[TEAMMATE_5_CAMPUS]` *(optional)*

## One-sentence pitch

EvoPulse understands what a business expects to happen, detects when reality diverges, calculates the impact, and safely coordinates what should happen next.

## What this MVP proves

Cold start → Pulse shows **320,000 DZD NEEDS YOU** → open the exception → see evidence + dependency → approve recovery → state updates → later “give me 10%” → **policy `discount_max=5%` BLOCKS** → alternative recovery is shown.

AI interprets language. Software owns deadlines, policy, and state. Humans approve anything that leaves the building.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **No API key required.** The Atlas 320K seed uses a deterministic extractor so the 90s click path works offline.

Optional keys (live JSON extraction only; heuristic fallback always wins if the call fails or no key is set):

```bash
cp .env.example .env.local
# OPENAI_API_KEY=...   or GROQ_API_KEY=...   or GEMINI_API_KEY=...
```

```bash
npm test          # extraction, policy, expectation state, full 320K loop
npm run seed      # reset the Atlas scenario
```

Docker:

```bash
docker compose up --build
```

Binds `0.0.0.0:$PORT` (default 3000). SQLite lives in `data/evopulse.db` (ephemeral on most hosts — expected for a demo).

## Demo without typing

Seed is already at the miss. Click through:

1. `/` Pulse — 320K needs you
2. Exception card → evidence, impact, dependency
3. Recovery plan → **Approve & execute**
4. Demo bar → **Later message: 10%**
5. `/command` — three canned grounded questions

Shot list and rubric mapping: [DEMO.md](./DEMO.md).

## Stack

- Next.js 15 + React 19 + TypeScript + Tailwind
- SQLite via Node 22 `node:sqlite` (tables in PLAN §24)
- Extractor: OpenAI / Groq / Gemini JSON, **hard fallback** to deterministic heuristics for the seed messages
- No auth beyond an implicit operator stub
- **NVIDIA Brev: not used** (optional window closed — we did not request Brev compute)

## Screens

| Route | Job |
| --- | --- |
| `/` | Pulse — attention, NEEDS YOU, impact currency |
| `/timeline` | Business Time Machine — Past / Now / Future |
| `/exceptions/:id` | Evidence + impact + dependency |
| `/exceptions/:id/plan` | Recovery + policy + approve |
| `/command` | Ask EvoPulse (grounded) |
| `/graph` | Commitment graph |

## API (PLAN §25)

`POST /ingest` · `POST /extract` · `GET /pulse` · `GET /timeline` · `GET /exceptions` · `GET /exceptions/:id` · `POST /exceptions/:id/plan` · `POST /plans/:id/approve` · `POST /actions/:id/execute` · `GET /graph/:entity` · `POST /ask`

Demo helpers: `POST /api/demo/reset` · `POST /api/demo/discount` · `GET /api/health`

## AI disclosure (submit this)

**Project:** EvoPulse — Business Control System  
**Event / country:** GOMYCODE Come Build with AI · 27 Sep 2026 · Algeria  
**Team size:** 2–5 · **Final Team Confirmation:** done  
**Team / builders:** `[TEAMMATE_1_NAME]`, `[TEAMMATE_2_NAME]`, `[TEAMMATE_3_NAME]`, `[TEAMMATE_4_NAME]`, `[TEAMMATE_5_NAME]` (delete unused slots)  
**AI / tools used:** Cursor Grok 4.6 (implementation), optional OpenAI / Groq / Gemini for live extraction  
**NVIDIA Brev:** Not used (window closed / optional)  
**What AI did:** Natural-language commitment extraction, recovery copy, Command answers over state  
**What software enforces:** Deadlines, expectation state, `discount_max=5%`, approval gates, audit log  
**What a human does:** Approve external messages and any allowed commercial concession  
**Data:** Entirely synthetic (Atlas Retail / Amine Khelifi / 320,000 DZD). No production customer data.  
**Fallback:** Seed scenario works with the network unplugged.  
**Known limits:** Single deal graph, stub operator, no WhatsApp/CRM connectors, no voice.

Copy-paste version lives in [DEMO.md](./DEMO.md#ai-disclosure-template).

## Submission checklist

- [PROJECT_CARD.md](./PROJECT_CARD.md) — paste into the project card; replace `[TEAMMATE_n_*]` only with confirmed teammates
- [DEMO.md](./DEMO.md) — 90s shot list + AI disclosure
- Record the click path. Do not type. Do not wait on a model key.
- **NVIDIA Brev: not used**

## Non-goals (kept)

Full CRM, WhatsApp, multi-agent meshes, real auth, polish beyond usable. See PLAN §27.
