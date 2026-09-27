# EvoPulse — Implementation Plan

## Rebased build order (2026-09-27)

GitHub PR numbers and plan section numbers diverged. This is the order to build from `main` (`78bba37`).

| State | GitHub | Plan section | What it is |
| --- | --- | --- | --- |
| On main | #1 | MVP loop | 320K proposal miss → recovery → 10% block |
| On main | #2 | docs | This plan |
| On main | #3 | §1 Event layer | Everything becomes an event |
| On main | #4 | §2–§3 Graph, Twin, partial Impact | Atlas SH-204 cascade, 850K / 540K from stored amounts |
| On main | #5 | §15–§17 | Verification, outcome ledger, learning foundation (landed early) |
| Building now | — | §7 Causal Explorer | Clickable cause → event → dependency → consequence. Route `/explore` |
| Open, rebase onto explorer | #8 | §9 Impact Simulator | Read-only what-if. Land before the matcher so `dueAt` / `leadDays` are already on the graph seed |
| Open, fix then land | #7 draft | §4–§5 | Expectation matcher. Broken on an existing SQLite file, and a miss is not decided by type + entity + clock |
| Open, land last | #6 draft | §11–§12 | Goal planner. Do not merge until it stops firing the supplier delay and fulfilling quotes while planning |

Merge order for the three open PRs, after `/explore` is on the branch: **#8, then #7, then #6**. #7 and #6 auto-merge in git, but the combined `execute.ts` fulfills expectations with prose instead of an event. Learning stays on main and must not train on simulated rows.

Sections below keep their original numbers. Treat this table as the sequence.

## Target

Transform EvoPulse from:

Message → Commitment → Risk → Recovery

into:

Business Events
→ Business Twin
→ Expectations
→ Dependency Graph
→ Exceptions
→ Impact
→ Prediction
→ Planning
→ Policy
→ Execution
→ Verification
→ Learning
→ Better Future Decisions

---

## 0. PRODUCT RULE

EvoPulse has five responsibilities:

1. UNDERSTAND the business.
2. KNOW what should happen.
3. DETECT when reality diverges.
4. ACT safely.
5. LEARN from outcomes.

Core loop:

OBSERVE
→ UNDERSTAND
→ EXPECT
→ DETECT
→ EXPLAIN
→ PLAN
→ ACT
→ VERIFY
→ LEARN
↺

---

## 1. PR #2 — Unified Business Event Layer

### Goal

Everything entering EvoPulse becomes an Event.

Create:

`events`

Fields:

- id
- type
- source
- source_id
- actor_id
- entity_type
- entity_id
- payload
- occurred_at
- received_at
- confidence
- metadata

Event examples:

- message.received
- commitment.created
- commitment.fulfilled
- commitment.missed
- quote.sent
- deal.created
- deal.won
- deal.lost
- payment.expected
- payment.received
- shipment.delayed
- order.created
- task.completed
- customer.replied
- policy.blocked
- action.executed

Every future subsystem consumes the same event stream.

### Build

- EventService
- EventRepository
- Event dispatcher
- Event timeline
- Event replay support

### Definition of Done

A new event appears in EvoPulse and automatically reaches the relevant engines.

---

## 2. PR #3 — Business Graph

### Goal

Build the connected representation of the company.

Core nodes:

Person, Company, Opportunity, Order, Quote, Invoice, Payment, Supplier, Shipment, Product, Message, Commitment, Goal, Action

Core edges:

belongs_to, requested, depends_on, promised, expected, blocks, affects, produces, pays, supplies, assigned_to, caused_by, related_to

Example:

Supplier → Shipment → Product → Order → Customer → Invoice → Payment

Do NOT introduce Neo4j yet.

Use relational graph tables:

- `graph_nodes`
- `graph_edges`

Example edge:

- source_node
- relationship
- target_node
- confidence
- source_event_id

### API

- `GET /api/graph/:id`
- `GET /api/graph/:id/dependencies`
- `GET /api/graph/:id/impact`

### Definition of Done

