# 16 — Policy

**Surface:** Governed autonomy  
**File:** `policy.html`  
**User question:** WHAT NEEDS HUMAN AUTHORITY? *(answered here as: what software already refused, and what still needs a human)*  
**Canonical top-level state:** `BLOCKED`

Policy sits between AI and execution. A 10% close is refused by `discount_max=5%`. That refusal is **governed autonomy**, not an application error, not a failed request, not a toast.

## Contract

| Slot | Canonical content |
| --- | --- |
| REFUSED | `apply_discount` 10% on 320,000 DZD · `act_apply_10` · `BLOCKED` · reason: `Policy discount_max=5% blocks a 10% discount.` |
| INSIDE POLICY | 5% → 304,000 DZD (`act_offer_5`, `APPROVAL_REQUIRED`) and/or Net-14 + pulled slot at list 320,000 (`act_offer_terms`, `APPROVAL_REQUIRED`) |
| SEND | Draft policy-safe reply still `APPROVAL_REQUIRED` (`external_message_requires_approval=true`) |
| LEDGER | All five seeded policies, exact keys and values from `lib/seed.ts` |
| EVIDENCE | “I'll sign today if you give me 10%.” · Customer conversation · Sun 27 Sep 11:05 · expected concession ≤ 5% |

## States

| State | Meaning |
| --- | --- |
| `BLOCKED` | Primary. 10% cannot execute. Software is doing its job. |
| `BLOCKED · ALT READY` | Human picked 5% or Net-14. 10% stays blocked. Next surface is 12 Approval. EvoPulse still cannot approve the send. |

There is **no approve control** for 10%. The dead control is labeled “Cannot approve 10%” and only restates the block.

## Financial semantics

- List / associated opportunity: **320,000 DZD**
- Unauthorized 10% is **not priced as revenue saved**
- Policy-max alternative: **304,000 DZD** (5%)
- Net-14 keeps **320,000 DZD** list and changes terms / slot
- `planOutcome` rolls to `BLOCKED` if any action is blocked (`lib/engine/policy.ts`)

## Canonical data (from `main`)

```
discount_max                              = 5
financial_commitment_requires_approval    = true
external_message_requires_approval        = true
payment_over_500k_requires_approval       = true
customer_data_deletion                    = forbidden
```

- Clock of the later message: `2026-09-27T11:05:00+01:00` (`MESSAGE_TWO_ISO`)
- Exception: `exc_discount_blocked` · kind `policy_blocked`
- Plan: `pln_discount_alt` · “Policy-safe close for Atlas” · status `blocked`
- Event: `policy.blocked` · `evt_policy_discount_10`
- Quote: `SEED_MESSAGE_TWO`

## What this is not

- Not an HTTP 500 / crash / “something went wrong”
- Not a permissions settings page
- Not a discount configurator
- Not a CRM win-probability widget
- Not a place EvoPulse can override itself

## Responsive

Designed and verified at **1440 / 1280 / 1024**. Requested-vs-allowed math stacks at 1024. Ledger becomes a stacked definition list at 1280 and below.

## Accessibility

Skip link, landmarks, `h1` names the refusal, live region, 10% control explained by `aria-describedby`, visible focus, `prefers-reduced-motion`. BLOCKED is announced as status, not `alert` (it is expected governance).

## Related

- [12 Approval](../12-approval/approval.html) — 320K recovery `NEEDS_APPROVAL`
- Engines: `lib/engine/policy.ts`, `lib/engine/recovery.ts` `buildDiscountAlternative`, `lib/engine/ingest.ts`
