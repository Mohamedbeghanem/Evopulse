# Evopulse — Closed PR Salvage Audit

- **Audit baseline (canonical main):** `42cc9a2e40055b969be5a799860f50a39e7d6235`. It is the "Merge pull request #36" commit. `origin/main` was still exactly this SHA when the audit ran.
- **Audit date:** 2026-09-27
- **Scope:** every PR that GitHub reports as closed without a merge, from `gh pr list --state closed --limit 200 --json number,title,mergedAt,headRefName,baseRefName,headRefOid` filtered to `mergedAt == null`.
- **Rules followed:**
  - No PR was reopened, no old branch was merged, and nothing was pushed to main.
  - Missing behaviour is recovered only through new, small PRs based on 42cc9a2.
  - Each salvage PR includes regression tests.

## Method

1. Each PR head was fetched with `git fetch origin pull/<n>/head:pr-<n>`. Then:
   - its commits, files and description were read
   - it was diffed against its own merge-base and against 42cc9a2
2. **Capabilities were compared by implementation, not by filename.** Where main had a file with the same name, I compared the code. Where a PR brought tests, I ran the old test file against main, or ported the scenario.
3. The golden scenarios were checked in two ways:
   - an engine-level script (`tests/zz-golden.test.ts`, run locally and not committed). The scenarios are listed in the appendix.
   - HTTP requests against a production `next build` / `next start`

## Phase 5 — Baseline on current main (42cc9a2)

| Check | Result |
|---|---|
| `npm install` | OK |
| `npm test` | **233/233 pass**, which matches the historical release baseline of 233 |
| `npx tsc --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run lint` | PASS |

Environment: Node 22.20. The tests need Node ≥ 22.13 because they use `node:sqlite`.

## Phase 1 — Inventory (11 closed-unmerged PRs; GitHub count = 11)

No closed-unmerged PRs exist beyond the 11 in the brief.

| PR | Title (short) | Head branch → base | Head SHA | Commits | Diff vs merge-base |
|---|---|---|---|---|---|
| #7 | Expectation Engine + ExpectedEventMatcher / Exception Engine | `cursor/expectation-pulse-engine-7680` → main | 272ea9e | 1 | 19 files, +995/−167 |
| #8 | Business Simulation / What-if Engine | `feat/business-simulation-engine` → main | 7ee1018 | 2 | 16 files, +1481/−4 |
| #9 | Supplier cascade follow-ups | `fix/supplier-cascade-followups` → main | b9bbe21 | 1 | 6 files, +148/−31 |
| #11 | Early Warning Intelligence | `cursor/early-warning-intelligence-e6b9` → main | 581d297 | 2 (both already in main) | 0 files outstanding (head is an ancestor of main) |
| #12 | Exception Autopilot | `cursor/exception-autopilot-e6b9` → `cursor/early-warning-intelligence-e6b9` | 1351c37 | 1 | 28 files, +1484/−17 |
| #13 | Unified AI Command Center | `feat/command-center` → main | ee586b2 | 1 (already in main) | 0 files outstanding (head is an ancestor of main) |
| #17 | Exception Autopilot (alternate) | `feat/exception-autopilot` → main | 6d64086 | 2 | 28 files, +2588/−136 |
| #21 | Control OS foundation | `cursor/control-os-foundation-d1bc` → main | c018c16 | 2 | 26 files, +3393 |
| #26 | Pulse V1 | `cursor/pulse-v1-e943` → main | b80e6af | 1 | 10 files, +2332 (design contracts) |
| #35 | Aurora Control OS production implementation | `cursor/evopulse-production-launch-468f` → main | 98255e3 | 1 | 45 files, +7717/−1587 |
| #43 | OpenRouter AI provider | `cursor/openrouter-ai-468f` → main (stacked on #35) | 63310bf | 4 (includes #35) | 67 files, +10101/−1626 |

### PR #7 — Expectation Engine + ExpectedEventMatcher

