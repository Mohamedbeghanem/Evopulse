# 16 — Policy

**Surface:** Policies / Control  
**File:** `policy.html`  
**User question:** WHAT NEEDS HUMAN AUTHORITY? *(answered here as: what software already refused, and what still needs a human)*  
**Canonical top-level state:** `BLOCKED`

Locked Aurora / Control OS. FOCUSED 840px. Sidebar item **Policies / Control** is current. Inspector is the fired rule (`discount_max`).

`BLOCKED` is **governed autonomy**, not an application error. Aurora paints BLOCKED as quiet (`--aurora-quiet`), never crash-red.

## Contract

| Slot | Canonical content |
| --- | --- |
| REFUSED | `apply_discount` 10% on 320,000 DZD · `act_apply_10` · `BLOCKED` · `Policy discount_max=5% blocks a 10% discount.` |
| INSIDE POLICY | 5% → 304,000 DZD (`act_offer_5`, `APPROVAL_REQUIRED`) and/or Net-14 + slot at list 320,000 (`act_offer_terms`, `APPROVAL_REQUIRED`) |
| SEND | Draft reply still `APPROVAL_REQUIRED` |
| LEDGER | Five seeded policies from `lib/seed.ts` |
| EVIDENCE | “I'll sign today if you give me 10%.” · Sun 27 Sep 11:05 |

## States

| State | Meaning |
| --- | --- |
| `BLOCKED` | Primary. 10% cannot execute. Software is doing its job. |
| `BLOCKED · ALT READY` | Human picked 5% or Net-14. 10% stays blocked. Next surface is 12 Approval. |

There is **no approve control** for 10%.

## Financial semantics

- List / associated: **320,000 DZD**
- 10% is not “revenue saved”
- Policy-max alternative: **304,000 DZD**
- Net-14 keeps **320,000 DZD** list
- `planOutcome` rolls to `BLOCKED` if any action is blocked

## Canonical data

```
discount_max                              = 5
financial_commitment_requires_approval    = true
external_message_requires_approval        = true
payment_over_500k_requires_approval       = true
customer_data_deletion                    = forbidden
```

- Clock: `2026-09-27T11:05:00+01:00`
- Exception: `exc_discount_blocked`
- Plan: `pln_discount_alt`
- Event: `policy.blocked` · `evt_policy_discount_10`

## Visual

Same Aurora shell as 12. BLOCKED chip is quiet. Orange only when an alternative is ready for a human.

## Responsive

**1440 / 1280 / 1024.** Ledger stacks at 1280. Math stacks at 1024.

## Accessibility

Skip link, landmarks, live region, `aria-describedby` on the dead 10% control, `--focus-ring`, `prefers-reduced-motion`. BLOCKED is `status`, not `alert`.

## Related

- [12 Approval](../12-approval/approval.html)
- Engines: `lib/engine/policy.ts`, `lib/engine/recovery.ts` `buildDiscountAlternative`, `lib/engine/ingest.ts`
