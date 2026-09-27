import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import {
  CHECKPOINT_ISO,
  DECISION_DUE_ISO,
  DEMO_NOW_ISO,
  MESSAGE_ONE_ISO,
  PROPOSAL_DUE_ISO,
} from "./clock";
import { reseedAutonomy, seedAutonomy } from "./autonomy/seed";
import { EVENT_TYPES, eventsFor } from "./events";
import { IDS } from "./ids";
import { wipeCommandTables } from "./command/schema";
import { SEED_MESSAGE_ONE } from "./engine/extract";
import { buildRecoveryPlan } from "./engine/recovery";
import { seedSupplierGraph } from "./engine/seed-graph";
import { upsertExpectation } from "./engine/expectations";
import { EXCEPTION_TYPES } from "./engine/exception-types";
import { seedSyntheticLearningData, wipeLearningTables } from "./learning";
import { wipeAutopilotTables } from "./autopilot";
import { wipeWarningTables } from "./warnings";
import { wipeAgentTables } from "./agent/schema";
import { wipeOutbox } from "./outbound/outbox";
import { expandDistributionWorld } from "./company/world";

function run(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
  db.prepare(sql).run(...params);
}

function one<T>(db: DatabaseSync, sql: string, params: SQLInputValue[] = []): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function seedIfEmpty(db: DatabaseSync) {
  const existing = one<{ c: number }>(db, "SELECT COUNT(*) as c FROM entities");
  if (existing && existing.c > 0) return;
  seedWorld(db);
  seedSyntheticLearningData(db);
  seedAutonomy(db);
}

