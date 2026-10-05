export const STUDY_PROGRESS_FORMAT = 'eduboard-study-progress' as const
export const STUDY_PROGRESS_VERSION = 1 as const

export interface StudyProgressCounts {
  got: number
  again: number
  total: number
}

export interface StudyQuizCounts {
  correct: number
  answered: number
  total: number
}

export interface StudyProgressReturnFile {
  format: typeof STUDY_PROGRESS_FORMAT
  version: typeof STUDY_PROGRESS_VERSION
  resourceId: string
  resourceTitle: string
  studentName: string
  exportedAt: string
  cards: StudyProgressCounts
  quiz: StudyQuizCounts
}

export interface StudyProgressReturn {
  id: string
  resourceId: string
  studentId: string | null
  studentName: string
  exportedAt: string
  importedAt: string
  cards: StudyProgressCounts
  quiz: StudyQuizCounts
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length > 0 && text.length <= max ? text : null
}

function nonNegativeInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : null
}

export function parseStudyProgressReturn(
  value: unknown
): { ok: true; value: StudyProgressReturnFile } | { ok: false; reason: string } {
  const raw = value as Record<string, unknown> | null
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'not an object' }
  if (raw.format !== STUDY_PROGRESS_FORMAT || raw.version !== STUDY_PROGRESS_VERSION) {
    return { ok: false, reason: 'unsupported format' }
  }

  const resourceId = cleanText(raw.resourceId, 200)
  const resourceTitle = cleanText(raw.resourceTitle, 300)
  const studentName = cleanText(raw.studentName, 120)
  const exportedAt = cleanText(raw.exportedAt, 80)
  if (
    !resourceId ||
    !resourceTitle ||
    !studentName ||
    !exportedAt ||
    !Number.isFinite(Date.parse(exportedAt))
  ) {
    return { ok: false, reason: 'missing or invalid identity fields' }
  }

  const cards = raw.cards as Record<string, unknown> | null
  const quiz = raw.quiz as Record<string, unknown> | null
  if (!cards || typeof cards !== 'object' || !quiz || typeof quiz !== 'object') {
    return { ok: false, reason: 'missing progress counts' }
  }

  const cardGot = nonNegativeInteger(cards.got)
  const cardAgain = nonNegativeInteger(cards.again)
  const cardTotal = nonNegativeInteger(cards.total)
  const quizCorrect = nonNegativeInteger(quiz.correct)
  const quizAnswered = nonNegativeInteger(quiz.answered)
  const quizTotal = nonNegativeInteger(quiz.total)

  if (
    cardGot === null ||
    cardAgain === null ||
    cardTotal === null ||
    quizCorrect === null ||
    quizAnswered === null ||
    quizTotal === null ||
    cardGot + cardAgain > cardTotal ||
    quizCorrect > quizAnswered ||
    quizAnswered > quizTotal
  ) {
    return { ok: false, reason: 'invalid progress counts' }
  }

  return {
    ok: true,
    value: {
      format: STUDY_PROGRESS_FORMAT,
      version: STUDY_PROGRESS_VERSION,
      resourceId,
      resourceTitle,
      studentName,
      exportedAt: new Date(exportedAt).toISOString(),
      cards: { got: cardGot, again: cardAgain, total: cardTotal },
      quiz: { correct: quizCorrect, answered: quizAnswered, total: quizTotal }
    }
  }
}

/** How a typed name on a progress return is compared with the roster: trimmed, inner
 * spaces collapsed, case-insensitive. Shared by the import (to link a return to a student)
 * and by student erase/export (to find returns that were never linked). */
export function normalizeStudentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

/** The names a student's progress returns may carry: full name, and preferred + last name. */
export function studentNameKeys(student: {
  firstName: string
  lastName: string
  preferredName?: string | null
}): string[] {
  const keys = [normalizeStudentName(`${student.firstName} ${student.lastName}`)]
  if (student.preferredName?.trim()) {
    keys.push(normalizeStudentName(`${student.preferredName} ${student.lastName}`))
  }
  return keys
}
