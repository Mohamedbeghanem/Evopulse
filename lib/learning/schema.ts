import type { DatabaseSync } from "node:sqlite";

/** Learning-vertical tables. Isolated from graph / twin / impact migrations. */
export function migrateLearningTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS verifications (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      exception_id TEXT NOT NULL,
      expected_event_type TEXT NOT NULL,
      expected_by TEXT NOT NULL,
      status TEXT NOT NULL,
      success_condition TEXT NOT NULL DEFAULT '{}',
      failure_condition TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      resolved_at TEXT,
      evidence TEXT NOT NULL DEFAULT '{}',
      metadata TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_verifications_status ON verifications(status);
    CREATE INDEX IF NOT EXISTS idx_verifications_exception ON verifications(exception_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_action ON verifications(action_id);

    CREATE TABLE IF NOT EXISTS outcomes (
      id TEXT PRIMARY KEY,
      problem_type TEXT NOT NULL,
      context_signature TEXT NOT NULL,
      exception_id TEXT,
      plan_id TEXT,
      action_id TEXT,
      verification_id TEXT,
      strategy TEXT NOT NULL,
      result TEXT NOT NULL,
      success INTEGER NOT NULL DEFAULT 0,
      time_to_result INTEGER,
      business_effect TEXT NOT NULL DEFAULT '',
      policy_state TEXT NOT NULL DEFAULT '',
      human_feedback TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_outcomes_context ON outcomes(context_signature);
    CREATE INDEX IF NOT EXISTS idx_outcomes_strategy ON outcomes(strategy);

    CREATE TABLE IF NOT EXISTS learned_patterns (
      id TEXT PRIMARY KEY,
      pattern_type TEXT NOT NULL,
      context_signature TEXT NOT NULL,
      strategy TEXT NOT NULL,
      observations INTEGER NOT NULL DEFAULT 0,
      successes INTEGER NOT NULL DEFAULT 0,
      failures INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 0,
      confidence REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      first_observed_at TEXT NOT NULL,
      last_updated_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      UNIQUE (context_signature, strategy, pattern_type)
    );

    CREATE TABLE IF NOT EXISTS action_feedback (
      id TEXT PRIMARY KEY,
      action_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      original_strategy TEXT NOT NULL DEFAULT '',
      final_strategy TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_action_feedback_action ON action_feedback(action_id);
  `);
}

export const LEARNING_TABLES = ["action_feedback", "learned_patterns", "outcomes", "verifications"] as const;

export function wipeLearningTables(db: DatabaseSync) {
  migrateLearningTables(db);
  for (const table of LEARNING_TABLES) db.exec(`DELETE FROM ${table}`);
}