**What it added**
- `lib/engine/matcher.ts` (ExpectedEventMatcher: events fulfil, revise or miss expectations)
- `exception-types.ts`, including the `missed_commitment` alias
- `hooks.ts` (`registerEngineHook`)
- the pulse / expectations engine
- `tests/matcher.test.ts` (6 tests)

**What main has:** all of it, in hardened form, through #10 (c22ca53).
- `applyVerificationOutcome` is identical.
- `tests/matcher.test.ts` on main has the same 6 test names.
- Main is stricter than #7 in three ways:
  - Matching is scoped to the entity.
  - A fulfilment resolves the exception it satisfies.
  - The impact of a delivery delay comes from the graph.

| Capability | Status |
|---|---|
| Expectations, matcher, exception types, engine hooks | PRESENT_BUT_CHANGED (hardened) |
| #7's permissive rule that an unscoped event fulfils any expectation | DANGEROUS_TO_RESTORE (it would falsely fulfil commitments) |

**Action:** recover nothing. The canonical matcher supersedes #7.

### PR #8 — Business Simulation / What-if Engine

**What it added:** `lib/simulation/*`, a `/simulate` page, `/api/simulations`, the `Simulator` component, and simulation tests.

**What main has:** all of it (`lib/simulation`, `/simulate`, `/api/simulations`, `components/Simulator.tsx` with a "SIMULATION DISCARDED · REALITY UNCHANGED" exit check). The +3 day result differs:
- **Old #8** rolled order lateness up to the whole order and moved **all 540K** out of the period.
- **Main** defaults payment terms to 0 and removed that roll-up. The +3 day Atlas scenario moves only **Invoice C, 160,000 DZD**.

| Capability | Status |
|---|---|
| Simulation engine, API, UI and isolation | PRESENT_BUT_CHANGED |
| The old full-540K cash move | DANGEROUS_TO_RESTORE (it violates canonical semantics) |

**Evidence**
- `tests/simulation.test.ts`, "DoD: SH-204 Wednesday +3 days → Saturday IN SIMULATION ONLY…": baseline cashInPeriod 540000, movedToNextPeriod 160000, reality fingerprint unchanged
- `tests/sim-copy.test.ts`, "names Invoice C 160,000 DZD as the +3 day cash timing move — not 540K"
- `tests/reliability.test.ts`, the simulation-isolation test

**Action:** none.

### PR #9 — Supplier cascade follow-ups

**Its 5 fixes, all on main:**
1. The supplier event sets `source_id = orderId`.
2. `dep_deliver_a_on_ship` exists.
3. A revised date or a late prerequisite never masks MISSED.
4. The graph includes the 320K entities.
5. Impact is scoped downstream.

Running #9's own test file against main passes 5/5.

**Gap:** two of #9's regression tests were lost when #10 was squashed:
- `order.affected` for all 3 orders
- scoped `commitments_at_risk`

| Capability | Status |
|---|---|
| The 5 behaviour fixes | PRESENT_ON_MAIN |
| Their regression coverage | MISSING (coverage only) |

**Action:** tests-only PR **#48**.

### PR #11 — Early Warning Intelligence

