import type { DatabaseSync } from "node:sqlite";

function columnNames(db: DatabaseSync, table: string): Set<string> {
  return new Set(
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name),
  );
}

function addColumn(db: DatabaseSync, cols: Set<string>, table: string, name: string, ddl: string) {
  if (cols.has(name)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  cols.add(name);
}

export function migrateGoalTables(db: DatabaseSync) {
  const goals = columnNames(db, "goals");
  addColumn(db, goals, "goals", "objective", "objective TEXT NOT NULL DEFAULT ''");
  addColumn(db, goals, "goals", "goal_type", "goal_type TEXT NOT NULL DEFAULT ''");
  addColumn(db, goals, "goals", "scope", "scope TEXT NOT NULL DEFAULT ''");
  addColumn(db, goals, "goals", "metric", "metric TEXT NOT NULL DEFAULT ''");
  addColumn(db, goals, "goals", "deadline", "deadline TEXT NOT NULL DEFAULT ''");
  addColumn(db, goals, "goals", "constraints", "constraints TEXT NOT NULL DEFAULT '{}'");
  addColumn(db, goals, "goals", "priority", "priority INTEGER NOT NULL DEFAULT 0");
  addColumn(db, goals, "goals", "status", "status TEXT NOT NULL DEFAULT 'DRAFT'");
  addColumn(db, goals, "goals", "source", "source TEXT NOT NULL DEFAULT 'manual'");
  addColumn(db, goals, "goals", "created_at", "created_at TEXT NOT NULL DEFAULT ''");
  addColumn(db, goals, "goals", "updated_at", "updated_at TEXT NOT NULL DEFAULT ''");
  addColumn(db, goals, "goals", "completed_at", "completed_at TEXT");
  addColumn(db, goals, "goals", "metadata", "metadata TEXT NOT NULL DEFAULT '{}'");
  db.exec(`
    UPDATE goals
    SET objective = CASE WHEN objective = '' OR objective IS NULL THEN name ELSE objective END
    WHERE objective = '' OR objective IS NULL
  `);

  const plans = columnNames(db, "plans");
  addColumn(db, plans, "plans", "goal_id", "goal_id TEXT");
  addColumn(db, plans, "plans", "expected_impact", "expected_impact TEXT NOT NULL DEFAULT '{}'");

  const actions = columnNames(db, "actions");
  addColumn(db, actions, "actions", "domain", "domain TEXT NOT NULL DEFAULT ''");
  addColumn(db, actions, "actions", "target_type", "target_type TEXT");
  addColumn(db, actions, "actions", "target_id", "target_id TEXT");
  addColumn(db, actions, "actions", "priority", "priority INTEGER NOT NULL DEFAULT 0");
  addColumn(db, actions, "actions", "risk", "risk TEXT NOT NULL DEFAULT 'medium'");
  addColumn(db, actions, "actions", "confidence", "confidence REAL NOT NULL DEFAULT 0.8");
  addColumn(db, actions, "actions", "dependencies_json", "dependencies_json TEXT NOT NULL DEFAULT '[]'");
}
