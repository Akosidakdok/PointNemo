import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqliteDatabase = Database.Database;

// ---------------------------------------------------------------------------
// Migrations — each function runs exactly once, tracked by PRAGMA user_version
// ---------------------------------------------------------------------------

function migration001(db: SqliteDatabase): void {
  // Preserve the original prototype tables. These are kept for sample lessons.
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS study_materials (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      source_name TEXT NOT NULL,
      extracted_text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL,
      answer_index INTEGER NOT NULL CHECK (answer_index >= 0),
      explanation TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      selected_answer INTEGER NOT NULL CHECK (selected_answer >= 0),
      is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS progress (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL UNIQUE REFERENCES topics(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('not-started', 'in-progress', 'completed')),
      completed_lessons INTEGER NOT NULL DEFAULT 0 CHECK (completed_lessons >= 0),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function migration002(db: SqliteDatabase): void {
  // P0: Document ingestion and generation job tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      sha256 TEXT NOT NULL UNIQUE,
      page_count INTEGER NOT NULL CHECK (page_count >= 1),
      normalized_char_count INTEGER NOT NULL CHECK (normalized_char_count >= 0),
      pages_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      state TEXT NOT NULL CHECK (state IN (
        'extracting', 'generating', 'validating', 'ready', 'failed', 'cancelled'
      )) DEFAULT 'extracting',
      question_set_id TEXT,
      error_code TEXT,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      cancel_requested INTEGER NOT NULL DEFAULT 0 CHECK (cancel_requested IN (0, 1))
    );
  `);
}

function migration003(db: SqliteDatabase): void {
  // P0: Question sets, topics, and questions with provenance metadata
  // Named topics_p0 / questions_p0 to avoid collision with prototype tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_sets (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      model_tag TEXT NOT NULL,
      model_digest TEXT NOT NULL,
      settings_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS topics_p0 (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions_p0 (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics_p0(id) ON DELETE CASCADE,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
      prompt TEXT NOT NULL CHECK (length(prompt) <= 300),
      options_json TEXT NOT NULL,
      answer_index INTEGER NOT NULL CHECK (answer_index BETWEEN 0 AND 3),
      explanation TEXT NOT NULL CHECK (length(explanation) <= 600),
      evidence_json TEXT NOT NULL
    );
  `);
}

function migration004(db: SqliteDatabase): void {
  // P0: Game run, slot ordering, and atomic attempt recording
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      state TEXT NOT NULL CHECK (state IN ('active', 'completed', 'failed')) DEFAULT 'active',
      player_hp INTEGER NOT NULL DEFAULT 100,
      current_encounter_hp INTEGER NOT NULL DEFAULT 100,
      xp INTEGER NOT NULL DEFAULT 0,
      combo INTEGER NOT NULL DEFAULT 0,
      current_slot_index INTEGER NOT NULL DEFAULT 0,
      rules_version TEXT NOT NULL DEFAULT '1.0',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS run_slots (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions_p0(id),
      slot_index INTEGER NOT NULL,
      encounter_type TEXT NOT NULL CHECK (encounter_type IN (
        'surface', 'twilight', 'midnight', 'boss'
      )),
      UNIQUE (run_id, slot_index)
    );

    CREATE TABLE IF NOT EXISTS run_attempts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      slot_id TEXT NOT NULL REFERENCES run_slots(id) ON DELETE CASCADE,
      selected_option_index INTEGER NOT NULL CHECK (selected_option_index BETWEEN 0 AND 3),
      is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      feedback_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (run_id, slot_id)
    );
  `);
}

// ---------------------------------------------------------------------------
// Migration runner — applies only pending migrations transactionally
// ---------------------------------------------------------------------------

const MIGRATIONS = [migration001, migration002, migration003, migration004];

function runMigrations(db: SqliteDatabase): void {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;
  for (let i = currentVersion; i < MIGRATIONS.length; i++) {
    db.transaction(() => {
      MIGRATIONS[i]!(db);
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initializeDatabase(path: string): SqliteDatabase {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
}
