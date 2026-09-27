import type { DatabaseSync } from "node:sqlite";
import { all, getMeta } from "../db";
import { attentionById } from "../attention";
import type { AttentionItem } from "../attention/types";
import { pulseSummary } from "../engine/pulse";
import { exceptionDetail, policies } from "../read";
import type { ActionRow } from "../types";
import { mobileSituationHref } from "./routes";

/**
 * Read-only projections for the /m mobile surface.
 * Everything comes from the canonical engines (pulseSummary → projectAttention, exceptionDetail, policies).
 * No second router, no second state machine, no mock data. Nothing here writes business state
 * beyond what pulseSummary itself already does for every Pulse read (clock-driven detection).
 */

export type MobileCard = {
  id: string;
  href: string;
  classification: AttentionItem["classification"];
  title: string;
  summary: string;
  needsFromYou: string;
  why: string[];
};

export type MobileVerification = {
  id: string;
  actionId: string;
  actionTitle: string;
  exceptionId: string;
  status: string;
  expectedBy: string;
  resolvedAt: string | null;
};

export type MobileHome = {
  now: string;
  headline: string;
  counts: { needsMe: number; watching: number; handled: number; blocked: number; needsApproval: number; needsYou: number };
  needsMe: MobileCard[];
  watching: MobileCard[];
  handled: MobileCard[];
  verifications: MobileVerification[];
};

/** Canonical Why wording. 850K is associated revenue (not a loss); 540K is expected cash timing. */
export function whyLines(item: Pick<AttentionItem, "impact">): string[] {
  const { impact } = item;
  const money = (n: number) => `${n.toLocaleString("en-US")} ${impact.currency || "DZD"}`;
  const lines: string[] = [];
  if (impact.associatedRevenue) lines.push(`${money(impact.associatedRevenue)} associated revenue — not a loss.`);
  if (impact.expectedCash) lines.push(`${money(impact.expectedCash)} expected cash timing.`);
  if (impact.orders || impact.customers) {
    const bits = [
      impact.orders ? `${impact.orders} order${impact.orders === 1 ? "" : "s"}` : "",
      impact.customers ? `${impact.customers} customer${impact.customers === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    lines.push(`${bits.join(" · ")} on the business graph.`);
  }
  return lines;
}

function card(item: AttentionItem): MobileCard {
  return {
    id: item.id,
    href: mobileSituationHref(item.id),
    classification: item.classification,
    title: item.title,
    summary: item.summary,
    needsFromYou: item.needsFromYou,
    why: whyLines(item),
  };
}

function recentVerifications(db: DatabaseSync, limit = 8): MobileVerification[] {
  const rows = all<{
    id: string;
    action_id: string;
    exception_id: string;
    status: string;
    expected_by: string;
    resolved_at: string | null;
    title: string | null;
  }>(
    db,
    `SELECT v.id, v.action_id, v.exception_id, v.status, v.expected_by, v.resolved_at, a.title
       FROM verifications v LEFT JOIN actions a ON a.id = v.action_id
      ORDER BY COALESCE(v.resolved_at, v.created_at) DESC LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    actionId: row.action_id,
    actionTitle: row.title || row.action_id,
    exceptionId: row.exception_id,
    status: row.status,
    expectedBy: row.expected_by,
    resolvedAt: row.resolved_at,
  }));
}

export function mobileHome(db: DatabaseSync, now = getMeta(db, "demo_now")): MobileHome {
  const pulse = pulseSummary(db, now);
  const { attention } = pulse;
  return {
    now: pulse.now,
    headline: pulse.headline,
    counts: {
      needsMe: attention.needsMe.length,
      watching: attention.watching.length,
      handled: attention.handled.length,
      blocked: attention.summary.blocked,
      needsApproval: attention.summary.needsApproval,
      needsYou: attention.summary.needsYou,
    },
    needsMe: attention.needsMe.map(card),
    watching: attention.watching.map(card),
    handled: attention.handled.map(card),
    verifications: recentVerifications(db),
  };
}

export type MobileAction = {
  id: string;
  planId: string | null;
  title: string;
  description: string;
  type: string;
  status: string;
  policyOutcome: string;
  policyReason: string;
  /** Only APPROVAL_REQUIRED, not yet executed, attached to a plan. BLOCKED never gets an approve control. */
  canApprove: boolean;
  blocked: boolean;
};

export type MobileSituation = {
  item: MobileCard & { decisionId: string | null; sourceExceptionId: string | null; alreadyDone: string[] };
  layers: { kind: string; label: string }[];
  evidenceQuote: string | null;
  evidenceSource: string | null;
  actions: MobileAction[];
  discountMax: string;
  verifications: { id: string; status: string; actionId: string }[];
  handled: boolean;
  executedNotHandled: boolean;
  canReject: boolean;
};

export function toMobileAction(action: ActionRow): MobileAction {
  const blocked = action.policy_outcome === "BLOCKED";
  const done = action.status === "executed";
  return {
    id: action.id,
    planId: action.plan_id || null,
    title: action.title,
    description: action.description,
    type: action.type,
    status: action.status,
    policyOutcome: action.policy_outcome,
    policyReason: action.policy_reason,
    canApprove: !blocked && !done && action.policy_outcome === "APPROVAL_REQUIRED" && Boolean(action.plan_id),
    blocked,
  };
}

export function mobileSituation(db: DatabaseSync, attentionId: string, now = getMeta(db, "demo_now")): MobileSituation | null {
  const pulse = pulseSummary(db, now);
  const item =
    pulse.attention.items.find((candidate) => candidate.id === attentionId) ||
    attentionById(pulse.attention.items, attentionId);
  if (!item) return null;
  const detail = item.sourceExceptionId ? exceptionDetail(db, item.sourceExceptionId) : null;
  const actions = (detail?.actions || []).map(toMobileAction);
  const verifications = (detail?.verifications || []).map((row) => ({
    id: row.id,
    status: row.status,
    actionId: row.action_id,
  }));
  const handled = item.classification === "HANDLED";
  const executedNotHandled = !handled && actions.some((a) => a.status === "executed");
  const needsHuman = item.classification === "NEEDS_APPROVAL" || item.classification === "NEEDS_YOU";
  return {
    item: {
      ...card(item),
      decisionId: item.autopilotDecisionId,
      sourceExceptionId: item.sourceExceptionId,
      alreadyDone: item.alreadyDone,
    },
    layers: item.layers.map((layer) => ({ kind: layer.kind, label: layer.label })),
    evidenceQuote: detail?.exception.evidence.quote || null,
    evidenceSource: detail?.exception.evidence.source || null,
    actions,
    discountMax: policies(db).find((rule) => rule.key === "discount_max")?.value || "5",
    verifications,
    handled,
    executedNotHandled,
    canReject: Boolean(item.autopilotDecisionId) && needsHuman && actions.some((a) => a.canApprove),
  };
}
