# EvoPulse — PLAN.md

## Product
EvoPulse

## Category
AI-Native Business Operating System

## Core Thesis

Businesses do not fail because they lack dashboards.

They fail because information is fragmented, commitments are forgotten,
dependencies break, risks are discovered too late, and humans constantly
have to determine what should happen next.

EvoPulse is an independent Business Operating System that continuously
understands:

1. What happened?
2. What was promised?
3. What should happen?
4. What changed?
5. What is at risk?
6. What does that risk affect?
7. What action should happen next?
8. Can AI safely execute it?

EvoPulse turns business activity into a living operational model.

---

# 1. PRODUCT VISION

Traditional software:

Data → Dashboard → Human → Decision → Action

EvoPulse:

Data
↓
Understand
↓
Detect commitments
↓
Build business context
↓
Compare expected vs actual
↓
Detect exceptions
↓
Calculate impact
↓
Plan response
↓
Policy check
↓
Human approval when necessary
↓
Execute
↓
Verify
↓
Learn
↺

EvoPulse is not another CRM.

It is not another ERP.

It is not another chatbot.

It is the intelligence and control layer sitting across a business.

---

# 2. CORE PRODUCT LOOP

OBSERVE
↓
UNDERSTAND
↓
EXPECT
↓
MONITOR
↓
DETECT
↓
ASSESS IMPACT
↓
PLAN
↓
CONTROL
↓
ACT
↓
VERIFY
↺

This loop is the heart of EvoPulse.

---

# 3. CORE PRIMITIVES

## Event

Something happened.

Examples:

- message received
- invoice issued
- payment received
- quote sent
- order created
- delivery delayed
- customer replied
- task completed

---

## Entity

Something that exists in the business.

Examples:

- person
- company
- deal
- order
- invoice
- product
- supplier
- employee
- campaign
- ticket
- document

---

## Commitment

Something someone said should happen.

Example:

"I'll confirm Friday."

Becomes:

actor: customer
action: make_decision
deadline: Friday

---

## Expectation

Something the system expects to happen.

Expectations may come from:

- commitments
- contracts
- workflows
- historical patterns
- policies
- goals

---

## Goal

A desired business outcome.

Examples:

- collect 5M DZD this month
- close 10 deals
- maintain 95% on-time delivery
- respond to leads within 10 minutes

---

## Dependency

A relationship where one outcome depends on another.

Example:

Customer decision
depends_on
Revised quotation

---

## Exception

Difference between expected state and actual state.

Expected:
Quote Thursday

Actual:
No quote Friday

Exception:
Commitment missed

---

## Policy

Rules defining what the system may do.

Example:

discount <= 5%

---

## Action

Something EvoPulse can execute.

Examples:

- create task
- draft message
- send message
- update record
- escalate issue
- schedule follow-up

---

# 4. BUSINESS GRAPH

All objects form one connected graph.

Customer
↓
Company
↓
Opportunity
↓
Quote
↓
Commitment
↓
Expected Decision
↓
Revenue Goal

Another example:

Supplier
↓
Shipment
↓
Production
↓
Customer Order
↓
Invoice
↓
Cash Flow

This allows EvoPulse to understand consequences.

---

# 5. COMMITMENT ENGINE

Input:

"Send me the revised proposal tomorrow and I'll confirm Friday."

AI extracts:

Commitment A

actor: company
action: send_revised_proposal
deadline: tomorrow

Commitment B

actor: customer
action: provide_decision
deadline: Friday

Dependency:

Commitment B
depends_on
Commitment A

The source evidence must always be retained.

---

# 6. EXPECTATION ENGINE

EvoPulse continuously evaluates expectations.

Statuses:

ON_TRACK
UPCOMING
AT_RISK
MISSED
FULFILLED
BLOCKED
CANCELLED

The state engine should be deterministic.

AI interprets language.

Software controls state.

---

# 7. PULSE ENGINE

The Pulse Engine watches incoming events.

For every event:

1. Identify affected entities.
2. Update business state.
3. Check commitments.
4. Check expectations.
5. Check dependencies.
6. Check goals.
7. Detect exceptions.
8. Calculate affected context.
9. Determine whether intervention is necessary.

---

# 8. IMPACT ENGINE

An exception alone is not enough.

EvoPulse determines what it affects.

Example:

Supplier delayed 2 days
↓
Production delayed
↓
3 customer orders affected
↓
1 contract deadline endangered
↓
850,000 DZD associated revenue
↓
Expected cash receipt delayed

Output:

IMPACT

Customers affected: 3
Orders affected: 3
Revenue associated: 850K
Cash timing affected: Yes
Urgency: High

Do not claim causal certainty when it cannot be established.

---

# 9. ATTENTION ENGINE

Users should not have to inspect dashboards.

EvoPulse determines what deserves attention.

Each exception receives:

severity
urgency
business impact
confidence
deadline proximity
dependency count

Then produces:

NEEDS YOU

MONITORING

HANDLED

HEALTHY

---

# 10. HOME