Selecting any important object shows what is upstream and downstream from it.

---

## 3. PR #4 — Business Twin

### Goal

Create EvoPulse’s live representation of the company.

BusinessState:

- sales
- customers
- cash
- operations
- suppliers
- support

Each domain receives:

- status
- exceptions
- commitments
- dependencies
- recent_changes
- future_expectations

Example:

```
BUSINESS
Sales — 3 commitments at risk
Operations — 1 critical dependency broken
Cash — 540K expected this week
Customers — 2 waiting for response
Suppliers — 1 shipment delayed
```

### Critical rule

Do not ask an LLM: “How healthy is this company?”

Calculate state from real signals. AI may explain the state. Software determines the underlying facts.

---

## 4. PR #5 — Expectation Engine

### Goal

Make EvoPulse understand the future.

Create:

`expectations`

Fields:

- id
- type
- entity_id
- expected_event
- expected_at
- source_type
- source_id
- confidence
- status
- condition
- created_at
- resolved_at

Sources:

- commitment
- contract
- workflow
- goal
- historical_pattern
- manual

Example:

Customer said: “I’ll decide Friday.”

Creates:

- expected_event: `customer.decision`
- expected_at: Friday

---

## 5. PR #6 — Pulse / Exception Engine

### Goal

Continuously compare:

EXPECTED vs ACTUAL

Create:

`exceptions`

Fields:

- id
- expectation_id
- type
- severity
- detected_at
- status
- evidence
- confidence

Types:

- missed_commitment
- late_payment
- missing_response
- delivery_delay
- goal_drift
- dependency_failure
- unexpected_change

Core:

`ExpectedEventMatcher`

When actual event arrives:

match expected event → resolve expectation

When deadline passes:

no matching event → create exception

### Definition of Done

No LLM is needed to determine whether an explicit deadline was missed.

---

## 6. PR #7 — Impact Engine

### Goal

Answer: “What does this problem affect?”

Start from exception. Traverse Business Graph.

Example:

Supplier Delay → Shipment → Inventory → 3 Orders → 3 Customers → Invoices → Cash

Calculate:

- affected_entities
- affected_customers
- affected_orders
- associated_revenue
- cash_timing
- dependency_depth

Output:

```
OPERATIONAL CASCADE
3 customers affected
3 orders affected
850K DZD associated revenue
540K DZD expected cash timing affected
```

### Critical

Keep factual exposure separate from AI predictions.

---

## 7. PR #8 — Causal Explorer

**Status (2026-09-27):** implemented on `main` working tree as `/explore`. Click a node for source, evidence, timestamp, confidence, and affected objects. Totals still come from `calculateGraphImpact`. GitHub PR #8 is the later simulator, not this screen.

### Goal

Make impact visually understandable.

Build interactive:

CAUSE → EVENT → DEPENDENCY → CONSEQUENCE

Example:

```
SUPPLIER DELAY +2 DAYS
↓
SHIPMENT
↓
┌──────┼──────┐
ORDER A  ORDER B  ORDER C
320K     280K     250K
↓
CUSTOMER DEADLINES
↓
EXPECTED CASH
```

Click any node to inspect: source, evidence, timestamp, confidence, affected objects.

This becomes a signature demo screen.

---

## 8. PR #9 — Business Time Machine

### Goal

Make time a first-class interface.

Three modes: PAST / NOW / FUTURE

- PAST — What changed?
- NOW — What requires attention?
- FUTURE — What is expected?

Example:

- 09:13 Supplier delay received
- 09:14 Dependency cascade detected
- NOW 850K affected
- Tomorrow 3 deliveries expected
- Friday 540K payment expected

Add: “What happens next?”

---

## 9. PR #10 — Impact Simulator

### Goal

Allow controlled counterfactual scenarios.

Question: “What if the supplier is another 3 days late?”

Clone relevant business state into temporary simulation. Apply `shipment.delay += 3 days`. Propagate dependencies. Compare BASELINE vs SIMULATION.

Output example:

- +2 commitments missed
- +1 customer deadline affected
- 540K cash moves into next period

