import type { BusinessSnapshot } from "../../lib/simulation/types";

/**
 * Test fixture: the Atlas Supply slice of the Business Graph exactly as PR #4
 * seeds it, after "Trigger Supplier Delay" (SH-204 expected Wednesday).
 * Lets the pure engine be tested without SQLite.
 */
export const ATLAS_SUPPLY_FIXTURE: BusinessSnapshot = {
  source: "fixture",
  asOf: "2026-09-27T09:14:00+01:00",
  nodes: [
    { id: "ent_atlas_supply", type: "supplier", label: "Atlas Supply", attrs: {} },
    {
      id: "ent_ship_204",
      type: "shipment",
      label: "Shipment SH-204",
      attrs: {
        expectedAt: "2026-09-30T09:00:00+01:00",
        originalExpectedAt: "2026-09-28T09:00:00+01:00",
        status: "delayed",
      },
    },
    { id: "ent_product_rk7", type: "product", label: "Pallet racking kit RK-7", attrs: { lagDays: 0 } },
    {
      id: "ent_order_a",
      type: "order",
      label: "Order A — Oran Fresh",
      attrs: { amount: 320000, currency: "DZD", dueAt: "2026-09-29T10:00:00+01:00", lagDays: 1 },
    },
    {
      id: "ent_order_b",
      type: "order",
      label: "Order B — Constantine Clinic",
      attrs: { amount: 280000, currency: "DZD", dueAt: "2026-10-02T17:00:00+01:00", lagDays: 1 },
    },
    {
      id: "ent_order_c",
      type: "order",
      label: "Order C — Sétif Depot",
      attrs: { amount: 250000, currency: "DZD", dueAt: "2026-10-06T17:00:00+01:00", lagDays: 2 },
    },
    { id: "ent_cust_a", type: "customer", label: "Oran Fresh Market", attrs: {} },
    { id: "ent_cust_b", type: "customer", label: "Constantine Clinic", attrs: {} },
    { id: "ent_cust_c", type: "customer", label: "Sétif Depot", attrs: {} },
    {
      id: "ent_inv_a",
      type: "invoice",
      label: "Invoice A",
      attrs: { amount: 200000, currency: "DZD", dueAt: "2026-10-02T17:00:00+01:00" },
    },
    {
      id: "ent_inv_b",
      type: "invoice",
      label: "Invoice B",
      attrs: { amount: 180000, currency: "DZD", dueAt: "2026-10-02T17:00:00+01:00" },
    },
    {
      id: "ent_inv_c",
      type: "invoice",
      label: "Invoice C",
      attrs: { amount: 160000, currency: "DZD", dueAt: "2026-10-02T17:00:00+01:00" },
    },
    {
      id: "ent_cash_week",
      type: "cash",
      label: "Expected cash — week of 28 Sep",
      attrs: { amount: 540000, currency: "DZD", periodEnd: "2026-10-04T23:59:00+01:00" },
    },
    {
      id: "cmt_ship_monday",
      type: "commitment",
      label: "Receive shipment SH-204 Monday",
      attrs: { dueAt: "2026-09-30T09:00:00+01:00", status: "at_risk" },
    },
    {
      id: "cmt_deliver_order_a",
      type: "commitment",
      label: "Deliver Order A to Oran Fresh Tuesday",
      attrs: { dueAt: "2026-09-29T10:00:00+01:00", status: "at_risk" },
    },
  ],
  edges: [
    { id: "ge_sup_ship", from: "ent_atlas_supply", to: "ent_ship_204", relationship: "supplies" },
    { id: "ge_ship_prod", from: "ent_ship_204", to: "ent_product_rk7", relationship: "contains" },
    { id: "ge_prod_oa", from: "ent_product_rk7", to: "ent_order_a", relationship: "required_by" },
    { id: "ge_prod_ob", from: "ent_product_rk7", to: "ent_order_b", relationship: "required_by" },
    { id: "ge_prod_oc", from: "ent_product_rk7", to: "ent_order_c", relationship: "required_by" },
    { id: "ge_oa_ca", from: "ent_order_a", to: "ent_cust_a", relationship: "belongs_to" },
    { id: "ge_ob_cb", from: "ent_order_b", to: "ent_cust_b", relationship: "belongs_to" },
    { id: "ge_oc_cc", from: "ent_order_c", to: "ent_cust_c", relationship: "belongs_to" },
    { id: "ge_oa_ia", from: "ent_order_a", to: "ent_inv_a", relationship: "produces" },
    { id: "ge_ob_ib", from: "ent_order_b", to: "ent_inv_b", relationship: "produces" },
    { id: "ge_oc_ic", from: "ent_order_c", to: "ent_inv_c", relationship: "produces" },
    { id: "ge_ia_cash", from: "ent_inv_a", to: "ent_cash_week", relationship: "expected_payment" },
    { id: "ge_ib_cash", from: "ent_inv_b", to: "ent_cash_week", relationship: "expected_payment" },
    { id: "ge_ic_cash", from: "ent_inv_c", to: "ent_cash_week", relationship: "expected_payment" },
    { id: "ge_ship_cmt", from: "ent_ship_204", to: "cmt_ship_monday", relationship: "related_to" },
    { id: "ge_ship_deliver", from: "ent_ship_204", to: "cmt_deliver_order_a", relationship: "affects" },
    { id: "ge_oa_deliver", from: "ent_order_a", to: "cmt_deliver_order_a", relationship: "depends_on" },
  ],
};
