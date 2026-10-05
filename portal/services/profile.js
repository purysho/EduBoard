const { HINT_STRENGTHS, REPLY_STYLES } = require('./helperRules')

// Validation for a student's profile edits. Every field is optional; an empty value
// clears it. Unknown fields are ignored, so a client can't write columns it shouldn't.

const TEXT_LIMITS = {
  preferredName: 60,
  pronouns: 30,
  bio: 600,
  goals: 600,
  teacherNote: 600,
  preferredLanguage: 40,
  privateNotes: 5000,
  // Their subject or major, so the Study Helper takes examples from it.
  fieldOfStudy: 80,
  // Their level in their own words, for the Study Helper (services/helperRules.js).
  studyLevel: 200
}

// Study Helper choices from a fixed list; anything else is refused.
const CHOICES = { hintStrength: HINT_STRENGTHS, replyStyle: REPLY_STYLES }

/** 'YYYY-MM-DD' for a real calendar date between 1900 and today, else null. */
function parseBirthDate(value, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  const real =
    date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
  if (!real || y < 1900 || date.getTime() > today.getTime()) return null
  return m[0]
}

/** Returns { ok: true, value } with only known, cleaned fields, or { ok: false, reason }. */
function validateProfilePatch(body, today = new Date()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, reason: 'Nothing to save' }
  }
  const value = {}
  for (const [field, max] of Object.entries(TEXT_LIMITS)) {
    if (!(field in body)) continue
    const raw = body[field]
    if (raw !== null && typeof raw !== 'string')
      return { ok: false, reason: `${field} must be text` }
    const text = (raw ?? '').trim()
    if (text.length > max)
      return { ok: false, reason: `${field} is too long (${max} characters max)` }
    value[field] = text || null
  }
  if ('dateOfBirth' in body) {
    if (body.dateOfBirth === null || body.dateOfBirth === '') {
      value.dateOfBirth = null
    } else {
      const parsed = parseBirthDate(body.dateOfBirth, today)
      if (!parsed) return { ok: false, reason: "That date of birth isn't a real past date" }
      value.dateOfBirth = parsed
    }
  }
  if ('shareBirthday' in body) value.shareBirthday = body.shareBirthday === true
  for (const [field, allowed] of Object.entries(CHOICES)) {
    if (!(field in body)) continue
    const choice = body[field]
    if (choice === null || choice === '') value[field] = null
    else if (allowed.includes(choice)) value[field] = choice
    else return { ok: false, reason: `${field} must be one of ${allowed.join(', ')}` }
  }
  return { ok: true, value }
}

const COLUMNS = {
  preferredName: 'preferred_name',
  pronouns: 'pronouns',
  bio: 'bio',
  dateOfBirth: 'date_of_birth',
  shareBirthday: 'share_birthday',
  goals: 'goals',
  teacherNote: 'teacher_note',
  preferredLanguage: 'preferred_language',
  privateNotes: 'private_notes',
  fieldOfStudy: 'field_of_study',
  studyLevel: 'study_level',
  hintStrength: 'hint_strength',
  replyStyle: 'reply_style'
}

/** The student's own view of their profile: everything. */
function toOwnerView(studentId, row) {
  return {
    studentId,
    preferredName: row?.preferred_name ?? null,
    pronouns: row?.pronouns ?? null,
    bio: row?.bio ?? null,
    dateOfBirth: row?.date_of_birth ?? null,
    shareBirthday: !!row?.share_birthday,
    goals: row?.goals ?? null,
    teacherNote: row?.teacher_note ?? null,
    preferredLanguage: row?.preferred_language ?? null,
    privateNotes: row?.private_notes ?? null,
    fieldOfStudy: row?.field_of_study ?? null,
    studyLevel: row?.study_level ?? null,
    hintStrength: row?.hint_strength ?? null,
    replyStyle: row?.reply_style ?? null,
    hasPhoto: !!row?.photo_file,
    updatedAt: row?.updated_at ?? null
  }
}

/** The teacher's view: no private notes, and the birthday only as month-day when the
 * student chose to share it (never the year). */
function toTeacherView(studentId, row) {
  return {
    studentId,
    preferredName: row.preferred_name,
    pronouns: row.pronouns,
    bio: row.bio,
    birthday: row.share_birthday && row.date_of_birth ? row.date_of_birth.slice(5) : null,
    goals: row.goals,
    teacherNote: row.teacher_note,
    preferredLanguage: row.preferred_language,
    fieldOfStudy: row.field_of_study ?? null,
    hasPhoto: !!row.photo_file,
    updatedAt: row.updated_at
  }
}

module.exports = {
  validateProfilePatch,
  parseBirthDate,
  toOwnerView,
  toTeacherView,
  COLUMNS,
  TEXT_LIMITS
}