export function seedWorld(db: DatabaseSync) {
  const now = DEMO_NOW_ISO;

  run(db, "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ["demo_now", now]);
  run(db, "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ["demo_phase", "seeded"]);
  run(db, "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ["workspace_mode", "entry"]);
  run(db, "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ["company_template", "distribution"]);
  run(db, "INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ["company_name", "Atlas Medical Distribution"]);

  run(db, `INSERT OR REPLACE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`, [
    IDS.company,
    "company",
    "Atlas Medical Distribution",
    JSON.stringify({ city: "Algiers", sector: "medical-equipment-distribution" }),
    "2026-08-12T09:00:00+01:00",
  ]);
  run(db, `INSERT OR REPLACE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`, [
    IDS.contact,
    "contact",
    "Amine Khelifi",
    JSON.stringify({ role: "Purchasing Director", companyId: IDS.company, email: "amine.khelifi@atlasretail.dz" }),
    "2026-08-12T09:00:00+01:00",
  ]);
  run(db, `INSERT OR REPLACE INTO entities (id, type, name, payload, created_at) VALUES (?, ?, ?, ?, ?)`, [
    IDS.opportunity,
    "opportunity",
    "Atlas Q4 warehouse fit-out",
    JSON.stringify({ amount: 320000, currency: "DZD", stage: "proposal", companyId: IDS.company, contactId: IDS.contact }),
    "2026-09-04T11:00:00+01:00",
  ]);

  run(db, `INSERT OR REPLACE INTO goals (id, name, target, payload) VALUES (?, ?, ?, ?)`, [
    IDS.goalRevenue,
    "Protect September revenue",
    "close Atlas 320K",
    JSON.stringify({ month: "2026-09" }),
  ]);

  const policies: [string, string, string, string][] = [
    ["pol_discount", "discount_max", "5", "Maximum commercial discount percent"],
    ["pol_finance", "financial_commitment_requires_approval", "true", "Money movement needs a human"],
    ["pol_msg", "external_message_requires_approval", "true", "Customer-facing messages need a human"],
    ["pol_pay", "payment_over_500k_requires_approval", "true", "Large payments need a human"],
    ["pol_del", "customer_data_deletion", "forbidden", "Customer data cannot be deleted"],
  ];
  for (const [id, key, value, description] of policies) {
    run(db, `INSERT OR REPLACE INTO policies (id, key, value, description) VALUES (?, ?, ?, ?)`, [
      id,
      key,
      value,
      description,
    ]);
  }

  const events = eventsFor(db);
  events.append({
    id: IDS.evtDealCreated,
    type: EVENT_TYPES.DEAL_CREATED,
    source: "seed",
    source_id: IDS.opportunity,
    actor_id: IDS.company,
    entity_type: "opportunity",
    entity_id: IDS.opportunity,
    payload: { amount: 320000, currency: "DZD", name: "Atlas Q4 warehouse fit-out" },
    occurred_at: "2026-09-04T11:00:00+01:00",
    received_at: "2026-09-04T11:00:00+01:00",
    confidence: 1,
    idempotent: true,
  });
  events.append({
    id: IDS.message1,
    type: EVENT_TYPES.MESSAGE_RECEIVED,
    source: "inbox",
    source_id: IDS.contact,
    actor_id: IDS.contact,
    entity_type: "contact",
    entity_id: IDS.contact,
    payload: { text: SEED_MESSAGE_ONE, from: "Amine Khelifi" },
    occurred_at: MESSAGE_ONE_ISO,
    received_at: MESSAGE_ONE_ISO,
    confidence: 1,
    idempotent: true,
  });

  run(
    db,
    `INSERT OR REPLACE INTO commitments
      (id, actor, actor_entity_id, action, description, deadline, status, source_event_id, evidence, confidence, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.commitOurs,
      "company",
      IDS.company,
      "send_revised_proposal",
      "Send the revised 320,000 DZD proposal",
      PROPOSAL_DUE_ISO,
      "missed",
      IDS.message1,
      SEED_MESSAGE_ONE,
      0.94,
      "heuristic-v1",
      MESSAGE_ONE_ISO,
    ],
  );
  events.append({
    id: IDS.evtCommitOursCreated,
    type: EVENT_TYPES.COMMITMENT_CREATED,
    source: "seed",
    source_id: IDS.commitOurs,
    actor_id: IDS.company,
    entity_type: "commitment",
    entity_id: IDS.commitOurs,
    payload: {
      actor: "company",
      action: "send_revised_proposal",
      deadline: PROPOSAL_DUE_ISO,
      description: "Send the revised 320,000 DZD proposal",
    },
    occurred_at: MESSAGE_ONE_ISO,
    received_at: MESSAGE_ONE_ISO,
    confidence: 0.94,
    idempotent: true,
  });
  run(
    db,
    `INSERT OR REPLACE INTO commitments
      (id, actor, actor_entity_id, action, description, deadline, status, source_event_id, evidence, confidence, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.commitTheirs,
      "customer",
      IDS.contact,
      "provide_decision",
      "Customer gives a decision on Friday",
      DECISION_DUE_ISO,
      "blocked",
      IDS.message1,
      SEED_MESSAGE_ONE,
      0.92,
      "heuristic-v1",
      MESSAGE_ONE_ISO,
    ],
  );
  events.append({
    id: IDS.evtCommitTheirsCreated,
    type: EVENT_TYPES.COMMITMENT_CREATED,
    source: "seed",
    source_id: IDS.commitTheirs,
    actor_id: IDS.contact,
    entity_type: "commitment",
    entity_id: IDS.commitTheirs,
    payload: {
      actor: "customer",
      action: "provide_decision",
      deadline: DECISION_DUE_ISO,
      description: "Customer gives a decision on Friday",
    },
    occurred_at: MESSAGE_ONE_ISO,
    received_at: MESSAGE_ONE_ISO,
    confidence: 0.92,
    idempotent: true,
  });

  upsertExpectation(db, {
    id: IDS.expectOurs,
    commitment_id: IDS.commitOurs,
    description: "Revised 320,000 DZD proposal sent Thursday",
    due_at: PROPOSAL_DUE_ISO,
    status: "MISSED",
    actual: "No proposal-sent event before Thursday 18:00",
    created_at: MESSAGE_ONE_ISO,
    updated_at: now,
    type: "event",
    entity_id: IDS.opportunity,
    expected_event: "quote.sent",
    expected_at: PROPOSAL_DUE_ISO,
    source_type: "commitment",
    source_id: IDS.commitOurs,
    confidence: 0.94,
    condition: { event_type: "quote.sent" },
    resolved_at: now,
  });
  upsertExpectation(db, {
    id: IDS.expectTheirs,
    commitment_id: IDS.commitTheirs,
    description: "Customer decision Friday",
    due_at: DECISION_DUE_ISO,
    status: "BLOCKED",
    actual: "Blocked — customer cannot decide without the revised proposal",
    created_at: MESSAGE_ONE_ISO,
    updated_at: now,
    type: "event",
    entity_id: IDS.contact,
    expected_event: "customer.decision",
    expected_at: DECISION_DUE_ISO,
    source_type: "commitment",
    source_id: IDS.commitTheirs,
    confidence: 0.92,
    condition: { event_type: "customer.decision" },
  });

  run(
    db,
    `INSERT OR REPLACE INTO dependencies (id, from_id, from_type, to_id, to_type, description) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      IDS.depDecisionOnProposal,
      IDS.commitTheirs,
      "commitment",
      IDS.commitOurs,
      "commitment",
      "Customer decision depends on the revised proposal",
    ],
  );
  run(
    db,
    `INSERT OR REPLACE INTO dependencies (id, from_id, from_type, to_id, to_type, description) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      "dep_exp_chain",
      IDS.expectTheirs,
      "expectation",
      IDS.expectOurs,
      "expectation",
      "Friday decision expectation depends on Thursday send",
    ],
  );

  const impact = {
    customersAffected: 1,
    opportunitiesAffected: 1,
    revenueAssociated: 320000,
    currency: "DZD",
    cashTimingAffected: true,
    urgency: "high",
    notes: "Associated opportunity 320,000 DZD. Causal certainty is limited to this deal — not a forecast.",
  };
  const evidence = {
    source: "Customer conversation",
    quote: SEED_MESSAGE_ONE,
    expected: "Revised proposal sent Thursday 24 Sep 18:00",
    actual: "No proposal-sent event before Thursday 18:00",
    deal: "320,000 DZD",
    confidence: 0.94,
  };

  run(
    db,
    `INSERT OR REPLACE INTO exceptions
      (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at, detected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      IDS.excMissed,
      "Our commitment missed — revised proposal never sent",
      EXCEPTION_TYPES.MISSED_COMMITMENT,
      IDS.expectOurs,
      IDS.opportunity,
      "NEEDS_YOU",
      "critical",
      "high",
      JSON.stringify(impact),
      JSON.stringify(evidence),
      0.94,
      "open",
      now,
      now,
    ],
  );

  buildRecoveryPlan(db, IDS.excMissed, now);

  events.append({
    id: IDS.evtCommitMissed,
    type: EVENT_TYPES.COMMITMENT_MISSED,
    source: "pulse-engine",
    source_id: IDS.expectOurs,
    actor_id: IDS.company,
    entity_type: "commitment",
    entity_id: IDS.commitOurs,
    payload: {
      expectationId: IDS.expectOurs,
      exceptionId: IDS.excMissed,
      expected: "Revised proposal sent Thursday 24 Sep 18:00",
      actual: "No proposal-sent event before Thursday 18:00",
    },
    occurred_at: PROPOSAL_DUE_ISO,
    received_at: now,
    confidence: 0.94,
    idempotent: true,
  });
  events.append({
    id: IDS.evtExceptionMiss,
    type: EVENT_TYPES.EXCEPTION_CREATED,
    source: "pulse-engine",
    source_id: IDS.excMissed,
    actor_id: IDS.company,
    entity_type: "opportunity",
    entity_id: IDS.opportunity,
    payload: { kind: EXCEPTION_TYPES.MISSED_COMMITMENT, exceptionId: IDS.excMissed },
    occurred_at: now,
    received_at: now,
    confidence: 0.94,
    idempotent: true,
  });
  events.append({
    id: IDS.evtClockSkip,
    type: EVENT_TYPES.TIME_ADVANCED,
    source: "pulse-engine",
    source_id: IDS.opportunity,
    actor_id: IDS.company,
    entity_type: "opportunity",
    entity_id: IDS.opportunity,
    payload: {
      from: MESSAGE_ONE_ISO,
      to: now,
      note: "Simulated: proposal was not sent. Thursday send and Friday decision both lapsed.",
      checkpointPreview: CHECKPOINT_ISO,
    },
    occurred_at: now,
    received_at: now,
    confidence: 1,
    idempotent: true,
  });

  seedSupplierGraph(db);
  expandDistributionWorld(db);
}

export function wipeAndSeed(db: DatabaseSync) {
  wipeLearningTables(db);
  wipeWarningTables(db);
  wipeAutopilotTables(db);
  wipeCommandTables(db);
  wipeAgentTables(db);
  wipeOutbox(db);
  const tables = [
    "audit_logs",
    "approvals",
    "actions",
    "plans",
    "exceptions",
    "dependencies",
    "expectations",
    "commitments",
    "events",
    "goals",
    "policies",
    "expectation_changes",
    "graph_edges",
    "graph_nodes",
    "entities",
    "meta",
  ];
  for (const table of tables) {
    try {
      db.exec(`DELETE FROM ${table}`);
    } catch {
      /* table may not exist on a pre-graph database */
    }
  }
  seedWorld(db);
  seedSyntheticLearningData(db);
  reseedAutonomy(db);
}