The home screen should answer:

"What requires my attention?"

Example:

Good morning.

2.1M DZD requires attention

3 NEED YOU
4 HANDLED
2 MONITORING

Critical

Customer decision overdue
320K opportunity
Recovery ready

Operations

Supplier delay
3 orders affected
850K associated revenue

Finance

Payment expected today
540K
No payment detected

Primary action:

[ Review Exceptions ]

Secondary:

[ Ask EvoPulse ]

---

# 11. BUSINESS TIME MACHINE

Timeline:

PAST
What happened?

NOW
What requires attention?

FUTURE
What is expected?

Example:

TODAY
320K decision overdue

TOMORROW
540K quote expires

SEP 29
150K payment expected

OCT 02
850K deliveries expected

This should become one of EvoPulse's signature interfaces.

---

# 12. AI COMMAND CENTER

Users can ask:

"What changed today?"

"What am I about to miss?"

"What is putting revenue at risk?"

"Why are deliveries late?"

"What promises did we make customers?"

"What promises did customers make us?"

"Protect this month's cash."

"Prepare everything requiring my approval."

"Fix everything you're authorized to fix."

The AI must operate on business state rather than generic chat context.

---

# 13. GOAL ENGINE

User:

"Protect this month's revenue."

EvoPulse:

GOAL
Protect monthly revenue

OBSERVED
34 open opportunities
12 pending quotes
7 missed commitments

RISKS
5 high-impact opportunities

PLAN
1. Recover stale opportunities
2. Follow up pending quotes
3. Escalate blocked deals
4. Monitor responses

The user can inspect the plan before execution.

---

# 14. RECOVERY ENGINE

When an exception occurs:

DETECT
↓
UNDERSTAND
↓
ASSESS
↓
GENERATE OPTIONS
↓
SELECT ALLOWED ACTIONS
↓
REQUEST APPROVAL
↓
EXECUTE
↓
VERIFY

Example:

Customer decision missed.

Recovery:

1. Review conversation.
2. Identify likely blocker.
3. Draft personalized follow-up.
4. Create follow-up checkpoint.
5. Request approval.
6. Execute.
7. Monitor response.

---

# 15. POLICY ENGINE

AI never receives unrestricted authority.

Example policies:

discount_max = 5%

financial_commitment_requires_approval = true

external_message_requires_approval = true

payment_over_500k_requires_approval = true

customer_data_deletion = forbidden

Every action goes through:

AI PROPOSAL
↓
SCHEMA VALIDATION
↓
POLICY
↓
PERMISSIONS
↓
APPROVAL
↓
EXECUTION

Possible outcomes:

AUTO
APPROVAL_REQUIRED
BLOCKED

---

# 16. AUTONOMY LEVELS

LEVEL 0 — Observe

Detect only.

LEVEL 1 — Recommend

Detect + recommend.

LEVEL 2 — Prepare

Prepare actions.

LEVEL 3 — Execute Safe Actions

Execute low-risk operations.

LEVEL 4 — Operate Within Policy

Execute workflows autonomously inside defined boundaries.

The system should begin conservatively.

---

# 17. EVIDENCE

Every AI-generated conclusion must expose evidence.

Example:

WHY IS THIS AT RISK?

Source:
Customer conversation

Evidence:
"I'll confirm Friday."

Expected:
Decision Friday

Actual:
No decision received

Deal:
320,000 DZD

Confidence:
94%

Never expose hidden chain-of-thought.

Expose business evidence and concise rationale.

---

# 18. CORE TECHNICAL ARCHITECTURE

INPUTS

Text
Voice
Email
Documents
APIs
Webhooks

↓

INGESTION

↓

ENTITY RESOLUTION

↓

BUSINESS GRAPH

↓

AI UNDERSTANDING

↓

COMMITMENT EXTRACTION

↓

EXPECTATION ENGINE

↓

PULSE ENGINE

↓

EXCEPTION ENGINE

↓

IMPACT ENGINE

↓

PLANNER

↓

POLICY ENGINE

↓

APPROVAL

↓

ACTION ENGINE

↓

EXTERNAL SYSTEMS

↓

EVENT RETURNS

↓

VERIFY

↺

---

# 19. AI VS DETERMINISTIC SOFTWARE

AI handles:

- natural language
- entity extraction
- commitment extraction
- context interpretation
- classification
- planning
- summarization
- recovery suggestions

Deterministic software handles:

- deadlines
- permissions
- policies
- financial calculations
- database integrity
- state transitions
- execution
- audit logs

Principle:

AI reasons.
Software enforces.
Humans govern.

---

# 20. MVP

Do NOT build the entire OS first.

Hackathon MVP:

INPUT
↓
COMMITMENT EXTRACTION
↓
BUSINESS GRAPH
↓
EXPECTED VS ACTUAL
↓
EXCEPTION
↓
BUSINESS IMPACT
↓
RECOVERY PLAN
↓
POLICY
↓
APPROVAL
↓
EXECUTION

One perfect loop.

