import type { DatabaseSync } from "node:sqlite";
import { DEMO_NOW_ISO, MESSAGE_ONE_ISO, MESSAGE_TWO_ISO } from "../clock";
import { all, audit, getMeta, one, run, setMeta } from "../db";
import { EVENT_TYPES, eventsFor } from "../events";
import { id, IDS } from "../ids";
import { extractCommitments, SEED_MESSAGE_TWO } from "./extract";
import { detectExceptions } from "./pulse";
import { buildDiscountAlternative } from "./recovery";
import { calculateImpact } from "./impact";
import type { CommitmentRow, EvidencePack } from "../types";
import { handleLearningEvent } from "../learning";

export async function ingestMessage(
  db: DatabaseSync,
  text: string,
  options: { occurredAt?: string; source?: string } = {},
) {
  const now = getMeta(db, "demo_now", DEMO_NOW_ISO);
  const occurredAt = options.occurredAt || now;
  const eventId = /10%/.test(text) ? IDS.message2 : id("evt");
  const events = eventsFor(db);

  events.append({
    id: eventId,
    type: EVENT_TYPES.MESSAGE_RECEIVED,
    source: options.source || "inbox",
    source_id: eventId,
    actor_id: IDS.contact,
    entity_type: "contact",
    entity_id: IDS.contact,
    payload: { text, from: "Amine Khelifi" },
    occurred_at: occurredAt,
    received_at: now,
    confidence: 1,
    idempotent: true,
  });
  if (/10%/.test(text)) {
    events.append({
      id: IDS.evtCustomerReplied,
      type: EVENT_TYPES.CUSTOMER_REPLIED,
      source: options.source || "inbox",
      source_id: eventId,
      actor_id: IDS.contact,
      entity_type: "contact",
      entity_id: IDS.contact,
      payload: { text, from: "Amine Khelifi", inReplyTo: IDS.message1 },
      occurred_at: occurredAt,
      received_at: now,
      confidence: 0.93,
      idempotent: true,
    });
    const replied = events.getById(IDS.evtCustomerReplied);
    if (replied) handleLearningEvent(db, replied);
  }
  audit(db, "ingest", "message.received", "event", eventId, { text });

  const extraction = await extractCommitments(text, occurredAt, now);

  for (const c of extraction.commitments) {
    const existing = one<CommitmentRow>(
      db,
      "SELECT * FROM commitments WHERE action = ? AND actor = ?",
      [c.action, c.actor],
    );
    const cid = existing?.id || id("cmt");
    if (!existing) {
      run(
        db,
        `INSERT INTO commitments (id, actor, actor_entity_id, action, description, deadline, status, source_event_id, evidence, confidence, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cid,
          c.actor,
          c.actor === "customer" ? IDS.contact : IDS.company,
          c.action,
          c.description,
          c.deadline,
          "open",
          eventId,
          c.evidence,
          c.confidence,
          extraction.model,
          now,
        ],
      );
      run(
        db,
        `INSERT INTO expectations (id, commitment_id, description, due_at, status, actual, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id("exp"), cid, c.description, c.deadline, "ON_TRACK", "", now, now],
      );
      events.append({
        type: EVENT_TYPES.COMMITMENT_CREATED,
        source: "ingest",
        source_id: cid,
        actor_id: c.actor === "customer" ? IDS.contact : IDS.company,
        entity_type: "commitment",
        entity_id: cid,
        payload: {
          actor: c.actor,
          action: c.action,
          description: c.description,
          deadline: c.deadline,
        },
        occurred_at: occurredAt,
        received_at: now,
        confidence: c.confidence,
        idempotent: true,
      });
    }
  }

  for (const dep of extraction.dependencies) {
    const from = one<CommitmentRow>(db, "SELECT * FROM commitments WHERE action = ?", [dep.dependentAction]);
    const to = one<CommitmentRow>(db, "SELECT * FROM commitments WHERE action = ?", [dep.prerequisiteAction]);
    if (from && to) {
      const exists = one(db, "SELECT id FROM dependencies WHERE from_id = ? AND to_id = ?", [from.id, to.id]);
      if (!exists) {
        run(
          db,
          `INSERT INTO dependencies (id, from_id, from_type, to_id, to_type, description) VALUES (?, ?, ?, ?, ?, ?)`,
          [id("dep"), from.id, "commitment", to.id, "commitment", dep.description],
        );
      }
    }
  }

  if (extraction.requestedDiscountPct && extraction.requestedDiscountPct > 5) {
    const impact = calculateImpact(db);
    const evidence: EvidencePack = {
      source: "Customer conversation",
      quote: text,
      expected: "Any commercial concession stays at or under discount_max=5%",
      actual: `${extraction.requestedDiscountPct}% requested to sign today`,
      deal: `${impact.revenueAssociated.toLocaleString("en-US")} ${impact.currency}`,
      confidence: 0.93,
    };
    run(
      db,
      `INSERT INTO exceptions (id, title, kind, expectation_id, opportunity_id, attention, severity, urgency, impact_json, evidence_json, confidence, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET attention = 'NEEDS_YOU', status = 'open'`,
      [
        IDS.excDiscount,
        "Discount request exceeds policy — 10% BLOCKED",
        "policy_blocked",
        null,
        IDS.opportunity,
        "NEEDS_YOU",
        "critical",
        "high",
        JSON.stringify(impact),
        JSON.stringify(evidence),
        0.93,
        "open",
        now,
      ],
    );
    buildDiscountAlternative(db, IDS.excDiscount, now);
    events.append({
      id: IDS.evtPolicyBlocked,
      type: EVENT_TYPES.POLICY_BLOCKED,
      source: "policy-engine",
      source_id: IDS.excDiscount,
      actor_id: IDS.contact,
      entity_type: "opportunity",
      entity_id: IDS.opportunity,
      payload: {
        policy: "discount_max",
        requested: extraction.requestedDiscountPct,
        max: 5,
        reason: `Policy discount_max=5% blocks a ${extraction.requestedDiscountPct}% discount.`,
      },
      occurred_at: occurredAt,
      received_at: now,
      confidence: 0.93,
      idempotent: true,
    });
    setMeta(db, "demo_phase", "discount_blocked");
  }

  detectExceptions(db, now);
  const commitments = all<CommitmentRow>(db, "SELECT * FROM commitments");
  return { eventId, extraction, commitments };
}

export async function ingestSeedDiscount(db: DatabaseSync) {
  return ingestMessage(db, SEED_MESSAGE_TWO, { occurredAt: MESSAGE_TWO_ISO, source: "demo" });
}

export async function ingestFromScratch(db: DatabaseSync, text: string, occurredAt = MESSAGE_ONE_ISO) {
  return ingestMessage(db, text, { occurredAt, source: "inbox" });
}