Never mutate production state. Simulation only.

---

## 10. PR #11 — Goal Engine

### Goal

Allow outcome-based commands.

Examples:

- Protect this week’s revenue.
- Collect overdue cash.
- Prevent late deliveries.
- Recover stalled opportunities.

Goal schema:

- id
- objective
- metric
- target
- deadline
- constraints
- status

Pipeline:

GOAL → Business State → Exceptions → Relevant Graph → AI Planner → Candidate Actions

---

## 11. PR #12 — Planning Engine

### Goal

Convert business problems into structured plans.

Do NOT accept prose plans.

Required schema:

`plan`

- goal
- reason
- expected_impact
- actions[]

Each action:

- type
- target
- parameters
- evidence
- risk
- confidence
- dependencies
- requires_approval

Example:

Protect 850K delivery exposure

01 Reallocate available stock  
02 Prioritize critical customer  
03 Prepare delay notice  
04 Update expected invoice date  
05 Monitor supplier

---

## 12. PR #13 — Policy Engine

### Goal

Put deterministic control between AI and execution.

Policies:

- maximum_discount
- payment_authority
- message_approval
- refund_authority
- customer_data
- procurement_limit
- working_hours

Every action:

PLAN → VALIDATE → POLICY → PERMISSIONS → RISK → AUTO / APPROVE / BLOCK

Policy decision must include: policy, decision, reason, timestamp.

AI cannot override policy.

---

## 13. PR #14 — Action Engine

### Goal

Make plans actually execute.

Action lifecycle:

proposed → approved → queued → executing → executed → failed → reverted

Initial actions:

- create_task
- update_record
- draft_message
- send_simulated_message
- schedule_followup
- escalate
- update_expectation

Every execution emits another Event.

Therefore:

ACTION → EVENT → BUSINESS STATE → PULSE

The system closes its own loop.

---

## 14. PR #15 — Verification Engine

### Goal

EvoPulse must know whether its action worked.

Example:

Problem: Customer not responding.  
Action: Follow-up sent.

Do NOT mark problem solved.

Instead:

ACTION EXECUTED → NEW EXPECTATION (“Customer response within 24h”)

Then:

- response received → success
- no response → strategy failed

This is essential for learning.

---

## 15. PR #16 — Outcome Ledger

### Goal

Store what happened after every intervention.

Create:

`outcomes`

Fields:

- id
- problem_type
- context_signature
- plan_id
- action_id
- result
- success
- time_to_result
- business_effect
- policy_state
- feedback
- created_at

Example:

- problem: stale_quote
- action: personalized_followup
- result: customer_replied
- time: 2h 14m
- success: true

This becomes EvoPulse’s learning dataset.

---

## 16. PR #17 — Auto-Learning Engine

### Goal

Learn which strategies work in which contexts.

Do NOT automatically retrain the base LLM. Learn operational patterns.

Example:

Context: existing_customer, quote_value < 500K, no_response 3–7 days

Historical outcomes:

- Call first: 62% response
- Generic email: 21%
- Personalized WhatsApp: 74%

EvoPulse learns: for this context, personalized WhatsApp historically performs best.

Store:

`learned_patterns`

Fields:

- context
- strategy
- observations
- successes
- failures
- success_rate
- confidence
- last_updated

Minimum sample threshold required. Never learn from one example.

---

## 17. Learning Confidence

Learning should progress through states:

- OBSERVED
- INSUFFICIENT_DATA
- EMERGING_PATTERN
- RELIABLE_PATTERN
- CANDIDATE_AUTOMATION
- APPROVED_AUTOMATION

Example: “WhatsApp follow-up performs better.”

- After 2 examples: INSUFFICIENT_DATA
- After 15: EMERGING_PATTERN
- After 100 consistent outcomes: RELIABLE_PATTERN

Only then recommend: “Would you like me to make this the default strategy?”

Human approves promotion.

---

## 18. PR #18 — Strategy Memory

### Goal

Give the planner access to historical performance.

Before planning:

