import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

/**
 * Content hash of every table in the database. Taken before and after a
 * simulation run to prove the run did not mutate real business state.
 */
export function stateFingerprint(db: DatabaseSync): { hash: string; tables: number } {
  const tables = (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[]
  ).map((t) => t.name);

  const hash = createHash("sha256");
  for (const table of tables) {
    hash.update(`#${table}\n`);
    const rows = db.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}" ORDER BY rowid`).all();
    for (const row of rows) hash.update(JSON.stringify(row) + "\n");
  }
  return { hash: hash.digest("hex").slice(0, 16), tables: tables.length };
}
