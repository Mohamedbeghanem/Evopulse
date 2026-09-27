# 12 — Approval

**Surface:** Human authority  
**File:** `approval.html`  
**User question:** WHAT NEEDS HUMAN AUTHORITY?  
**Canonical top-level state:** `NEEDS_APPROVAL`

This is the Control OS gate between a proposed recovery and the world. It is not Pulse, not Exception detail, not Autopilot, and not a workflow builder. One authority brief. One state.

## Contract

| Slot | Canonical content |
| --- | --- |
| WHAT EVOPULSE WANTS TO DO | Recover the 320K Atlas decision: prepare proposal (AUTO), draft follow-up (`APPROVAL_REQUIRED`), Monday checkpoint (AUTO) |
| WHY | Thursday send missed. Friday customer decision is blocked. Their commitment depends on ours. |
| IMPACT | 320,000 DZD associated opportunity (Atlas Q4 warehouse fit-out). Proposal / recovery context. Not “revenue saved.” Not lost. One customer, one opportunity, cash timing affected. |
| POLICY | `external_message_requires_approval=true` rolls the plan to `APPROVAL_REQUIRED`. `discount_max` is not in play on this recovery. |
| EVIDENCE | Customer conversation, Amine Khelifi, Wed 23 Sep 16:42. Quote: “Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday.” Expected vs actual. Confidence 94%. heuristic-v1. |

## States

| State | Meaning |
| --- | --- |
| `NEEDS_APPROVAL` | Primary. Human has not authorized. EvoPulse cannot change this itself. |
| `APPROVED` | Human authorized. Recovery may execute. Pulse attention becomes `MONITORING`. Send alone does not solve the exception — verification of a customer response is pending. |
| `REJECTED` | Human stopped the send. Reason required. No self-retry. |

Do **not** split this screen into Exception / Approval / Autopilot cards. Pulse attention (`NEEDS_YOU`) lives on Pulse. This surface speaks only `NEEDS_APPROVAL`.

## Actions

| Action | Who | Effect |
| --- | --- | --- |
| **APPROVE** | Human only | Authorizes `pln_recovery_320k`. Draft is sent as last edited. |
| **EDIT** | Human only | Revises the customer draft. State stays `NEEDS_APPROVAL`. |
| **REJECT** | Human only | Stops execution. Reason recorded. |

There is no “let EvoPulse decide,” no auto-approve, no Approve-all.

## Canonical data (from `main`)

- Clock: `2026-09-27T08:18:00+01:00` (`DEMO_NOW_ISO`)
- Opportunity: Atlas Q4 warehouse fit-out · `ent_opp_320k` · 320,000 DZD
- Contact: Amine Khelifi · Atlas Retail Group
- Exception: `exc_proposal_missed` · missed commitment
- Plan: `pln_recovery_320k` · status `approval_required`
- Actions: `act_prepare_proposal` AUTO · `act_draft_followup` APPROVAL_REQUIRED · `act_checkpoint` AUTO
- Evidence source: Customer conversation (business source, not chain-of-thought)

## What this is not

- Not a CRM pipeline or request inbox
- Not an ERP form
- Not a dashboard of KPIs
- Not a chat thread
- Not a node-based workflow builder
- Not a card wall of Exception + Approval + Autopilot

## Responsive

Designed and verified at **1440 / 1280 / 1024**. Rail stacks above the brief at 1024. Action bar stays sticky.

## Accessibility

Landmarks, skip link, `h1` is the user question, live region for state changes, dialogs for edit/reject, visible focus, required reject reason, `prefers-reduced-motion`.

## Related

- [16 Policy](../16-policy/policy.html) — 10% `BLOCKED` by `discount_max=5%`
- Engines: `lib/engine/recovery.ts`, `lib/engine/policy.ts`, `lib/seed.ts`
