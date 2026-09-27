# Master screens

These are the three screens that must be approved before production UI work.

Canonical numbers (do not invent others):

- Cascade: 3 orders · 3 customers · 850,000 DZD associated · 540,000 DZD expected cash timing
- Recovery: 320,000 DZD · `NEEDS_APPROVAL`
- Discount: 10% · `BLOCKED` · `discount_max=5%`

## 1. Pulse

**Question the screen answers:** What needs me right now?

Composition:

1. Clock — Sunday 27 Sep
2. Headline from attention — “2 situations require attention”
3. Count rail — Needs you · Approval · Monitoring · Handled (one row)
4. **What needs me?** — two cards in one row so both fit the 1440×900 frame
   - Situation card: Supplier cascade · `NEEDS_YOU`
     - 3 orders · 3 customers · 850,000 associated
     - 540,000 expected cash timing — not a loss
     - Layers: WARNING · EXCEPTION · IMPACT · GRAPH · AUTOPILOT · POLICY
     - Review · Why?
   - Situation card: 320K recovery · `NEEDS_APPROVAL`
     - Follow-up is ready. External send needs you.
     - Layers: EXCEPTION · PLAN · ACTION · POLICY · AUTOPILOT
     - Review recovery
5. **Watching** — empty after the delay. The Order A warning is a layer, not a home card. Later: verification pending becomes `MONITORING`.
6. **Handled** — verification SUCCESS. History, not a second active problem.

Hard no:

- Autopilot “What needs me?” and a Critical card for the same cascade
- A warning card next to a delay card for SH-204
- “850K at risk of being lost”

## 2. Command (AgentRuntime)

**Question the screen answers:** What is the business doing about it, and what still needs a human?

Composition:

Two-column operating console (not stacked chat). Both columns must be visible in the 1440×900 frame.

1. Compact header + canned prompts + composer
2. Left — current run “Protect everything at risk this week.”
   - Prior strip: Why 850K — 3 / 3 / 850,000 / 540,000
   - Phase: Waiting for approval · deterministic
   - Trace: Inspecting → Tracing → Planning → Checking policy → Safe actions → Waiting
   - Policy strip: 2 safe · 1 approval · 1 blocked · verification pending
3. Right — human work
   - Approval dock: draft customer follow-up, policy, 320,000 DZD impact
   - Approve · Edit · Reject (human only)
   - 10% stays `BLOCKED` (`discount_max=5%`) with the allowed alternative

Hard no:

- Agent self-approve
- Hidden chain-of-thought
- Executing 10% because a stored row said AUTO
- Chat bubbles that hide the trace

## 3. Warning

**Question the screen answers:** Has it failed? (No.) Why is the buffer short?

Composition:

1. Badges: AT RISK · NOT MISSED · ACTIVE
2. Has it failed? No.
3. Available 14h · Required 18h · Shortfall 4h
4. What changed — Atlas revised SH-204 Monday → Wednesday
5. Path — Atlas Supply → SH-204 → Order A → customer
6. Context — 3 / 3 / 850K associated / 540K cash timing
7. If the deadline passes, Detect owns MISSED. This warning becomes a layer on the same situation.

Hard no:

- Treating the warning as a missed exception
- A second Pulse card after escalation
- Forecasted “lost revenue”

## Motion

- Pulse need-count may throb once. Cards do not bounce.
- Command trace reveals top to bottom. Approval dock does not animate in a way that looks like auto-approve.
- Warning buffer meter is static evidence, not a countdown of doom.