CURRENT CONTEXT + BUSINESS GRAPH + POLICIES + SIMILAR HISTORICAL CASES + STRATEGY PERFORMANCE → PLAN

Now EvoPulse can say:

“Similar cases historically responded better to a direct follow-up than a discount.”

Evidence: 38 similar cases, 71% response vs 44% for discount-first.

This is real operational learning.

---

## 19. PR #19 — Failure Learning

Success is not enough. Learn failures.

Example:

AI recommended 5% discount. Outcome: no response. Later: customer says delivery time was the issue.

Record:

- assumed_blocker: price
- actual_blocker: delivery
- strategy: discount
- result: failed

EvoPulse learns not to over-assume price objections in similar contexts.

---

## 20. PR #20 — Human Feedback Learning

Every recommendation gets: ACCEPT / EDIT / REJECT

Capture:

- original_action
- human_change
- reason
- final_action
- outcome

If managers repeatedly change email → phone call, EvoPulse can detect: “Managers changed this recommendation 73% of the time.” Then propose updating the strategy.

Human behavior becomes a learning signal without silently changing company policy.

---

## 21. PR #21 — Pattern Discovery

Periodically analyze the Outcome Ledger.

Find patterns such as:

- “Deals without a next action for >4 days have higher failure rates.”
- “Supplier X misses Monday deliveries frequently.”
- “Quotes sent within 30 minutes receive faster responses.”
- “Payment reminders three days before due date correlate with fewer overdue invoices.”

Present them as DISCOVERED PATTERN, not FACT.

Show: sample size, time period, confidence, supporting evidence.

---

## 22. PR #22 — Early Warning Engine

Now use learned patterns proactively.

Current case: Deal 320K, no next action 3.5 days.

Historical pattern: risk increases after 4 days.

EvoPulse:

EARLY WARNING — This opportunity is approaching a historically problematic state. Evidence: 47 comparable cases.

This happens BEFORE a formal commitment is broken.

---

## 23. PR #23 — Adaptive Autonomy

Autonomy should be earned.

Each action type receives:

- reliability
- policy risk
- historical success
- human override rate

Example:

`create_task` — Reliability 99%, risk low, override 1% → AUTO

Customer discount — financial impact, policy sensitive → APPROVAL ALWAYS

EvoPulse gets more autonomous only where evidence and policy allow it.

---

## 24. PR #24 — Business Memory

Create three memory layers.

**Episodic Memory** — What happened? Events and outcomes.

**Semantic Business Memory** — What is true? Customers, suppliers, relationships, rules, products.

**Procedural Memory** — What usually works? Strategies, playbooks, successful interventions.

This gives EvoPulse persistent operational intelligence.

---

## 25. PR #25 — Business Health

Build health from evidence.

Domains: SALES, CASH, OPERATIONS, CUSTOMERS, SUPPLIERS

Never ask AI for arbitrary 0–100 scores.

Calculate from: commitment reliability, exception severity, goal progress, dependency failures, deadline performance.

AI only explains the result.

---

## 26. PR #26 — Exception Autopilot

Final operating model:

- NORMAL → EvoPulse observes silently.
- LOW-RISK EXCEPTION → automatically resolves.
- MEDIUM-RISK EXCEPTION → prepares solution.
- HIGH-RISK EXCEPTION → escalates.
- POLICY VIOLATION → blocks.

Home:

```
BUSINESS RUNNING
184 events
171 normal
9 handled automatically
2 monitoring
2 need you
```

This is the Business OS experience.

---

## 27. FINAL ARCHITECTURE

```
                EVOPULSE
                    │
             BUSINESS TWIN
                    │
    ┌───────────────┼────────────────┐
    │               │                │
BUSINESS GRAPH   BUSINESS MEMORY   GOALS
    │               │                │
    └───────────────┼────────────────┘
                    ↓
            EXPECTATION ENGINE
                    ↓
               PULSE ENGINE
                    ↓
            EXCEPTION ENGINE
                    ↓
              IMPACT ENGINE
                    ↓
              EARLY WARNING
                    ↓
                SIMULATOR
                    ↓
                 PLANNER
                    ↓
            STRATEGY MEMORY
                    ↓
                  POLICY
                    ↓
           AUTONOMY CONTROLLER
                    ↓
              ACTION ENGINE
                    ↓
               VERIFICATION
                    ↓
             OUTCOME LEDGER
                    ↓
             LEARNING ENGINE
                    │
                    └──────────→ MEMORY
                                ↺
```

