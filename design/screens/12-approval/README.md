# 12 — Approval

**Surface:** Human gate  
**File:** `approval.html`  
**User question:** WHAT NEEDS HUMAN AUTHORITY?  
**Canonical top-level state:** `NEEDS APPROVAL`

Locked Aurora / Control OS (dark-first tokens from `design/AURORA_TOKENS.css` on the Control OS foundation). FOCUSED workspace 840px. Persistent sidebar (Pulse / Command / Timeline / Business / Goals). Approval is contextual — not a primary nav module. Inspector holds business-source evidence.

This is not Pulse, not Exception detail, not Autopilot, and not a workflow builder. One authority brief. One state.

## Contract

| Slot | Canonical content |
| --- | --- |
| WHAT EVOPULSE WANTS TO DO | Recover the 320K Atlas decision: prepare (AUTO), draft follow-up (`APPROVAL_REQUIRED`), Monday checkpoint (AUTO) |
| WHY | Thursday send missed. Friday customer decision is blocked. Their commitment depends on ours. |
| IMPACT | 320,000 DZD associated opportunity (Atlas Q4 warehouse fit-out). Proposal / recovery. Not “revenue saved.” Not lost. |
| POLICY | `external_message_requires_approval=true` rolls the plan to `APPROVAL_REQUIRED`. `discount_max` is not in play. |
| EVIDENCE | Customer conversation, Amine Khelifi, Wed 23 Sep 16:42. Quote: “Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.” 94%. heuristic-v1. |

## States

| State | Meaning |
| --- | --- |
| `NEEDS APPROVAL` | Primary. Human has not authorized. EvoPulse cannot change this itself. |
| `APPROVED` | Human authorized. Recovery may execute. Pulse attention becomes `MONITORING`. Send ≠ solved. |
| `REJECTED` | Human stopped the send. Reason required. No self-retry. |

Do **not** split this screen into Exception / Approval / Autopilot cards.

## Actions

| Action | Who | Effect |
| --- | --- | --- |
| **APPROVE** | Human only | Authorizes `pln_recovery_320k`. |
| **EDIT** | Human only | Revises the customer draft. State stays `NEEDS APPROVAL`. |
| **REJECT** | Human only | Stops execution. Reason recorded. |

No “let EvoPulse decide.” No Approve-all.

## Canonical data (`main`)

- Clock: `2026-09-27T08:18:00+01:00`
- Opportunity: Atlas Q4 warehouse fit-out · `ent_opp_320k` · 320,000 DZD
- Plan: `pln_recovery_320k` · `approval_required`
- Actions: `act_prepare_proposal` AUTO · `act_draft_followup` APPROVAL_REQUIRED · `act_checkpoint` AUTO

## Visual

IBM Plex Sans + Mono. Canvas `#07090C`. Orange `#FF5A1F` only for attention / primary act. Ice `#7FB2E0` for AUTO. 6px controls. No Instrument Serif. No capsules.

## Responsive

**1440 / 1280 / 1024.** Sidebar 240 → 220 → collapsible. Inspector 360 → 320 → overlay.

## Accessibility

Skip link, landmarks, live region, dialogs, visible `--focus-ring`, required reject reason, `prefers-reduced-motion`.

## Related

- [16 Policy](../16-policy/policy.html) — 10% `BLOCKED` by `discount_max=5%`
- Engines: `lib/engine/recovery.ts`, `lib/engine/policy.ts`, `lib/seed.ts`
