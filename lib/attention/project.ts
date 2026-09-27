import type { DatabaseSync } from "node:sqlite";
import { all } from "../db";
import { ExceptionAutopilotService, type AutopilotCard } from "../autopilot";
import { calculateGraphImpact } from "../engine/impact";
import { IDS } from "../ids";
import type { ExceptionRow } from "../types";
import { EarlyWarningEngine, type WarningRow } from "../warnings";
import { parseJson, rootEntity, situationKey } from "./identity";
import {
  attentionRank,
  isNeedsMe,
  summarizeClassifications,
  type AttentionItem,
  type AttentionLayer,
  type AttentionProjection,
} from "./types";

type Member = {
  card: AutopilotCard;
  exception?: ExceptionRow;
  warning?: WarningRow;
};

export function projectAttention(db: DatabaseSync, now: string): AttentionProjection {
  const snapshot = ExceptionAutopilotService.for(db).evaluateSituation(now);
  const exceptions = all<ExceptionRow>(db, "SELECT * FROM exceptions");
  const warnings = EarlyWarningEngine.for(db).list();
  const groups = new Map<string, Member[]>();

  for (const card of snapshot.cards) {
    if (card.classification === "NORMAL") continue;
    const exception = card.exceptionId ? exceptions.find((row) => row.id === card.exceptionId) : undefined;
    const warning = card.warningId ? warnings.find((row) => row.id === card.warningId) : undefined;
    const key = situationKey(exceptions, warnings, exception, warning, card.id);
    const bucket = groups.get(key) || [];
    bucket.push({ card, exception, warning });
    groups.set(key, bucket);
  }

  const items = [...groups.entries()].map(([key, members]) => toItem(db, key, members));
  items.sort((a, b) => attentionRank(a.classification) - attentionRank(b.classification));

  return {
    items,
    needsMe: items.filter((item) => isNeedsMe(item.classification)),
    watching: items.filter((item) => item.classification === "MONITORING"),
    handled: items.filter((item) => item.classification === "HANDLED"),
    summary: summarizeClassifications(
      snapshot.summary.eventsProcessed,
      items.map((item) => item.classification),
    ),
  };
}

function toItem(db: DatabaseSync, key: string, members: Member[]): AttentionItem {
  const winner = members.slice().sort((a, b) => attentionRank(a.card.classification) - attentionRank(b.card.classification))[0];
  const exception = members.find((member) => member.exception)?.exception;
  const warning = members.find((member) => member.warning)?.warning;
  const card = winner.card;
  const entityId = exception?.opportunity_id || rootEntity(warning) || exception?.id || warning?.entity_id || card.id;
  const entityType = exception ? "exception" : warning?.entity_type || "situation";
  const impact = impactFor(db, exception, card);
  return {
    id: key,
    situationType: exception ? "exception" : "warning",
    entityType,
    entityId,
    sourceWarningId: warning?.id || card.warningId,
    sourceExceptionId: exception?.id || card.exceptionId,
    autopilotDecisionId: card.id,
    classification: card.classification,
    reasonCode: card.reasonCode,
    title: card.title,
    summary: card.whyItMatters,
    needsFromYou: card.needsFromYou,
    impact,
    layers: layersFor(members, impact, card),
    href: card.href,
    alreadyDone: card.alreadyDone,
  };
}

function impactFor(db: DatabaseSync, exception: ExceptionRow | undefined, card: AutopilotCard) {
  if (exception?.id === IDS.excDelay || exception?.kind === "delivery_delay") {
    const graph = calculateGraphImpact(db, IDS.shipment);
    return {
      associatedRevenue: graph.associated_revenue,
      expectedCash: graph.affected_expected_cash,
      orders: graph.affected_orders.length,
      customers: graph.affected_customers.length,
      currency: graph.currency || "DZD",
    };
  }
  if (exception) {
    const stored = parseJson(exception.impact_json);
    const revenue =
      typeof stored.revenueAssociated === "number"
        ? stored.revenueAssociated
        : typeof stored.associated_revenue === "number"
          ? stored.associated_revenue
          : card.associatedRevenue;
    return {
      associatedRevenue: revenue,
      expectedCash: typeof stored.affectedExpectedCash === "number" ? stored.affectedExpectedCash : null,
      orders: null,
      customers: typeof stored.customersAffected === "number" ? stored.customersAffected : null,
      currency: typeof stored.currency === "string" ? stored.currency : "DZD",
    };
  }
  return {
    associatedRevenue: card.associatedRevenue,
    expectedCash: null,
    orders: null,
    customers: null,
    currency: card.currency || "DZD",
  };
}

function layersFor(members: Member[], impact: AttentionItem["impact"], winner: AutopilotCard): AttentionLayer[] {
  const layers: AttentionLayer[] = [];
  const seen = new Set<string>();
  const add = (layer: AttentionLayer) => {
    const key = `${layer.kind}:${layer.id || layer.label}`;
    if (seen.has(key)) return;
    seen.add(key);
    layers.push(layer);
  };
  for (const member of members) {
    if (member.exception) {
      add({
        kind: "EXCEPTION",
        id: member.exception.id,
        label: member.exception.title,
        href: `/exceptions/${member.exception.id}`,
      });
    }
    if (member.warning) {
      add({
        kind: "WARNING",
        id: member.warning.id,
        label: `Early warning ${member.warning.status}`,
        href: `/warnings/${member.warning.id}`,
      });
    }
    add({
      kind: "AUTOPILOT",
      id: member.card.id,
      label: `${member.card.classification} · ${member.card.reasonCode}`,
      href: `/autopilot/${member.card.id}`,
    });
  }
  if (impact.associatedRevenue != null) {
    const exceptionId = members.find((member) => member.exception)?.exception?.id;
    add({
      kind: "IMPACT",
      label: `${impact.associatedRevenue.toLocaleString("en-US")} ${impact.currency} associated revenue`,
      href: exceptionId ? `/impact/${exceptionId}` : undefined,
    });
  }
  if (impact.orders != null) {
    add({ kind: "GRAPH", label: `${impact.orders} orders · ${impact.customers ?? 0} customers` });
  }
  const planId = members.find((member) => member.card.planId)?.card.planId;
  if (planId) add({ kind: "PLAN", id: planId, label: "Prepared plan", href: "/goals" });
  if (members.some((member) => member.exception)) {
    add({ kind: "POLICY", label: "Policy evaluated at execution time" });
  }
  if (winner.reasonCode === "VERIFICATION_PENDING" || winner.reasonCode === "VERIFIED_RESOLVED" || winner.reasonCode === "VERIFICATION_FAILED") {
    add({ kind: "VERIFICATION", label: winner.reasonCode });
  }
  return layers;
}

export function attentionById(items: AttentionItem[], exceptionId?: string | null, warningId?: string | null) {
  return items.find(
    (item) =>
      (exceptionId && item.sourceExceptionId === exceptionId) ||
      (warningId && item.sourceWarningId === warningId) ||
      (exceptionId && item.id === `exception:${exceptionId}`) ||
      (warningId && item.id === `warning:${warningId}`),
  );
}
