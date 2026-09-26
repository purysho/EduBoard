// Portal database — a separate SQLite file from the desktop app's own DB. This service
// never touches the desktop app's data directly; everything here arrives via /sync pushes
// from the desktop app, authenticated with SYNC_SECRET (see server.js).
const path = require('path')
const Database = require('better-sqlite3')

const { DB_PATH } = require('./paths')
require('fs').mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  -- One row per teacher using this Portal — what makes it safe to run for a whole
  -- school rather than one classroom. Each teacher's desktop app authenticates with
  -- their own sync_secret_hash (see auth.js's requireSyncSecret); every table below
  -- that's "synced from the desktop app" is scoped to whichever teacher pushed it.
  CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sync_secret_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  );

  -- Synced from the desktop app on every "Publish to portal" push. Each table is
  -- wholesale-replaced (delete + reinsert) on sync, scoped to the pushing teacher's own
  -- rows only — the desktop app is the source of truth for all of this, the portal
  -- never edits it back.
  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    level_type TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
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

  -- One row per teacher's own AI key/provider — see portalSyncService.publishToPortal on
  -- the desktop side. Never exposed to a family's browser; only this server calls the
  -- provider, with this key, on a student's behalf.
  CREATE TABLE IF NOT EXISTS ai_settings (
    teacher_id TEXT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'zhipu',
    api_key TEXT NOT NULL DEFAULT '',
    custom_base_url TEXT NOT NULL DEFAULT '',
    custom_model TEXT NOT NULL DEFAULT ''
  );

  -- One row per teacher's own SMTP config for the weekly parent digest email — same
  -- "teacher provisions once, pushed on every publish" shape as ai_settings.
  -- last_sent_at tracks that teacher's most recent automatic send so the hourly
  -- scheduler in server.js knows not to resend inside the same week.
  CREATE TABLE IF NOT EXISTS digest_settings (
    teacher_id TEXT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
    enabled INTEGER NOT NULL DEFAULT 0,
    smtp_host TEXT NOT NULL DEFAULT '',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_user TEXT NOT NULL DEFAULT '',
    smtp_pass TEXT NOT NULL DEFAULT '',
    from_email TEXT NOT NULL DEFAULT '',
    from_name TEXT NOT NULL DEFAULT '',
    last_sent_at TEXT
  );

  -- Per-message cached translation — populated lazily the first time either side
  -- requests a translated view of a message, so translation is a read-time enrichment
  -- (via the same per-teacher AI key), not something that has to happen at send time.
  -- A student's own profile, created and edited on the Portal (the desktop app never
  -- overwrites it). Keyed by student, not account, so a family account with two
  -- children has two profiles. private_notes is never shown to the teacher, and the
  -- birthday only as month/day when share_birthday is on (see routes/sync.js).
  CREATE TABLE IF NOT EXISTS student_profiles (
    student_id TEXT PRIMARY KEY,
    preferred_name TEXT,
    pronouns TEXT,
    bio TEXT,
    date_of_birth TEXT,
    share_birthday INTEGER NOT NULL DEFAULT 0,
    goals TEXT,
    teacher_note TEXT,
    preferred_language TEXT,
    private_notes TEXT,
    photo_file TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS message_translations (
    message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    translated_body TEXT NOT NULL,
    target_lang TEXT NOT NULL
  );

  -- Translations of what students read (homework, posts, study guides), keyed by a hash
  -- of language + text so identical text is translated once and edited text again.
  -- Every Study Helper question a student asks and the answer they got, so the teacher
  -- can see how AI was used (students are told this on the Study Helper). homework_id is
  -- set when the student asked from an assignment ("Get AI help"). No foreign keys on
  -- purpose: a publish replaces students and homework rows, and this log must survive it.
  CREATE TABLE IF NOT EXISTS ai_interactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    homework_id TEXT,
    question TEXT NOT NULL,
    reply TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ai_interactions_student ON ai_interactions (student_id, created_at);

  CREATE TABLE IF NOT EXISTS content_translations (
    key TEXT PRIMARY KEY,
    target_lang TEXT NOT NULL,
    translated TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

`)

// CREATE TABLE IF NOT EXISTS above does nothing once a table already exists on a live
// server — this covers adding a column to a table that's already been created there,
// so new columns don't need a manual ALTER TABLE on every deploy.
function ensureColumn(table, column, ddl) {
  const cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name)
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
ensureColumn('accounts', 'onboarded_at', 'onboarded_at TEXT')
ensureColumn('accounts', 'session_version', 'session_version INTEGER NOT NULL DEFAULT 0')
ensureColumn('classes', 'teacher_id', 'teacher_id TEXT')
// A student who forgot their password asks here; their teacher approves in the desktop
// app; then the same browser (holding secret_hash's secret) sets a new password.
db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_requests (
    id TEXT PRIMARY KEY,
    account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    secret_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_at TEXT NOT NULL,
    decided_at TEXT
  )
`)
// A class the teacher has archived at the end of term: students still see its grades,
// feedback and materials, but can't hand anything in.
ensureColumn('classes', 'finished', 'finished INTEGER NOT NULL DEFAULT 0')
ensureColumn('teachers', 'timezone', 'timezone TEXT')
ensureColumn('materials', 'flashcards', 'flashcards TEXT')
ensureColumn('materials', 'practice_quiz', 'practice_quiz TEXT')
ensureColumn('students', 'teacher_id', 'teacher_id TEXT')
// How AI was involved in a submission, worked out when it was turned in (see
// services/aiUsage.js): the student said so, asked the Study Helper about this
// assignment, and/or their answer reuses wording from AI answers they were given.
ensureColumn('homework_submissions', 'ai_declared', 'ai_declared INTEGER NOT NULL DEFAULT 0')
ensureColumn('homework_submissions', 'ai_help_count', 'ai_help_count INTEGER NOT NULL DEFAULT 0')
ensureColumn('homework_submissions', 'ai_overlap', 'ai_overlap REAL')
// Fingerprints (sha256) of what a publish described, so an unchanged attachment or
// material text isn't sent again, and an upload can be checked against what the teacher
// published (see routes/sync.js).
ensureColumn('homework_assignments', 'file_hash', 'file_hash TEXT')
ensureColumn('materials', 'chunks_hash', 'chunks_hash TEXT')
// Join links (see routes/invites.js). A student who joins through a class link is created
// here with origin 'portal' and kept across publishes until the teacher's desktop app has
// imported them (after which the desktop sends them like any other student).
ensureColumn('students', 'origin', "origin TEXT NOT NULL DEFAULT 'desktop'")
ensureColumn('students', 'joined_at', 'joined_at TEXT')
ensureColumn('enrollments', 'origin', "origin TEXT NOT NULL DEFAULT 'desktop'")
ensureColumn('invites', 'kind', 'kind TEXT')
ensureColumn('invites', 'student_id', 'student_id TEXT')

// ai_settings/digest_settings used to be single shared rows keyed by id=1. On a server
// upgrading from that version, PRAGMA table_info still shows the old `id` column (SQLite
// can't drop/rename a PRIMARY KEY column via ALTER TABLE), so detect that shape and
// rebuild the table in the new per-teacher shape — keyed on the table's *shape*, not on
// whether its row exists, since the old code only wrote that row on the first publish
// and a legacy table that never saw one still needs rebuilding. Its one row (if any) is
// carried over onto the default teacher once we know who that is, below.
function hasLegacySingleRow(table) {
  const cols = db
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((c) => c.name)
  return cols.includes('id') && !cols.includes('teacher_id')
}
const NEW_SETTINGS_DDL = {
  ai_settings: `
    CREATE TABLE ai_settings (
      teacher_id TEXT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'zhipu',
      api_key TEXT NOT NULL DEFAULT '',
      custom_base_url TEXT NOT NULL DEFAULT '',
      custom_model TEXT NOT NULL DEFAULT ''
    )`,
  digest_settings: `
    CREATE TABLE digest_settings (
      teacher_id TEXT PRIMARY KEY REFERENCES teachers(id) ON DELETE CASCADE,
      enabled INTEGER NOT NULL DEFAULT 0,
      smtp_host TEXT NOT NULL DEFAULT '',
      smtp_port INTEGER NOT NULL DEFAULT 587,
      smtp_user TEXT NOT NULL DEFAULT '',
      smtp_pass TEXT NOT NULL DEFAULT '',
      from_email TEXT NOT NULL DEFAULT '',
      from_name TEXT NOT NULL DEFAULT '',
      last_sent_at TEXT
    )`
}
/** Rebuilds a legacy single-row settings table in the per-teacher shape, returning its
 * old row (or null if it never had one) so the caller can carry it over. */
function migrateLegacySettingsTable(table) {
  if (!hasLegacySingleRow(table)) return null
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = 1`).get() ?? null
  db.exec(`DROP TABLE ${table}`)
  db.exec(NEW_SETTINGS_DDL[table])
  return row
}
const legacyAiSettings = migrateLegacySettingsTable('ai_settings')
const legacyDigestSettings = migrateLegacySettingsTable('digest_settings')
if ((legacyAiSettings || legacyDigestSettings) && !process.env.SYNC_SECRET) {
  console.warn(
    'Portal: dropped the old shared AI/digest settings during the per-teacher upgrade — ' +
      'SYNC_SECRET is not set, so there is no default teacher to attach them to. Each ' +
      "teacher's next publish from the desktop app sends them again."
  )
}

// Backward compatibility for a Portal that was already running single-teacher,
// authenticated by the old global SYNC_SECRET env var: seeds a "default" teacher row
// from that same secret (so the existing desktop app's sync secret setting keeps
// working completely unchanged) and backfills any pre-multi-tenant rows (teacher_id
// still NULL, from before this migration ran) onto that teacher.
if (process.env.SYNC_SECRET) {
  const crypto = require('crypto')
  const hash = crypto.createHash('sha256').update(process.env.SYNC_SECRET).digest('hex')
  let defaultTeacher = db.prepare('SELECT id FROM teachers WHERE sync_secret_hash = ?').get(hash)
  if (!defaultTeacher) {
    const id = crypto.randomUUID()
    db.prepare(
      'INSERT INTO teachers (id, name, sync_secret_hash, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, 'Default teacher', hash, new Date().toISOString())
    defaultTeacher = { id }
  }
  db.prepare('UPDATE classes SET teacher_id = ? WHERE teacher_id IS NULL').run(defaultTeacher.id)
  db.prepare('UPDATE students SET teacher_id = ? WHERE teacher_id IS NULL').run(defaultTeacher.id)

  if (legacyAiSettings) {
    db.prepare(
      `INSERT INTO ai_settings (teacher_id, provider, api_key, custom_base_url, custom_model)
       VALUES (?, ?, ?, ?, ?) ON CONFLICT(teacher_id) DO NOTHING`
    ).run(
      defaultTeacher.id,
      legacyAiSettings.provider,
      legacyAiSettings.api_key,
      legacyAiSettings.custom_base_url,
      legacyAiSettings.custom_model
    )
  }
  if (legacyDigestSettings) {
    db.prepare(
      `INSERT INTO digest_settings
         (teacher_id, enabled, smtp_host, smtp_port, smtp_user, smtp_pass, from_email, from_name, last_sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(teacher_id) DO NOTHING`
    ).run(
      defaultTeacher.id,
      legacyDigestSettings.enabled,
      legacyDigestSettings.smtp_host,
      legacyDigestSettings.smtp_port,
      legacyDigestSettings.smtp_user,
      legacyDigestSettings.smtp_pass,
      legacyDigestSettings.from_email,
      legacyDigestSettings.from_name,
      legacyDigestSettings.last_sent_at
    )
  }
}
module.exports = db
