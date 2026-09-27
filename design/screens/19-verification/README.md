# 19 — Verification

**User question:** Did it work?

**Product:** EvoPulse Control OS · Aurora  
**File:** `verification.html`  
**Pairs with:** `../18-evidence/` — Why should I trust this?

## Purpose

Make **EXECUTED vs HANDLED** obvious. After a recovery plan runs, EvoPulse must not congratulate itself. Sending a follow-up opens a verification. Until the expected world event arrives (or the deadline fails), attention is **MONITORING**, never HANDLED.

This is a control room split: what we did ≠ what the world confirmed.

## Primary user question

> We executed the Atlas recovery. Did it work?

Answer: **Not yet.** Action executed. Verification pending. Waiting for `customer.response` before Monday 28 Sep 08:18.

## Correct lifecycle

```
ACTION EXECUTED
  → VERIFICATION PENDING   (exception status awaiting_verification, attention MONITORING)
    → SUCCESS              (expected event before deadline)
      → HANDLED            (exception status resolved)
    → FAILED               (deadline passed / late event)
      → NEEDS_YOU          (exception status open)
```

**EXECUTION ≠ RESOLUTION.**  
If verification is pending: **MONITORING**, not HANDLED.

Owned by software (`lib/learning/verification.ts`, `lib/engine/execute.ts`). The LLM does not own the deadline.

## Primary state

The default, testable state of this prototype:

| Field | Value |
| --- | --- |
| Clock | Sunday 27 Sep 2026 08:18 · Africa/Tunis |
| Plan | `pln_recovery_320k` · executed |
| Actions | `act_prepare_proposal`, `act_draft_followup`, `act_checkpoint` · **executed** |
| Verification | PENDING |
| Expected event | `customer.response` (alias `customer.replied`) |
| Expected by | Monday 28 Sep 08:18 (`addHours(now, 24)`) |
| Exception | `exc_proposal_missed` · `awaiting_verification` |
| Attention | **MONITORING** |
| Outcome | none yet |

Verifiable action types: `draft_message`, `send_message`, `prepare_proposal`.  
`create_checkpoint` executes but does not open a second verification.

## Primary action

Watch. Do not mark handled. The screen’s primary verb is **monitor the pending verification**.

Preview controls (prototype only) let a reviewer flip:

| Control | Verification | Attention | Exception |
| --- | --- | --- | --- |
| Pending (default) | PENDING | MONITORING | awaiting_verification |
| Success → Handled | SUCCESS | HANDLED | resolved |
| Failed → Needs you | FAILED | NEEDS_YOU | open |

Success preview uses the later demo message time: `customer.replied` Sunday 27 Sep 11:05 (before deadline) → outcome `customer_replied`.  
Failed preview: deadline passed, no matching event → outcome `no_response`.

## Secondary actions

- Open Evidence to read the pre-execute source trail.
- Inspect success / failure conditions.
- Read historical synthetic rates (13/18, 5/9, 4/15) as context, never as permission to auto-close.

## Attention semantics

| Token | When |
| --- | --- |
| MONITORING | Verification PENDING. Default. Ice (`#7eb6d9`). |
| HANDLED | Only after SUCCESS. Green (`#3dba8b`). |
| NEEDS_YOU | After FAILED. Amber (`#f0a202`). Exception reopens. |

Executed badges stay green in the left column in every preview. That column never becomes HANDLED.

## Financial semantics

320,000 DZD remains associated opportunity value. Success does not invent “revenue recovered.” Failure does not invent “revenue lost.”

## Warning semantics

- Do not treat `action.executed` as Pulse HANDLED.
- Do not let a preview Success look like the seed default.
- Policy still governs any later 10% ask (`discount_max=5`) even after this verification succeeds.

## Verification semantics — contract

From `VerificationService` + `executePlan`:

1. `executeAction` writes `action.executed`.
2. `afterActionExecuted` opens a PENDING verification for verifiable types.
3. When the plan’s remaining non-blocked actions are done: `markExceptionAwaitingVerification` → status `awaiting_verification`, attention `MONITORING`.
4. `evaluateVerification`:
   - matching event before `expected_by` → SUCCESS
   - matching event at/after deadline → FAILED
   - `failExpiredVerifications` → FAILED (`Deadline passed with no matching event.`)
5. `applyVerificationToException`: SUCCESS → resolved / HANDLED; FAILED → open / NEEDS_YOU.
6. `OutcomeLedger.recordFromVerification` writes `customer_replied` or `no_response`. CANCELLED writes no outcome.

## Layout

Hero law: “Executed is what we did. Handled is what the world confirmed.”  
Two-pane split with a literal **≠**.  
Lifecycle stepper (Linear-like stages, Aurora-skinned).  
Action list is a rule-separated stack, not a card grid.

Breakpoints: **1440 / 1280 / 1024**. At 1024 the split stacks; ≠ becomes a text row.

## Accessibility

- Skip link, `lang="en"`, visible focus
- `aria-live="polite"` announces state changes
- Preview buttons use `aria-pressed`
- Lifecycle is a labeled list; current step is text + inset rule, not color alone
- Reduced motion honored

## What this is not

- Not a dashboard of success rates
- Not a CRM “closed-won” toggle
- Not ChatGPT “done” copy
- Not a card wall

## Prototype ancestry

- `lib/learning/verification.ts` — PENDING / SUCCESS / FAILED, aliases, expire
- `lib/engine/execute.ts` — execute then await verification
- `tests/verification.test.ts` — send is not success
- PLAN §14 — “Do NOT mark problem solved”
- Mobbin: [Linear project statuses](https://mobbin.com/screens/e494c7a9-8c56-4840-bca4-a0324b332710) — explicit stages

## Image prompt

See `verification-image-prompt.md`.

## Limits

- Static HTML. Preview switcher is local JS, not the engine.
- Verification id is omitted; live ids are generated (`id("ver")`).
- Does not simulate the later 10% policy-block exception.
