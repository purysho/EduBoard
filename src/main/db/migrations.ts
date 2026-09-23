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
  },
  {
    id: 4,
    name: 'student_log_entries',
    up: (db) => {
      db.exec(`
        CREATE TABLE student_log_entries (
          id TEXT PRIMARY KEY,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          type TEXT NOT NULL DEFAULT 'note',
          text TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX student_log_entries_student_idx
          ON student_log_entries(student_id, created_at);
      `)
    }
  },
  {
    id: 5,
    name: 'lesson_resources',
    up: (db) => {
      db.exec(`
        CREATE TABLE lesson_resources (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          url TEXT,
          file_path TEXT,
          notes TEXT,
          tags TEXT NOT NULL,
          standard_id TEXT REFERENCES standards(id) ON DELETE SET NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX lesson_resources_standard_idx ON lesson_resources(standard_id);
      `)
    }
  },
  {
    id: 6,
    name: 'exit_tickets',
    up: (db) => {
      db.exec(`
        CREATE TABLE exit_tickets (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL UNIQUE REFERENCES classes(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          questions TEXT NOT NULL,
          is_open INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE exit_ticket_responses (
          id TEXT PRIMARY KEY,
          exit_ticket_id TEXT NOT NULL REFERENCES exit_tickets(id) ON DELETE CASCADE,
          student_name TEXT NOT NULL,
          answers TEXT NOT NULL,
          submitted_at TEXT NOT NULL
        );
        CREATE INDEX exit_ticket_responses_ticket_idx
          ON exit_ticket_responses(exit_ticket_id, submitted_at);
      `)
    }
  },
  {
    id: 7,
    name: 'student_log_contact_fields',
    up: (db) => {
      db.exec(`
        ALTER TABLE student_log_entries ADD COLUMN contact_method TEXT;
        ALTER TABLE student_log_entries ADD COLUMN follow_up_needed INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE student_log_entries ADD COLUMN follow_up_done INTEGER NOT NULL DEFAULT 0;
      `)
    }
  },
  {
    id: 8,
    name: 'assignment_submissions',
    up: (db) => {
      db.exec(`
        CREATE TABLE assignment_submissions (
          id TEXT PRIMARY KEY,
          assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          submitted_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX assignment_submissions_assessment_student_unique
          ON assignment_submissions(assessment_id, student_id);
      `)
    }
  },
  {
    id: 9,
    name: 'seating_charts',
    up: (db) => {
      db.exec(`
        ALTER TABLE classes ADD COLUMN seating_rows INTEGER NOT NULL DEFAULT 5;
        ALTER TABLE classes ADD COLUMN seating_cols INTEGER NOT NULL DEFAULT 6;

        CREATE TABLE seat_assignments (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          row INTEGER NOT NULL,
          col INTEGER NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX seat_assignments_class_student_unique
          ON seat_assignments(class_id, student_id);
        CREATE INDEX seat_assignments_class_idx ON seat_assignments(class_id);
      `)
    }
  },
  {
    id: 10,
    name: 'course_groups',
    up: (db) => {
      db.exec(`
        CREATE TABLE course_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        ALTER TABLE classes ADD COLUMN course_group_id TEXT
          REFERENCES course_groups(id) ON DELETE SET NULL;
        ALTER TABLE classes ADD COLUMN term_weight REAL NOT NULL DEFAULT 1;

        CREATE INDEX classes_course_group_idx ON classes(course_group_id);
      `)
    }
  },
  {
    id: 11,
    name: 'class_schedule_slots',
    up: (db) => {
      db.exec(`
        CREATE TABLE class_schedule_slots (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          day_of_week INTEGER NOT NULL,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          room TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX class_schedule_slots_class_idx ON class_schedule_slots(class_id);
        CREATE INDEX class_schedule_slots_day_idx ON class_schedule_slots(day_of_week);
      `)
    }
  },
  {
    id: 12,
    name: 'homework_assignments',
    up: (db) => {
      // Named "homework_*", not "assignment_*" -- that name is already taken by the
      // file-upload submissions tied to graded Assessments (migration 8). This is an
      // unrelated concept: due-dated homework tracked (eventually) through the portal,
      // not a gradebook item.
      db.exec(`
        CREATE TABLE homework_assignments (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          description TEXT,
          due_date TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX homework_assignments_class_idx ON homework_assignments(class_id, due_date);

        CREATE TABLE homework_submissions (
          id TEXT PRIMARY KEY,
          homework_assignment_id TEXT NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'not_started',
          submitted_at TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX homework_submissions_assignment_student_unique
          ON homework_submissions(homework_assignment_id, student_id);
      `)
    }
  },
  {
    id: 13,
    name: 'portal_invites',
    up: (db) => {
      db.exec(`
        CREATE TABLE portal_invite_batches (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          count INTEGER NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE INDEX portal_invite_batches_class_idx ON portal_invite_batches(class_id);

        CREATE TABLE portal_invites (
          id TEXT PRIMARY KEY,
          batch_id TEXT NOT NULL REFERENCES portal_invite_batches(id) ON DELETE CASCADE,
          class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
          code TEXT NOT NULL UNIQUE,
          revoked INTEGER NOT NULL DEFAULT 0,
          claimed_at TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX portal_invites_batch_idx ON portal_invites(batch_id);
      `)
    }
  },
  {
    id: 14,
    name: 'notebook',
    up: (db) => {
      db.exec(`
        -- Tracks when a resource's text was last extracted+chunked, so the UI can tell
        -- "indexed" from "not yet" and re-index only what changed since.
        ALTER TABLE lesson_resources ADD COLUMN indexed_at TEXT;

        -- FTS5 gives keyword search "for free" with no embeddings/vector-DB dependency
        -- — the right tradeoff at a single classroom's resource-library scale, and it
        -- keeps the "works with any AI provider" promise (embeddings support varies a
        -- lot more across OpenAI-compatible endpoints than plain chat completions do).
        CREATE VIRTUAL TABLE resource_chunks USING fts5(
          resource_id UNINDEXED,
          chunk_index UNINDEXED,
          text
        );
      `)
    }
  },
  {
    id: 15,
    name: 'homework_attachment',
    up: (db) => {
      // Points at the file's original location on the teacher's own disk — same
      // "reference, don't copy" approach lesson_resources.file_path already uses.
      // Publishing to the Portal reads the bytes from here at publish time.
      db.exec(`
        ALTER TABLE homework_assignments ADD COLUMN file_path TEXT;
        ALTER TABLE homework_assignments ADD COLUMN file_name TEXT;
      `)
    }
  },
  {
    id: 16,
    name: 'homework_submission_details',
    up: (db) => {
      // Mirrors what a student turned in (text/file) and what the teacher graded it,
      // pulled from and pushed to the Portal — see portalSyncService.ts. The submitted
      // file itself stays on the Portal; only its name is mirrored here, for display.
      db.exec(`
        ALTER TABLE homework_submissions ADD COLUMN text_answer TEXT;
        ALTER TABLE homework_submissions ADD COLUMN file_name TEXT;
        ALTER TABLE homework_submissions ADD COLUMN grade TEXT;
        ALTER TABLE homework_submissions ADD COLUMN feedback TEXT;
        ALTER TABLE homework_submissions ADD COLUMN graded_at TEXT;
      `)
    }
  },
  {
    id: 17,
    name: 'homework_topic',
    up: (db) => {
      // Free-text grouping label (e.g. "Unit 1: Ecosystems", "Week of Oct 12") — an
      // assignment with no topic just falls into an "Other" bucket in the UI, so this
      // stays optional rather than forcing every teacher to organize by unit.
      db.exec(`ALTER TABLE homework_assignments ADD COLUMN topic TEXT;`)
    }
  },
  {
    id: 18,
    name: 'homework_submission_portfolio',
    up: (db) => {
      // A teacher-starred submission worth keeping as a growth record — pushed to the
      // Portal so families can see a curated "Portfolio" of their student's best work,
      // separate from the full graded-assignment list.
      db.exec(`ALTER TABLE homework_submissions ADD COLUMN portfolio INTEGER NOT NULL DEFAULT 0;`)
    }
  },
  {
    id: 19,
    name: 'lesson_resource_student_sharing',
    up: (db) => {
      // Resources are a personal library by default (classId null) — a teacher opts one
      // into a specific class's Portal materials by setting both of these, which is what
      // publishToPortal reads to decide what to push. studyGuide holds an AI-generated
      // summary (see aiService/materials study-guide generation), shown to students
      // alongside the source material and readable aloud via the browser's built-in TTS.
      db.exec(`
        ALTER TABLE lesson_resources ADD COLUMN class_id TEXT REFERENCES classes(id) ON DELETE SET NULL;
        ALTER TABLE lesson_resources ADD COLUMN share_with_students INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE lesson_resources ADD COLUMN study_guide TEXT;
      `)
    }
  },
  {
    id: 20,
    name: 'homework_draft_publish',
    up: (db) => {
      // New assignments start as drafts — visible only in the desktop app, never sent
      // to the Portal — so a teacher can build out homework ahead of time and publish
      // it to students when ready, rather than everything going live the moment it's
      // saved. Existing assignments default to 'draft' too: nothing has actually gone
      // out to real students yet at the point this migration ships, so there's nothing
      // that would disappear out from under anyone by starting everything unpublished.
      db.exec(`ALTER TABLE homework_assignments ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';`)
    }
  },
  {
    id: 21,
    name: 'homework_rubric_scores',
    up: (db) => {
      // A separate table from rubric_scores (which is assessment-only, with a NOT NULL
      // FK to assessments) rather than widening that table — keeps this additive and
      // leaves the existing assessment-grading path completely untouched. Scoring here
      // still writes its total through to the submission's existing grade/feedback text
      // fields (see homeworkRubricScores.ts), so everywhere that already reads a
      // submission's grade — the Portal, Portfolio, etc. — needs no changes.
      db.exec(`
        ALTER TABLE homework_assignments ADD COLUMN rubric_id TEXT REFERENCES rubrics(id) ON DELETE SET NULL;

        CREATE TABLE homework_rubric_scores (
          id TEXT PRIMARY KEY,
          homework_assignment_id TEXT NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
          student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE CASCADE,
          level_id TEXT NOT NULL REFERENCES rubric_levels(id) ON DELETE CASCADE,
          updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX homework_rubric_scores_assignment_student_criterion_unique
          ON homework_rubric_scores(homework_assignment_id, student_id, criterion_id);
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
