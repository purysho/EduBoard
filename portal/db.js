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
    file_path TEXT
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
    PRIMARY KEY (homework_assignment_id, student_id)
  );
`)

module.exports = db