**What main has:** the whole PR. Its head is an ancestor of main (it landed through #14 / 197b1a5). That includes:
- `lib/warnings` with SAFE / TIGHT / AT_RISK / MISSED
- warning evidence kinds: OBSERVED / CALCULATED / DEPENDENCY / ASSUMPTION / HISTORICAL
- `/warnings` and `/warnings/[id]`
- the warning → exception handoff

**Evidence:** `tests/warnings.test.ts`, including:
- "supplier delay creates one AT RISK warning before any missed exception"
- "deadline pass hands MISSED to Detect and escalates the warning"
- "repeated evaluation does not create duplicate warnings"

**Status:** PRESENT_ON_MAIN. **Action:** none.

### PR #12 — Exception Autopilot

**What main has:** this PR is main's canonical autopilot.
- `lib/autopilot/classify.ts`, `types.ts`, `schema.ts`, `index.ts` and most routes are byte-identical.
- Main's `service.ts` also has the #22 fixes.

**Evidence:** `tests/autopilot.test.ts`.

**Status:** PRESENT_ON_MAIN. **Action:** none.

### PR #13 — Unified AI Command Center

**What main has:** the whole PR (its head is an ancestor of main).
- Main reuses the `lib/command` CommandRouter as a **tool inside the governed AgentRuntime** (`lib/agent/playbooks.ts`).
- It is also the deterministic fallback in `/api/ask`.
- There is only one router.

**Evidence:** `tests/command.test.ts` and `tests/agent-runtime.test.ts`.

**Status:** PRESENT_BUT_CHANGED (it now runs under AgentRuntime governance). **Action:** none. No second command router was restored.

### PR #17 — Exception Autopilot (alternate implementation)

**What it added:**
- a second autopilot state machine: `engine.ts`, `matrix.ts`, `routine.ts`, `signals.ts`
- local side effects for actions
- a customer-reply demo trigger
- reply-scoped verification

| Capability | Status | Action |
|---|---|---|
| Second state machine | OBSOLETE / DANGEROUS_TO_RESTORE | Not restored |
| **Reply scoping to the target party.** A reply only verifies an action aimed at that party. | **MISSING_AND_VALUABLE.** Main let any customer reply verify the pending supplier-delay notice to Oran Fresh (bug A below). | Salvaged in **PR #44** |
| Local side effects for `create_checkpoint` / `prepare_proposal` | OBSOLETE on main. Only the 320K recovery creates `create_checkpoint`, and goal `prepare_proposal` returns early, so no bug can be reached. | None |
| Customer-reply demo trigger | Not needed. The 10% discount message already acts as Amine's reply. | None |
| Marking auto-execution failures | Missing, but theoretical and of low value | Not salvaged |

**Status:** PARTIAL.

### PR #21 — Control OS foundation

**What main has:** newer versions of #21's tokens, information architecture, layout contracts and 00-shell. #25 and #36 absorbed and superseded them.

**Status:** OBSOLETE (design archaeology). **Action:** not restored. Restoring it would bring back a stale shell over the current Control OS.

### PR #26 — Pulse V1 (design)

**What main has:** the Pulse concepts, in `components/pulse/PulseBoard.tsx`:
- one situation per item
- an inspector showing "Associated revenue … Not a loss" and "Expected cash timing … Not lost cash"
- doors to Why (`/situations/:id`), Simulate and Command
- approval, reached from the situation page

**Status:** PRESENT_ON_MAIN.
- Cosmetic difference: main shows no explicit empty-state text for the Monitoring and Handled lanes.
- **Action:** none.

### PR #35 — Aurora Control OS production implementation (stale production UI)

**What main already has, in current form:** the shell, PulseBoard, Inspector, Workspace, `components/ui/*`, and the policy, evidence, verification, situations, learning and business screens.

| Capability | Status | Action |
|---|---|---|
| Shell and screens | PRESENT_BUT_CHANGED | Not restored |
| `lib/ui/attention.ts`, a competing attention projection | DANGEROUS_TO_RESTORE. Main uses the canonical `lib/attention` (one situation = one attention item). | Not restored |
| TwinCanvas | PRESENT_BUT_CHANGED (main has domain cards plus `/graph`) | Not restored |
| EvidenceCanvas | PRESENT_BUT_CHANGED (main has EvidenceRow and `/evidence/[id]`) | Not restored |
| **Timeline tape kinds**: OBSERVED / CALCULATED / DECIDED / EXECUTED / VERIFIED / LEARNED (`lib/ui/event-kind.ts`) | **MISSING_AND_VALUABLE.** Main's Timeline promised these six kinds but rendered raw event types. | Salvaged in **PR #47**, with a stricter, fully-tested mapping |

**Status:** PARTIAL.

### PR #43 — OpenRouter AI provider (stacked on #35)

**What main already has:** everything below, through #36 / #42.
- the OpenRouter gateway behind `ModelProvider`, with a fallback model
- secret redaction
- a deterministic fallback
- a cancel route
- an 8s timeout
- money wording: model prose is never surfaced as numbers

| Capability | Status | Action |
|---|---|---|
| Rewrites of `lib/agent/deterministic.ts`, `tools.ts`, `runtime.ts`, `policy.ts` and `lib/engine/ask.ts`, plus #35's `lib/ui/attention.ts` | DANGEROUS_TO_RESTORE (they would rewrite frozen or canonical files) | Not restored |
| **Provider routing / data policy**: `OPENROUTER_DATA_POLICY=deny` becomes `provider.data_collection:"deny"`, and `OPENROUTER_ALLOWED_PROVIDERS` becomes `provider.order` + `allow_fallbacks:false` | **MISSING_AND_VALUABLE** | Salvaged in **PR #46**, inside the existing `lib/agent/openrouter.ts` provider only |

**Status:** PARTIAL.

**Harness:** none of the closed PRs had a Harness adapter. Main's `docs/HARNESS_DECISION.md` (MODE C) and `tests/harness-adapter.test.ts` are canonical. **HARNESS: CANONICAL.**

## Phase 2 — Capability matrix

| CAPABILITY | OLD PR | CURRENT MAIN | STATUS | ACTION |
|---|---|---|---|---|
| Events | #7, #17 | `lib/events`, `lib/engine/ingest.ts`, engine hooks | PRESENT_ON_MAIN | None |
| Business graph | #9 | `lib/engine/graph.ts`, `seed-graph.ts`, `/graph`; includes the 320K entities | PRESENT_ON_MAIN | Tests restored (#48) |
| Expectations | #7 | `lib/engine/expectations.ts` | PRESENT_BUT_CHANGED | None |
| Matcher | #7 | `lib/engine/matcher.ts`: entity-scoped, resolves on fulfil | PRESENT_BUT_CHANGED | None. Crash fix in #45 (not from any closed PR). |
| Exceptions | #7 | `exception-types.ts`, `/exceptions/[id]` | PRESENT_ON_MAIN | None |
| Early warning | #11 | `lib/warnings`, `/warnings`; SAFE/TIGHT/AT_RISK/MISSED plus handoff | PRESENT_ON_MAIN | None |
| Impact | #9 | `lib/engine/impact.ts`, scoped downstream | PRESENT_ON_MAIN | Tests restored (#48) |
| Causal tracing | #8, #10 | `lib/engine/causal.ts`, CausalExplorer on `/explore` and `/situations/[id]` | PRESENT_ON_MAIN | None |
| Simulation | #8 | `lib/simulation`, `/api/simulations`: 160K Invoice C, reality unchanged | PRESENT_BUT_CHANGED | None. The old 540K move is DANGEROUS_TO_RESTORE. |
| Goals | #13 | `lib/goals` ("protect everything at risk") | PRESENT_ON_MAIN | None |
| Planner | #12, #13 | autopilot plan and goal planner; `/exceptions/[id]/plan` | PRESENT_ON_MAIN | None |
| Policy | #12, #17, #43 | `lib/engine/policy.ts`, `lib/policy`: discount_max 5%, rechecked before execution | PRESENT_ON_MAIN | None |
| Autopilot | #12, #17 | `lib/autopilot` (#12 lineage) | PRESENT_ON_MAIN | None. The #17 state machine is OBSOLETE. |
| Actions | #17 | `lib/engine/execute.ts`, autopilot execute | PRESENT_ON_MAIN | None |
| Verification | #17 | `lib/learning/verification.ts` | PRESENT_BUT_CHANGED. Reply scoping was missing. | **Salvaged: #44** |
| Outcomes | #7, #17 | `applyVerificationOutcome`, learning outcomes | PRESENT_ON_MAIN | None |
| Learning | #7, #17 | `lib/learning`, `/learning` | PRESENT_ON_MAIN | None |
| Adaptive autonomy | — (only merged PRs) | `lib/autonomy` | PRESENT_ON_MAIN | None |
| AgentRuntime | #43 | `lib/agent/runtime.ts`: governed tools, no self-approval | PRESENT_ON_MAIN | None. The #43 rewrite is DANGEROUS_TO_RESTORE. |
| Command Center | #13, #43 | `/command` using AgentRuntime; CommandRouter as a tool and fallback | PRESENT_BUT_CHANGED | None |
| OpenRouter | #43 | `lib/agent/openrouter.ts` (#42) | PRESENT_BUT_CHANGED. Data policy was missing. | **Salvaged: #46** |
| Harness adapter | — | MODE C: `docs/HARNESS_DECISION.md`, `tests/harness-adapter.test.ts` | PRESENT_ON_MAIN (canonical) | None |
| Pulse | #26, #35 | `components/pulse/PulseBoard.tsx`, canonical `lib/attention` | PRESENT_ON_MAIN | None. #35's `lib/ui/attention.ts` is DANGEROUS_TO_RESTORE. |
| Situation | #35 | `/situations/[id]` | PRESENT_ON_MAIN | None |
| Timeline | #35 | `/timeline`; six kinds promised but raw types shown | PRESENT_BUT_CHANGED | **Salvaged: #47** |
| Business Twin | #35 | `lib/engine/twin.ts`, domain cards, `/graph` | PRESENT_BUT_CHANGED | None. TwinCanvas is stale UI. |
| Evidence | #11, #35 | `/evidence/[id]`, EvidenceRow, warning evidence kinds | PRESENT_BUT_CHANGED | None |
| Approval | #12, #35 | plan page approvals; AI cannot self-approve | PRESENT_ON_MAIN | None |
| Policy UI | #35 | `/policy` | PRESENT_ON_MAIN | None |
| Simulation UI | #8, #35 | `/simulate`, `components/Simulator.tsx` | PRESENT_ON_MAIN | None |
| Control OS shell | #21, #26, #35 | current shell from #25/#36 | PRESENT_BUT_CHANGED | None. #21 and #35 shells are OBSOLETE. |

## Phase 3 — Canonical semantics protection

| Rule | Evidence on main | Effect of the salvage PRs |
|---|---|---|
| 850,000 DZD = associated revenue | `tests/cascade.test.ts` "calculates 3/3/850K/540K…"; security-redteam "canonical engines remain the source of 850000…" | Unchanged |
| 540,000 DZD = expected cash timing | Same tests, plus the PulseBoard inspector copy | Unchanged |
| +3 days Atlas → 160,000 DZD Invoice C | `tests/simulation.test.ts` DoD SH-204; `tests/sim-copy.test.ts` | Unchanged. #8's 540K behaviour was not restored. |
| Simulation never mutates reality | `tests/reliability.test.ts` isolation test; state fingerprint check | Unchanged |
| discount_max = 5%; a 10% request is BLOCKED | `tests/policy.test.ts` "blocks a 10% discount when discount_max is 5%"; agent-runtime "10% discount is blocked and not executed" | Unchanged. It is also re-verified after the Protect sequence, which crashed on main (bug B). |
| AI cannot approve its own action | security-redteam "forbids self-approval…", "request_action_approval never self-approves" | Unchanged |
| Policy rechecked immediately before execution | the execution-time policy recheck in autopilot / agent-runtime tests | Unchanged |
| EXECUTED ≠ HANDLED; HANDLED requires verification | autopilot "EXECUTED != SOLVED…", "VERIFICATION SUCCESS: only then HANDLED"; reliability "EXECUTED != HANDLED…" | **Strengthened by #44.** An unrelated party's reply no longer verifies an action. |
| Prompt injection in business content is data | the security-redteam "prompt injection as data" suite | Unchanged. #46 only adds routing fields to the request body. |
| One situation = one attention item | attention and reliability tests | Unchanged. The competing projection from #35/#43 was not restored. |
| Warning before a miss, exception after it, never both active | attention "WARNING → EXCEPTION: one card before deadline, one after, never two" | Unchanged |

## Phase 4 — Answers to the specific old-PR risks

| PR | Answer |
|---|---|
| #7 | The canonical matcher supersedes it. Nothing recovered. |
| #8 | #8 moved the full 540K and was **not** restored. Canonical +3 days = 160K Invoice C. |
| #9 | All 5 corrections are on main. Only the lost regression tests were recovered (#48). |
| #11 | Early Warning states and the handoff are on main, with tests. |
| #12 / #17 | #12 is the canonical autopilot. #17's second state machine was not introduced. Only the reply-scoping behaviour was ported, into the canonical verification module (#44). |
| #13 | The CommandRouter lives inside the governed AgentRuntime. No second router. |
| #21 | Design archaeology. Not restored. |
| #26 | Pulse concepts are already present. Nothing salvaged. |
| #35 | Not merged. Only the Timeline kind mapping was extracted (#47). `lib/ui/attention.ts`, TwinCanvas and EvidenceCanvas were avoided. |
| #43 | Not merged. Only provider routing / data policy was ported into the existing provider (#46). No frozen engine or runtime file was rewritten. |

## Bugs found on main while validating the goldens

These were reproduced with engine calls and over HTTP against `next start`.

**A. Cross-party verification** (the gap that #17 had fixed)
- **Sequence:** "Protect everything" → approve all → Amine (customer) replies.
- **What happens:** the reply also verifies the pending supplier-delay notice to Oran Fresh, so `exc_shipment_delay` becomes HANDLED because of another party's reply.
- **Fix:** **#44**.

**B. Detect re-raise crash** (not from any closed PR)
- **Sequence:** the same one, followed by `POST /api/demo/discount`.
- **What happens:** the request returns **HTTP 500**, `UNIQUE constraint failed: exceptions.id`.
- **Cause:** the goal plan's `prepare_proposal` leaves `exp_ours` MISSED. The matcher then re-raises the fixed id `exc_proposal_missed` after that exception was resolved.
- **Fix:** **#45**, a 5-line guard in `raiseException` in `lib/engine/matcher.ts`.
  - This is a frozen engine file. The change is justified as a P0 crash under `docs/FEATURE_FREEZE.md`.
  - Nothing else in the matcher changes.
- **HTTP check:** with #44 and #45 applied, the same sequence returns 200, the 10% request stays BLOCKED, and `/timeline` shows `OBSERVED · customer.replied` and `VERIFIED · verification.resolved`.

## Phase 6 — New PRs (all based on 42cc9a2, not merged)

| PR | Branch | Capability | Files | Regression tests | Suite on branch |
|---|---|---|---|---|---|
| #44 | `salvage/verification-reply-scope` | Reply scoping to the target party (from #17) | `lib/learning/verification.ts`, `lib/learning/event-adapter.ts` | `tests/verification-reply-scope.test.ts` (5) | 238/238 |
| #45 | `fix/detect-reraise-resolved-320k` | Matcher must not re-raise a resolved fixed-id exception (bug B) | `lib/engine/matcher.ts` (frozen; P0) | `tests/detect-no-reraise.test.ts` (2) | 235/235 |
| #46 | `salvage/openrouter-gap` | OpenRouter provider routing / data policy (from #43) | `lib/agent/openrouter.ts`, `docs/AGENT_RUNTIME.md`, `.env.example` | `tests/openrouter-routing.test.ts` (7) | 240/240 |
| #47 | `salvage/timeline-event-kinds` | Timeline six-kind tape (from #35) | new `lib/ui/event-kind.ts`; one line in `app/timeline/page.tsx` | `tests/timeline-event-kinds.test.ts` (3) | 236/236 |
| #48 | `salvage/cascade-followups-tests` | #9 regression coverage (tests only) | none outside tests | `tests/cascade-followups-coverage.test.ts` (2) | 235/235 |

Every branch passes `tsc` and `lint` on its own. The new tests fail without their change:
- #44: the core scenario fails on main.
- #45: both tests fail on main.
- #48: reverting the `supplier.ts` `source_id` fix makes the first test fail (mutation check).

## Phase 7 — Final validation (main + #44…#48, merged locally only)

| Check | Result |
|---|---|
| `npm test` | **252/252** |
| `tsc` | PASS |
| `build` | PASS |
| `lint` | PASS |

| Golden scenario | main 42cc9a2 | main + salvage | Evidence |
|---|---|---|---|
| 1. Why is 850K at risk? (3 orders, 3 customers, 850K / 540K) | PASS | PASS | cascade "calculates 3/3/850K/540K…"; agent-runtime "why 850K calls explain_risk…"; reliability "Atlas cascade is 850K…"; golden G1 |
| 2. Atlas +3 days (160K Invoice C, reality unchanged) | PASS | PASS | simulation DoD SH-204; sim-copy; reliability isolation; golden G2 |
| 3. Protect everything (investigate → plan → safe actions → approval → blocked stays blocked → verification) | **FAIL** (bug B crash; bug A false HANDLED) | PASS | agent-runtime "protect everything inspects, plans, executes AUTO, and pauses for approval"; golden G3; HTTP 500 → 200 |
| 4. 10% discount BLOCKED, discount_max 5% | PASS | PASS | policy "blocks a 10% discount when discount_max is 5%"; agent-runtime; golden G4 |
| 5. Warning lifecycle / handoff | PASS | PASS | attention "WARNING → EXCEPTION…never two"; warnings tests; golden G5 |
| 6. EXECUTED ≠ HANDLED, verification decides | PASS (as defined) | PASS (and cross-party fixed) | autopilot "VERIFICATION SUCCESS: only then HANDLED"; reliability "EXECUTED != HANDLED…"; golden G6 |
| 7. Prompt injection is data | PASS | PASS | security-redteam "prompt injection as data" suite; golden G7 |

The engine-level golden script gave **6/7 on main** (G3 fails) and **7/7 with the salvage PRs**.

## Duplicate code and stale UI avoided

**Duplicate code avoided**
- #17's second autopilot state machine (`engine.ts`, `matrix.ts`, `routine.ts`, `signals.ts`)
- a second command router (#13 is reused, not duplicated)
- #35/#43's competing attention projection (`lib/ui/attention.ts`)
- #43's rewrites of `deterministic.ts`, `tools.ts`, `runtime.ts`, `policy.ts` and `ask.ts`
- #7's permissive matcher
- #8's 540K simulation

**Stale UI avoided**
- the #21 shell and tokens
- #35's full production UI: Aurora shell, TwinCanvas, EvidenceCanvas and restyled screens
- #43's copy of the #35 UI
- #26's design contracts, which are already realised in PulseBoard

## Uncertainties

- **#44** matches a reply's sender to the action's target using entity ids plus a name heuristic on `to`. Party names that differ only slightly could still need review.
- **#45** touches the frozen `lib/engine/matcher.ts`. The change is minimal and justified as a P0 crash fix.
- The 252/252 integration result comes from a local branch. After the PRs merge, re-run the suite on real main.

## Appendix — golden script scenarios

`tests/zz-golden.test.ts` is a local, uncommitted script. It uses only public engine and service entry points.

| Scenario | What it checks |
|---|---|
| G1 | Atlas cascade has 3 orders, 3 customers, associated revenue 850000 and cash timing 540000 |
| G2 | The +3 day simulation has `movedToNextPeriod` 160000 (Invoice C) and an unchanged reality fingerprint |
| G3 | "Protect everything": the goal plan executes AUTO actions, then approvals, then Amine's reply. The supplier notice stays unverified, and the 10% discount is BLOCKED without crashing. |
| G4 | A 10% discount is BLOCKED with discount_max 5% |
| G5 | AT_RISK warning before the deadline, one exception after it, one attention item |
| G6 | An EXECUTED action is not HANDLED until verification succeeds |
| G7 | Injected supplier/customer text cannot change policy or approve actions |
