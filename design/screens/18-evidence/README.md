# 18 — Evidence

**User question:** Why should I trust this?

**Product:** EvoPulse Control OS · Aurora  
**File:** `evidence.html`  
**Pairs with:** `../19-verification/` — Did it work?

## Purpose

Show the grounded chain that justifies Pulse attention. Evidence is a trail of **business sources**, presented the way an AI search product cites sources — numbered chips in a brief, inspectable rail on the side — without ChatGPT or OpenAI branding, and without a chat composer.

This is a calm control room. It is not a forensic developer console, a CRM record, or a dashboard of charts.

## Primary user question

> Why should I trust that 320,000 DZD needs a human?

Answer: because a customer said it, software extracted two commitments, the clock detected a miss, and impact is the stored Atlas opportunity. No hidden chain-of-thought.

## Primary state

| Field | Value |
| --- | --- |
| Clock | Sunday 27 Sep 2026 08:18 · Africa/Tunis |
| Exception | `exc_proposal_missed` · open |
| Attention | **NEEDS_YOU** |
| Deal | Atlas Q4 warehouse fit-out · 320,000 DZD **associated**, not lost |
| Plan | `pln_recovery_320k` exists · actions **proposed** |
| Verification | **not opened** — no execute yet |
| Outcome | none for this exception |

## Evidence progression

OBSERVED → DETECTED → IMPACT → PLAN → POLICY → ACTION → VERIFICATION → OUTCOME

On this screen the first six steps are live from seed. Verification and Outcome are queued: they do not exist for this live exception until a verifiable action executes. Historical synthetic outcomes appear only as source 09, marked synthetic.

## Sources (canonical)

| # | Kind | Object | Fact |
| --- | --- | --- | --- |
| 01 | Customer message | `evt_msg_proposal` | “Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.” Wed 23 Sep 16:42 · 94% |
| 02 | Our commitment | `cmt_send_proposal` | Send revised proposal · Thu 24 Sep 18:00 · missed |
| 03 | Customer commitment | `cmt_decision_friday` | Decision Friday · Fri 25 Sep 17:00 · blocked · depends on 02 |
| 04 | Expectation | `exp_send_proposal` | Expected `quote.sent` vs no proposal-sent event · MISSED · clock-owned |
| 05 | Opportunity / impact | `ent_opp_320k` | 1 customer · 1 opportunity · 320,000 DZD associated · cash timing affected |
| 06 | Plan | `pln_recovery_320k` | Prepare · draft · Monday checkpoint · APPROVAL_REQUIRED |
| 07 | Policy | `pol_msg` / `pol_discount` | `external_message_requires_approval=true` · `discount_max=5` |
| 08 | Action | `act_draft_followup` | personalized_followup · **proposed, not executed** |
| 09 | Historical outcomes | synthetic seed | 13/18 · 5/9 · 4/15 · not this case · not a prediction |

Contact: Amine Khelifi · Purchasing Director · Atlas Retail Group.  
Model: `heuristic-v1`. Extractor confidence 0.94 / 0.92.

## Primary action

Inspect a source (click a citation chip or a rail row). The brief stays; the source becomes current.

## Secondary actions

- Jump the progression rail to the matching source.
- Open Verification (`../19-verification/verification.html`) to see the post-execute state.
- Read “Not this claim” — supplier delay SH-204 / 850K / 540K is a **second demo path**, not this pack.

## Attention semantics

| Token | Meaning here |
| --- | --- |
| NEEDS_YOU | Exception is open. Human must approve the customer-facing draft. |
| MONITORING | Not this screen. Appears only after execute, while verification is PENDING. |
| HANDLED | Forbidden here. Actions are proposed. Verification has not run. |

Amber (`#f0a202`) is NEEDS_YOU only.

## Financial semantics

- **320,000 DZD** is associated opportunity value, not a loss forecast.
- Notes from seed: “Causal certainty is limited to this deal — not a forecast.”
- Do not show 850,000 / 540,000 on this pack. Those are graph sums after Trigger Supplier Delay.

## Warning semantics

- Friday is blocked because Thursday was missed. Dependency is explicit.
- Policy, not the model, will later block a 10% ask (`discount_max=5`).
- Historical rates must stay labeled **synthetic** and must not read as “will work.”

## Verification semantics

Verification is **queued**. This screen must never imply HANDLED after a plan exists.  
Correct later lifecycle lives on the Verification screen:

ACTION EXECUTED → VERIFICATION PENDING → SUCCESS → HANDLED

## Layout

Document + source rail (Perplexity-like citations, Aurora-skinned).  
Expected vs Actual is a split rule, not a card pair.  
Commitments sit on one horizontal chain.

Breakpoints: **1440 / 1280 / 1024**. At 1024 the rail stacks under the brief.

## Accessibility

- Skip link, `lang="en"`, visible `:focus-visible`
- Citation chips and source rows are buttons/links with `aria-current`
- Progression is a labeled list
- Color is never the only status signal (labels + copy)
- `prefers-reduced-motion` respected
- Contrast: paper on ink, amber money labeled “associated”

## What this is not

- Not a ChatGPT citations clone
- Not a CRM contact page
- Not an ERP table
- Not a dashboard
- Not a wall of equal cards

## Prototype ancestry

- Existing Pulse / Exception evidence block (`app/exceptions/[id]/page.tsx`)
- Seed world (`lib/seed.ts`, `lib/engine/extract.ts`, `lib/engine/recovery.ts`)
- Learning seed rates (`lib/learning/seed-outcomes.ts`) — displayed only as source 09
- Mobbin: [Perplexity answer with source rail](https://mobbin.com/screens/fa28b1b4-e249-46f0-a225-087a1c36e00b) — structure only

## Image prompt

See `evidence-image-prompt.md`.

## Limits

- Static HTML. Not wired to SQLite.
- Source 09 is synthetic by construction.
- Supplier delay is mentioned only as a non-claim.
