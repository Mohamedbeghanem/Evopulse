import type { DatabaseSync } from "node:sqlite";
import { one, run, setMeta } from "../db";

const DEFAULT_POLICIES: [string, string, string, string][] = [
  ["pol_discount", "discount_max", "5", "Maximum commercial discount percent"],
  ["pol_finance", "financial_commitment_requires_approval", "true", "Money movement needs a human"],
  ["pol_msg", "external_message_requires_approval", "true", "Customer-facing messages need a human"],
  ["pol_pay", "payment_over_500k_requires_approval", "true", "Large payments need a human"],
  ["pol_del", "customer_data_deletion", "forbidden", "Customer data cannot be deleted"],
];

/**
 * Empty real-user workspace. Same policy gates as Atlas. No demo companies, orders, or synthetic history.
 */
export function seedWorkspaceDefaults(db: DatabaseSync) {
  const existing = one<{ c: number }>(db, "SELECT COUNT(*) as c FROM policies");
  if (!existing || existing.c === 0) {
    for (const [id, key, value, description] of DEFAULT_POLICIES) {
      run(db, "INSERT OR REPLACE INTO policies (id, key, value, description) VALUES (?, ?, ?, ?)", [
        id,
        key,
        value,
        description,
      ]);
    }
  }
  if (!one<{ value: string }>(db, "SELECT value FROM meta WHERE key = ?", ["workspace_kind"])) {
    setMeta(db, "workspace_kind", "user");
  }
  if (!one<{ value: string }>(db, "SELECT value FROM meta WHERE key = ?", ["demo_now"])) {
    setMeta(db, "demo_now", new Date().toISOString());
  }
}
