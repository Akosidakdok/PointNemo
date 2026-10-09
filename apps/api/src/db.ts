import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type SqliteDatabase = Database.Database;

export function initializeDatabase(path: string): SqliteDatabase {
  mkdirSync(dirname(path), { recursive: true });

  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.exec(`
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

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      source_name TEXT NOT NULL,
      source_sha256 TEXT NOT NULL,
      page_count INTEGER,
      normalized_chars INTEGER,
      extracted_pages_json TEXT,
      normalized_text TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      state TEXT NOT NULL CHECK (state IN ('extracting', 'generating', 'validating', 'ready', 'failed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      question_set_id TEXT,
      error_code TEXT,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS generation_jobs_document_idx ON generation_jobs(document_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS generation_jobs_state_idx ON generation_jobs(state);

    CREATE TABLE IF NOT EXISTS question_sets (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      state TEXT NOT NULL CHECK (state IN ('ready')),
      model_name TEXT NOT NULL,
      model_digest TEXT,
      extractor_version TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      rules_version TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS question_sets_document_idx ON question_sets(document_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS question_set_topics (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      topic_key TEXT NOT NULL,
      title TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 2),
      UNIQUE(question_set_id, topic_key),
      UNIQUE(question_set_id, ordinal)
    );

    CREATE TABLE IF NOT EXISTS mvp_questions (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES question_set_topics(id) ON DELETE CASCADE,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
      prompt TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_option_index INTEGER NOT NULL CHECK (correct_option_index BETWEEN 0 AND 3),
      explanation TEXT NOT NULL,
      evidence_page INTEGER NOT NULL CHECK (evidence_page BETWEEN 1 AND 3),
      evidence_quote TEXT NOT NULL,
      ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 0 AND 8),
      UNIQUE(question_set_id, topic_id, difficulty),
      UNIQUE(question_set_id, ordinal)
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      rules_version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'failed', 'completed')),
      current_stage TEXT NOT NULL CHECK (current_stage IN ('surface', 'twilight', 'midnight', 'boss', 'failed', 'complete')),
      player_hp INTEGER NOT NULL DEFAULT 100 CHECK (player_hp BETWEEN 0 AND 100),
      enemy_hp INTEGER NOT NULL CHECK (enemy_hp BETWEEN 0 AND 100),
      combo INTEGER NOT NULL DEFAULT 0 CHECK (combo >= 0),
      xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
      badge_awarded INTEGER NOT NULL DEFAULT 0 CHECK (badge_awarded IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT
    );

    CREATE INDEX IF NOT EXISTS runs_question_set_idx ON runs(question_set_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS runs_active_idx ON runs(status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS run_slots (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES mvp_questions(id) ON DELETE CASCADE,
      stage TEXT NOT NULL CHECK (stage IN ('surface', 'twilight', 'midnight', 'boss')),
      ordinal INTEGER NOT NULL,
      UNIQUE(run_id, stage, ordinal)
    );

    CREATE INDEX IF NOT EXISTS run_slots_order_idx ON run_slots(run_id, stage, ordinal);

    CREATE TABLE IF NOT EXISTS run_attempts (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
      slot_id TEXT NOT NULL REFERENCES run_slots(id) ON DELETE CASCADE,
      selected_option_index INTEGER NOT NULL CHECK (selected_option_index BETWEEN 0 AND 3),
      is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
      feedback_json TEXT NOT NULL,
      attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(run_id, slot_id)
    );

    CREATE INDEX IF NOT EXISTS run_attempts_run_idx ON run_attempts(run_id, attempted_at);
  `);

  return database;
}
