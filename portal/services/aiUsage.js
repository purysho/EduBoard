// Recording and detecting students' use of the Portal's own AI (the Study Helper).
//
// What this can and can't tell a teacher, stated plainly so nobody over-trusts it:
// - It knows every question asked of the Study Helper and the answer given, and which
//   assignment it was asked from. That part is certain.
// - It checks whether a typed answer reuses wording from AI answers this student was
//   given. That catches copy-pasting from the Study Helper, including lightly edited.
// - It cannot see ChatGPT or any other outside tool. For those there is only the
//   student's own "I used AI" tick box. No reliable AI-text detector exists, and a
//   false accusation is worse than a missed one, so none is attempted.
const crypto = require('crypto')
const db = require('../db')

const MAX_STORED_CHARS = 4000
// Wording counts as reused when this share of the answer's 6-word runs appear in AI
// answers the student received, with a floor so a short answer quoting one phrase
// isn't flagged.
const OVERLAP_FLAG_RATIO = 0.2
const MIN_MATCHING_RUNS = 4
const SHINGLE = 6
const LOOKBACK_DAYS = 120

function recordInteraction({ accountId, studentId, homeworkId, question, reply }) {
  db.prepare(
    `INSERT INTO ai_interactions (id, account_id, student_id, homework_id, question, reply, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    accountId,
    studentId,
    homeworkId || null,
    String(question).slice(0, MAX_STORED_CHARS),
    String(reply).slice(0, MAX_STORED_CHARS),
    new Date().toISOString()
  )
}

/** The last few exchanges in the same conversation (same assignment, or the general
 * Study Helper), oldest first, so follow-up questions make sense to the model. */
function recentConversation(studentId, homeworkId, limit = 4) {
  return db
    .prepare(
      `SELECT question, reply FROM ai_interactions
       WHERE student_id = ? AND homework_id IS ?
       ORDER BY created_at DESC LIMIT ?`
    )
    .all(studentId, homeworkId || null, limit)
    .reverse()
}

function listInteractions(studentId, homeworkId) {
  const rows = homeworkId
    ? db
        .prepare(
          `SELECT * FROM ai_interactions WHERE student_id = ? AND homework_id = ?
           ORDER BY created_at`
        )
        .all(studentId, homeworkId)
    : db
        .prepare('SELECT * FROM ai_interactions WHERE student_id = ? ORDER BY created_at')
        .all(studentId)
  return rows.map((r) => ({
    id: r.id,
    homeworkId: r.homework_id,
    question: r.question,
    reply: r.reply,
    createdAt: r.created_at
  }))
}

/** Words, lower-cased and without punctuation. Chinese/Japanese characters count one
 * each, since those languages don't put spaces between words. */
function tokens(text) {
  return (
    String(text || '')
      .toLowerCase()
      .match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]|[\p{L}\p{N}]+/gu) || []
  )
}

function shingles(words) {
  const out = new Set()
  for (let i = 0; i + SHINGLE <= words.length; i++) out.add(words.slice(i, i + SHINGLE).join(' '))
  return out
}

/** Share of `answer`'s 6-word runs found in the given AI replies (0-1), or null when the
 * answer is too short to judge. */
function overlapWith(answer, replies) {
  const mine = shingles(tokens(answer))
  if (mine.size < MIN_MATCHING_RUNS) return null
  const theirs = new Set()
  for (const reply of replies) for (const s of shingles(tokens(reply))) theirs.add(s)
  let matching = 0
  for (const s of mine) if (theirs.has(s)) matching++
  if (matching < MIN_MATCHING_RUNS) return 0
  return Math.round((matching / mine.size) * 100) / 100
}

/** The AI facts stored with a submission when it's turned in. */
function assessSubmission({ studentId, homeworkId, textAnswer, declared }) {
  const helpCount = db
    .prepare('SELECT COUNT(*) AS n FROM ai_interactions WHERE student_id = ? AND homework_id = ?')
    .get(studentId, homeworkId).n
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString()
  const replies = db
    .prepare('SELECT reply FROM ai_interactions WHERE student_id = ? AND created_at >= ?')
    .all(studentId, since)
    .map((r) => r.reply)
  const overlap = textAnswer && replies.length ? overlapWith(textAnswer, replies) : null
  return { declared: !!declared, helpCount, overlap }
}

/** Whether a submission counts as "used AI", and the plain reasons why. */
function aiUsageSummary(row) {
  const reasons = []
  if (row.ai_declared) reasons.push('declared')
  if (row.ai_help_count > 0) reasons.push('asked_ai')
  if (row.ai_overlap != null && row.ai_overlap >= OVERLAP_FLAG_RATIO) reasons.push('matches_ai')
  return { usedAi: reasons.length > 0, reasons }
}

module.exports = {
  OVERLAP_FLAG_RATIO,
  recordInteraction,
  recentConversation,
  listInteractions,
  overlapWith,
  assessSubmission,
  aiUsageSummary
}
