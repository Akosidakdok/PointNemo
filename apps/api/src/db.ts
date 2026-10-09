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

    CREATE TABLE IF NOT EXISTS question_sets (
      id TEXT PRIMARY KEY,
      document_name TEXT NOT NULL,
      topics_json TEXT NOT NULL,
      questions_json TEXT NOT NULL,
      extracted_pages_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
      document_name TEXT NOT NULL,
      stage TEXT NOT NULL CHECK (stage IN ('surface', 'twilight', 'midnight', 'boss', 'results')),
      status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'failed')),
      current_question_index INTEGER NOT NULL DEFAULT 0,
      player_hp INTEGER NOT NULL DEFAULT 100,
      enemy_hp INTEGER NOT NULL DEFAULT 100,
      xp INTEGER NOT NULL DEFAULT 0,
      shuffled_boss_order_json TEXT NOT NULL,
      attempts_json TEXT NOT NULL DEFAULT '[]',
      zone_scores_json TEXT NOT NULL DEFAULT '{"surface":0,"twilight":0,"midnight":0}',
      failure_reason TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return database;
}
