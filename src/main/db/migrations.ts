import type Database from 'better-sqlite3'

// Hand-rolled, append-only migrations instead of drizzle-kit's generated SQL files.
// Reasoning: drizzle-kit's migration folder is a dev-time artifact that would need to be
// shipped as an extra resource and read from disk at runtime, which is extra packaging
// complexity for a portable single-file app. Since this app has exactly one consumer
// (the packaged Electron app itself, no external DB clients), plain versioned SQL
// compiled straight into the binary is simpler and just as safe. Keep schema.ts (used for
// typed queries) in sync with the DDL below whenever you add a migration.

interface Migration {
  id: number
  name: string
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    id: 1,
    name: 'init',
    up: (db) => {
      db.exec(`
        CREATE TABLE settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE terms (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          school_year TEXT NOT NULL,
          start_date TEXT,
          end_date TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE students (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          preferred_name TEXT,
          student_number TEXT,
          date_of_birth TEXT,
          grade_level TEXT,
          guardian_name TEXT,
          guardian_contact TEXT,
          email TEXT,
          notes TEXT,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE classes (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          subject TEXT,
          level_type TEXT NOT NULL DEFAULT 'k12',
          grade_level TEXT,
          term_id TEXT REFERENCES terms(id) ON DELETE SET NULL,
          schedule TEXT,
          room TEXT,
          color TEXT,
          pass_mark REAL NOT NULL DEFAULT 60,
          max_score REAL NOT NULL DEFAULT 100,
          grade_thresholds TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE grade_categories (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          weight_percent REAL NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE enrollments (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          enrolled_on TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX enrollments_student_class_unique ON enrollments(student_id, class_id);

        CREATE TABLE assessments (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          category_id TEXT REFERENCES grade_categories(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          description TEXT,
          assessment_date TEXT,
          max_score REAL NOT NULL DEFAULT 100,
          is_final INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX assessments_class_idx ON assessments(class_id);

        CREATE TABLE scores (
          id TEXT PRIMARY KEY,
          assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          points_earned REAL,
          excused INTEGER NOT NULL DEFAULT 0,
          late INTEGER NOT NULL DEFAULT 0,
          comment TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX scores_assessment_student_unique ON scores(assessment_id, student_id);

        CREATE TABLE attendance_records (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'present',
          note TEXT,
          created_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX attendance_class_student_date_unique
          ON attendance_records(class_id, student_id, date);

        CREATE TABLE lesson_plans (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          week_label TEXT,
          title TEXT NOT NULL,
          objectives TEXT,
          framework TEXT,
          materials TEXT,
          activities TEXT,
          homework TEXT,
          linked_assessment_id TEXT REFERENCES assessments(id) ON DELETE SET NULL,
          standards TEXT,
          status TEXT NOT NULL DEFAULT 'planned',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX lesson_plans_class_date_idx ON lesson_plans(class_id, date);
      `)
    }
  },
  {
    id: 2,
    name: 'score_history',
    up: (db) => {
      db.exec(`
        CREATE TABLE score_history (
          id TEXT PRIMARY KEY,
          score_id TEXT NOT NULL,
          assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          previous_points REAL,
          new_points REAL,
          previous_excused INTEGER NOT NULL,
          new_excused INTEGER NOT NULL,
          changed_at TEXT NOT NULL
        );
        CREATE INDEX score_history_assessment_student_idx
          ON score_history(assessment_id, student_id);
      `)
    }
  },
  {
    id: 3,
    name: 'rubrics',
    up: (db) => {
      db.exec(`
        CREATE TABLE standards (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL,
          description TEXT NOT NULL,
          subject TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE rubrics (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE rubric_criteria (
          id TEXT PRIMARY KEY,
          rubric_id TEXT NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
          standard_id TEXT REFERENCES standards(id) ON DELETE SET NULL,
          name TEXT NOT NULL,
          description TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );
        CREATE INDEX rubric_criteria_rubric_idx ON rubric_criteria(rubric_id);

        CREATE TABLE rubric_levels (
          id TEXT PRIMARY KEY,
          criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          label TEXT NOT NULL,
          points REAL NOT NULL,
          description TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX rubric_levels_criterion_idx ON rubric_levels(criterion_id);

        ALTER TABLE assessments ADD COLUMN rubric_id TEXT REFERENCES rubrics(id) ON DELETE SET NULL;

        CREATE TABLE rubric_scores (
          id TEXT PRIMARY KEY,
          assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          level_id TEXT NOT NULL REFERENCES rubric_levels(id) ON DELETE CASCADE,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX rubric_scores_assessment_student_criterion_unique
          ON rubric_scores(assessment_id, student_id, criterion_id);
      `)
    }
  }
]

export function runMigrations(db: Database.Database): void {
  db.pragma('foreign_keys = OFF')
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

  const applied = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as { id: number }[]).map((r) => r.id)
  )

  const pending = migrations.filter((m) => !applied.has(m.id)).sort((a, b) => a.id - b.id)

  for (const migration of pending) {
    const run = db.transaction(() => {
      migration.up(db)
      db.prepare('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)').run(
        migration.id,
        migration.name,
        new Date().toISOString()
      )
    })
    run()
  }

  db.pragma('foreign_keys = ON')
}