---

# 21. MVP OBJECTS

Implement only:

Contact
Company
Opportunity
Message
Commitment
Expectation
Action
Policy
Event

Avoid unnecessary ERP complexity.

---

# 22. MVP SCENARIO

Customer:

"Send the revised 320,000 DZD proposal tomorrow and I'll give you my decision Friday."

EvoPulse detects:

OUR COMMITMENT
Send revised proposal
Tomorrow

CUSTOMER COMMITMENT
Decision
Friday

DEPENDENCY
Customer decision depends on proposal

Time passes.

Proposal was not sent.

EvoPulse:

COMMITMENT MISSED

320K opportunity requires attention.

Recovery:

Prepare proposal
Draft apology/follow-up
Create checkpoint

User:

[ Execute Recovery ]

Later customer:

"I'll sign today if you give me 10%."

AI proposes discount.

Policy:

Maximum discount = 5%

BLOCKED

Alternative recovery generated.

This single story demonstrates the whole architecture.

---

# 23. MVP SCREENS

01 — Pulse

Business attention center.

02 — Timeline

Past / Now / Future expectations.

03 — Exception Detail

Evidence + impact + dependency chain.

04 — Recovery Plan

AI-generated actions.

05 — Commitment Graph

Relationships between promises and business objects.

06 — Command

Ask EvoPulse.

Keep navigation extremely small.

---

# 24. DATABASE

Core tables:

entities
events
commitments
expectations
dependencies
goals
exceptions
actions
policies
approvals
audit_logs

Important rule:

Every AI-created object should retain:

source
confidence
model
timestamp
evidence

---

# 25. API

POST /ingest

POST /extract

GET /pulse

GET /timeline

GET /exceptions

GET /exceptions/:id

POST /exceptions/:id/plan

POST /plans/:id/approve

POST /actions/:id/execute

GET /graph/:entity

POST /ask

---

# 26. BUILD ORDER

P0 — Foundation

Database
Entities
Events
Commitments

P1 — AI Extraction

Text → structured commitments

P2 — Expectations

Deadlines + states

P3 — Pulse

Exception detection

P4 — Impact

Relationship traversal

P5 — UI

Pulse homepage
Timeline
Exception detail

P6 — Recovery

AI action plans

P7 — Policy

Allow / approval / block

P8 — Execution

Actions actually change system state

P9 — Evidence

Sources + confidence + audit trail

P10 — Voice

Speech → existing ingestion pipeline

P11 — Demo hardening

Fallbacks
Seed data
Latency
Error handling

---

# 27. NON-GOALS FOR MVP

Do not build:

Full CRM
Full ERP
Accounting
Payroll
HR
Inventory management
Marketing platform
Email client
WhatsApp clone
Workflow builder
Dozens of agents
Complex graph infrastructure
Predictive analytics

Integrate these systems later.

EvoPulse should sit above them.

---

# 28. LONG-TERM INTEGRATION MODEL

EvoPulse should remain vendor-neutral.

Potential connectors:

CRM
ERP
Accounting
Email
Messaging
Calendar
Commerce
Payments
Support
Project management
Logistics
Databases

Architecture:

SALESFORCE ─┐
HUBSPOT ────┤
SAP ────────┤
STRIPE ─────┤
SHOPIFY ────┼──→ EVOPULSE → ACTIONS
GMAIL ──────┤
SLACK ──────┤
NOTION ─────┤
CUSTOM API ─┘

EvoPulse should not require companies to replace their existing stack.

It becomes the intelligence/control layer across it.

---

# 29. NORTH STAR

Eventually the owner opens EvoPulse and sees:

BUSINESS STATUS

Healthy: 92%

Since yesterday:

147 events understood
12 commitments fulfilled
3 exceptions detected
8 actions safely executed

NEEDS YOU

2 decisions

Then they can ask:

"What changed?"

"What will break next?"

"Why?"

"What does it affect?"

"What can you fix?"

And EvoPulse acts within policy.

---

# 30. POSITIONING

Do not position EvoPulse as:

"AI CRM"

"AI ERP"

"AI assistant"

"AI chatbot"

"Another all-in-one platform"

Position it as:

EvoPulse
Business Control System

Other systems tell you what happened.

EvoPulse understands what was supposed to happen,
detects when reality diverges,
shows what it affects,
and coordinates what happens next.

---

# 31. PRODUCT PRINCIPLES

1. Exceptions over dashboards.
2. Evidence over hallucination.
3. Outcomes over workflows.
4. Commitments are first-class data.
5. Expected vs actual drives intelligence.
6. Context before action.
7. Policies before autonomy.
8. Human control for consequential decisions.
9. Integrate rather than replace.
10. Every autonomous action must be auditable.

---

# 32. ONE-SENTENCE PITCH

EvoPulse is an AI-native Business Control System that understands
what a business expects to happen, detects when reality diverges,
calculates the impact, and safely coordinates what should happen next.

---

# 33. TAGLINE

EvoPulse

Nothing falls through.
