# EvoPulse

AI-native **Business Control System**. Other tools tell you what happened. EvoPulse understands what was supposed to happen, detects when reality diverges, shows the impact, and coordinates the next safe action.

Tagline: **Nothing falls through.**

Hackathon MVP for **GOMYCODE Come Build with AI — Algeria — 27 Sep 2026**. One closed loop, not the full OS.

**Product authority:** [PLAN.md](./PLAN.md) — sections 0–34, including product P2–#26 architecture, hackathon cut (§28), demo story (§29), and moat (§34).

**PR #1 on `main`** (320K proposal miss loop) remains the hackathon submit baseline. **Product P2 (Event Layer, PLAN §1)** lives at `lib/events/` — not GitHub docs PR #2, which only landed this PLAN.md. §28 / §29 are the next vertical expansion.

**Team size:** 2–5. **Final Team Confirmation:** already done. Confirmed names only — remaining slots stay placeholders on [PROJECT_CARD.md](./PROJECT_CARD.md).

- Mohamed Beghanem · Lead · `[TEAMMATE_1_CAMPUS]`
- `[TEAMMATE_2_NAME]` · `[TEAMMATE_2_ROLE]` · `[TEAMMATE_2_CAMPUS]`
- `[TEAMMATE_3_NAME]` · `[TEAMMATE_3_ROLE]` · `[TEAMMATE_3_CAMPUS]` *(blank if team is 2)*
- `[TEAMMATE_4_NAME]` · `[TEAMMATE_4_ROLE]` · `[TEAMMATE_4_CAMPUS]` *(blank if unused)*
- `[TEAMMATE_5_NAME]` · `[TEAMMATE_5_ROLE]` · `[TEAMMATE_5_CAMPUS]` *(blank if unused)*

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

## Architecture

- **Event Layer (product P2 / PLAN §1)** lives at `lib/events/` — `EventRepository`, `EventService`, and an in-process dispatcher. Everything entering EvoPulse becomes a row on the `events` table and is then dispatched to registered handlers. Later engines (graph, twin, pulse matchers) subscribe to this stream; they do not grow a second history.
- **Business Graph + Impact (product P3)** lives at `lib/graph/` and `lib/engine/impact.ts`. SQLite `graph_nodes` / `graph_edges`; traversal is relational. Impact sums seeded order/invoice amounts — it does not hardcode 850K / 540K.
- **Business Twin** lives at `lib/engine/twin.ts`. Domain state is derived from stored exceptions, commitments, and graph facts — no AI health scores.
- **Early Warning (product P22)** lives at `lib/warnings/`. Deterministic buffer math (`available` vs `required`) decides AT RISK before a deadline is missed. Detect still owns MISSED. LLM does not classify the warning.
- Replay (`POST /api/events/:id/replay` or `POST /api/events/replay`) re-notifies handlers only. It does not clone the event or re-run ingest / execute side effects. Handlers must be idempotent on `event.id`.
- Pulse / Policy / Action engines stay in `lib/engine/`. Schema lives in `lib/db.ts`.

## Stack

- Next.js 15 + React 19 + TypeScript + Tailwind
- SQLite via Node 22 `node:sqlite` (tables in `lib/db.ts`; architecture in PLAN.md)
- Extractor: OpenAI / Groq / Gemini JSON, **hard fallback** to deterministic heuristics for the seed messages
- No auth beyond an implicit operator stub
- **NVIDIA Brev: not used** (optional window closed — we did not request Brev compute)

## Screens

| Route | Job |
| --- | --- |
| `/` | Pulse — attention, NEEDS YOU, impact currency |
| `/timeline` | Business Time Machine — Past / Now / Future + event stream |
| `/impact/:id` | Causal cascade for the supplier delay |
| `/exceptions/:id` | Evidence + impact + dependency |
| `/exceptions/:id/plan` | Recovery + policy + approve |
| `/command` | Outcome commands + grounded questions |
| `/goals` · `/goals/:id` | Cross-business goal + structured plan |
| `/graph` | Commitment graph |
| `/warnings` · `/warnings/:id` | Early warning — AT RISK, not missed |

## API

`POST /ingest` · `POST /extract` · `GET /pulse` · `GET /timeline` · `GET /exceptions` · `GET /exceptions/:id` · `GET /exceptions/:id/impact` · `POST /exceptions/:id/plan` · `POST /plans/:id/approve` · `POST /plans/:id/execute-safe` · `POST /actions/:id/execute` · `GET /graph/:entity` · `GET /graph/:entity/dependencies` · `GET /graph/:entity/impact` · `GET /business-state` · `POST /ask` · `POST /api/goals` · `GET /api/goals/:id` · `POST /api/goals/:id/plan` · `GET/POST /api/events` · `GET /api/events/:id` · `POST /api/events/:id/replay` · `POST /api/events/replay` · `GET /api/warnings` · `GET /api/warnings/:id` · `POST /api/warnings/evaluate` · `GET /api/warnings/:id/explanation`

Demo helpers: `POST /api/demo/reset` · `POST /api/demo/discount` · `POST /api/demo/supplier-delay` · `POST /api/demo/shipment-earlier` · `GET /api/health`

## AI disclosure (submit this)

**Project:** EvoPulse — Business Control System  
**Event / country:** GOMYCODE Come Build with AI · 27 Sep 2026 · Algeria  
**Team size:** 2–5 · **Final Team Confirmation:** done  
**Team / builders:** Mohamed Beghanem, `[TEAMMATE_2_NAME]`, `[TEAMMATE_3_NAME]`, `[TEAMMATE_4_NAME]`, `[TEAMMATE_5_NAME]` (delete unused slots)  
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

Full CRM, WhatsApp, multi-agent meshes, real auth, polish beyond usable. Next vertical slice is PLAN §28 / §29; later phases are §30.
