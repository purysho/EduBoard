// Portal database — a separate SQLite file from the desktop app's own DB. This service
// never touches the desktop app's data directly; everything here arrives via /sync pushes
// from the desktop app, authenticated with SYNC_SECRET (see server.js).
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = process.env.PORTAL_DB_PATH || path.join(__dirname, 'data', 'portal.db')
require('fs').mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  -- Synced from the desktop app on every "Publish to portal" push. Each table is
  -- wholesale-replaced (delete + reinsert) on sync, since the desktop app is the
  -- source of truth for all of this — the portal never edits it back.
  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    level_type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth TEXT,
    student_number TEXT
  );

  CREATE TABLE IF NOT EXISTS enrollments (
    student_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY (student_id, class_id)
  );

  CREATE TABLE IF NOT EXISTS grades (
    student_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    percent REAL,
    letter TEXT,
    attendance_rate REAL,
    PRIMARY KEY (student_id, class_id)
  );

  CREATE TABLE IF NOT EXISTS homework_assignments (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    file_name TEXT,
    file_path TEXT,
    topic TEXT
  );

  -- Auto-graded formative-check questions attached to an assignment — wholesale-replaced
  -- on every publish, same as homework_assignments itself. correct_answer never leaves
  -- this table for a family's browser; only /api/me sees it, to grade a submission
  -- server-side, and only /api/me/homework strips it before returning the list.
  CREATE TABLE IF NOT EXISTS homework_questions (
    id TEXT PRIMARY KEY,
    homework_assignment_id TEXT NOT NULL,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options TEXT,
    correct_answer TEXT NOT NULL,
    points REAL NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  -- One row per student's answer to one quick-check question — kept so a student who
  -- reopens the assignment sees what they answered and whether it was correct, without
  -- being able to see the correct_answer itself if they got it wrong.
  CREATE TABLE IF NOT EXISTS homework_question_answers (
    homework_question_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    answer TEXT NOT NULL,
    correct INTEGER NOT NULL,
    PRIMARY KEY (homework_question_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS invites (
    code TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    revoked INTEGER NOT NULL DEFAULT 0,
    claimed_at TEXT
  );

  -- Portal-owned from here down: accounts, sessions, and homework status a student
  -- sets themselves. Never overwritten by /sync.
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS account_students (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    PRIMARY KEY (account_id, student_id)
  );

  CREATE TABLE IF NOT EXISTS qr_tokens (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    label TEXT,
    revoked INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS homework_submissions (
    homework_assignment_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started',
    submitted_at TEXT,
    updated_at TEXT NOT NULL,
    text_answer TEXT,
    file_name TEXT,
    file_path TEXT,
    grade TEXT,
    feedback TEXT,
    graded_at TEXT,
    PRIMARY KEY (homework_assignment_id, student_id)
  );

  -- Short teacher updates (text, optionally a photo) visible to every family with a
  -- student in that class — ClassDojo's "Class Story," the cheapest way to keep
  -- parents in the loop day to day without them needing to check grades/homework.
  CREATE TABLE IF NOT EXISTS class_posts (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    body TEXT NOT NULL,
    image_name TEXT,
    image_path TEXT,
    created_at TEXT NOT NULL
  );

  -- One thread per family account with the teacher — simple by design: this Portal
  -- serves one teacher, so there's no need to pick a recipient or scope by class.
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    read_by_teacher INTEGER NOT NULL DEFAULT 0,
    read_by_family INTEGER NOT NULL DEFAULT 0
  );

  -- Resources the teacher explicitly shared with a class's students (see
  -- lessonResources.shareWithStudents on the desktop side). Wholesale-replaced on every
  -- publish, same as homework_assignments.
  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL,
    title TEXT NOT NULL,
    study_guide TEXT
  );

  -- FTS5 keyword index over each material's chunks, mirroring the desktop app's own
  -- resource_chunks table/search — lets /me/ai/chat ground its answers in the material's
  -- actual text and cite which chunk supported each claim.
  CREATE VIRTUAL TABLE IF NOT EXISTS material_chunks USING fts5(
    material_id UNINDEXED,
    chunk_index UNINDEXED,
    text
  );

  -- Single-row config for the one shared AI key every student uses — see
  -- portalSyncService.publishToPortal on the desktop side. Never exposed to a family's
  -- browser; only this server calls the provider, with this key, on a student's behalf.
  CREATE TABLE IF NOT EXISTS ai_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    provider TEXT NOT NULL DEFAULT 'zhipu',
    api_key TEXT NOT NULL DEFAULT '',
    custom_base_url TEXT NOT NULL DEFAULT '',
    custom_model TEXT NOT NULL DEFAULT ''
  );

  -- Single-row SMTP config for the weekly parent digest email — same "teacher provisions
  -- once, pushed on every publish" shape as ai_settings. last_sent_at tracks the most
  -- recent automatic send so the hourly scheduler in server.js knows not to resend
  -- inside the same week.
  CREATE TABLE IF NOT EXISTS digest_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0,
    smtp_host TEXT NOT NULL DEFAULT '',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_user TEXT NOT NULL DEFAULT '',
    smtp_pass TEXT NOT NULL DEFAULT '',
    from_email TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    last_sent_at TEXT
  );
`)

// CREATE TABLE IF NOT EXISTS above does nothing once a table already exists on a live
// server — this covers adding a column to a table that's already been created there,
// so new columns don't need a manual ALTER TABLE on every deploy.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
}
ensureColumn('homework_assignments', 'file_name', 'file_name TEXT')
ensureColumn('homework_assignments', 'file_path', 'file_path TEXT')
ensureColumn('homework_submissions', 'text_answer', 'text_answer TEXT')
ensureColumn('homework_submissions', 'file_name', 'file_name TEXT')
ensureColumn('homework_submissions', 'file_path', 'file_path TEXT')
ensureColumn('homework_submissions', 'grade', 'grade TEXT')
ensureColumn('homework_submissions', 'feedback', 'feedback TEXT')
ensureColumn('homework_submissions', 'graded_at', 'graded_at TEXT')
ensureColumn('homework_assignments', 'topic', 'topic TEXT')
ensureColumn('homework_submissions', 'portfolio', 'portfolio INTEGER NOT NULL DEFAULT 0')
ensureColumn('accounts', 'email', 'email TEXT')

module.exports = db
