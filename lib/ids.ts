export function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export const IDS = {
  company: "ent_atlas",
  contact: "ent_amine",
  opportunity: "ent_opp_320k",
  document: "ent_proposal_v2",
  message1: "evt_msg_proposal",
  message2: "evt_msg_discount",
  commitOurs: "cmt_send_proposal",
  commitTheirs: "cmt_decision_friday",
  commitSign: "cmt_sign_today",
  expectOurs: "exp_send_proposal",
  expectTheirs: "exp_decision_friday",
  expectSign: "exp_sign_today",
  depDecisionOnProposal: "dep_decision_on_proposal",
  excMissed: "exc_proposal_missed",
  excDiscount: "exc_discount_blocked",
  planRecovery: "pln_recovery_320k",
  planDiscount: "pln_discount_alt",
  actPrepare: "act_prepare_proposal",
  actDraft: "act_draft_followup",
  actCheck: "act_checkpoint",
  actDiscount: "act_apply_10",
  actAlt5: "act_offer_5",
  actAltTerms: "act_offer_terms",
  actAltDraft: "act_draft_policy_reply",
  goalRevenue: "gol_month_revenue",
} as const;