---

## 28. HACKATHON BUILD CUT

Do NOT implement all 26 PRs before submission.

Build this vertical slice:

| PR | Focus |
| --- | --- |
| #2 | Event Layer |
| #3 | Business Graph |
| #5 | Expectation Engine |
| #6 | Exception Engine |
| #7 | Impact Cascade |
| #8 | Causal Graph UI |
| #9 | Business Time Machine |
| #11/#12 | Goal + Plan |
| #13 | Policy |
| #14 | Execution |
| #15 | Verification |
| #16/#17 | Minimal Outcome Learning |

Everything must connect into ONE working loop.

**Note (2026-09-27):** PR #1 already shipped a seed demo loop (320K proposal miss → recovery → policy block). Treat that as the clickable submit baseline. The §28 slice and §29 supplier-delay story are the next vertical expansion on top of main.

---

## 29. DEMO STORY

### STEP 1 — Observe

Supplier: “Your shipment will arrive Wednesday instead of Monday.”

### STEP 2 — Understand

EvoPulse: SUPPLIER DELAY +2 days

### STEP 3 — Impact

EvoPulse traverses graph.

- 3 orders affected
- 3 customers affected
- 850K associated revenue
- 540K expected cash affected

### STEP 4 — Future

Business Time Machine updates.

### STEP 5 — Goal

User: “Protect the business.”

### STEP 6 — Plan

EvoPulse generates cross-functional recovery plan.

### STEP 7 — Policy

- Safe actions: AUTO
- Customer communication: APPROVAL
- Unauthorized discount: BLOCK

### STEP 8 — Execute

Execute Safe Actions.

### STEP 9 — Verify

New expectations are created.

### STEP 10 — Learn

EvoPulse records strategy, context, action, result.

Then displays: LEARNING — “Recovery strategy recorded.”

This closes the entire intelligence loop.

---

## 30. AFTER HACKATHON

- Phase A — Real integrations
- Phase B — Business Graph expansion
- Phase C — Outcome history
- Phase D — Pattern discovery
- Phase E — Early warnings
- Phase F — Adaptive autonomy
- Phase G — Cross-business intelligence

---

## 31. ENGINEERING PRINCIPLES

- AI interprets.
- Graph connects.
- Pulse detects.
- Impact traces.
- Planner proposes.
- Policy governs.
- Actions execute.
- Verification measures.
- Outcomes teach.
- Humans remain accountable.

---

## 32. NORTH STAR

EvoPulse should eventually answer:

- WHAT HAPPENED?
- WHAT WAS SUPPOSED TO HAPPEN?
- WHAT IS HAPPENING NOW?
- WHAT WILL PROBABLY NEED ATTENTION?
- WHY?
- WHAT DOES IT AFFECT?
- WHAT SHOULD WE DO?
- WHAT CAN YOU HANDLE WITHOUT ME?
- DID IT WORK?
- WHAT DID YOU LEARN?

And then become better at answering those questions every day.

---

## 33. PRODUCT DEFINITION

EvoPulse is a self-improving Business Control System that builds a live model of a company, understands expectations and dependencies, detects operational deviations, traces their consequences, safely coordinates responses, verifies outcomes, and learns which interventions work best over time.

---

## 34. CORE MOAT

The moat is not the LLM.

The moat becomes:

Business Graph
+ Commitment History
+ Expectation History
+ Outcome Ledger
+ Strategy Memory
+ Company Policies
+ Human Corrections
+ Learned Operational Patterns

The longer EvoPulse operates inside a company, the better its understanding of how that specific business actually works.

That is the compounding intelligence layer.
