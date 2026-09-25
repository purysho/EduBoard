import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { PortalAiInteraction } from '@shared/aiUsage'
import { listClasses } from '../repositories/classes'
import { getRosterForClass } from '../repositories/enrollments'
import {
  listHomeworkAssignmentsByClass,
  upsertSubmissionFromPortal
} from '../repositories/homeworkAssignments'
import { listInviteBatchesByClass } from '../repositories/portalInvites'
import { listLessonResources } from '../repositories/lessonResources'
import { listHomeworkQuestions } from '../repositories/homeworkQuestions'
import { listResourceChunks } from '../repositories/resourceChunks'
import { getClassGrades, getStudentAttendanceSummary } from './reports'
import { getSettings } from '../repositories/settingsRepo'
import { markAsDownloadedFromInternet, safeDownloadPath } from './untrustedFiles'
import { checkUpload } from '@shared/fileSafety'
import { normalizePortalUrl, portalUrlProblem } from '@shared/portalUrl'
import type { Flashcard, PracticeQuestion } from '@shared/practiceSets'
import type {
  ClassPost,
  Student,
  HomeworkSubmissionStatus,
  PortalMessageThread,
  PortalStudentProfile
} from '@shared/types'

export class PortalNotConfiguredError extends Error {
  constructor() {
    super('Set a Portal URL and sync secret in Settings first.')
    this.name = 'PortalNotConfiguredError'
  }
}

// Above this, a homework attachment is skipped rather than sent — keeps the sync
// payload from ballooning to the point of timing out on the Portal's limited bandwidth.
const MAX_HOMEWORK_FILE_BYTES = 8 * 1024 * 1024

function readHomeworkFile(filePath: string | null): string | null {
  if (!filePath) return null
  try {
    if (statSync(filePath).size > MAX_HOMEWORK_FILE_BYTES) return null
    return readFileSync(filePath).toString('base64')
  } catch {
    return null
  }
}

function requirePortalConfig(): { portalUrl: string; portalSyncSecret: string } {
  const settings = getSettings()
  const portalUrl = normalizePortalUrl(settings.portalUrl)
  const portalSyncSecret = settings.portalSyncSecret.trim()
  if (!portalUrl || !portalSyncSecret) throw new PortalNotConfiguredError()
  // Never send the secret or student data over an unencrypted connection.
  const problem = portalUrlProblem(portalUrl)
  if (problem) throw new Error(problem)
  return { portalUrl, portalSyncSecret }
}

/** Gathers this device's full current state and pushes it to the Portal, replacing
 * everything there in one shot — see portal/routes/sync.js. One-way: nothing the
 * Portal has is ever written back into the local database from here. */
export async function publishToPortal(): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const classes = listClasses(false)
  const studentsById = new Map<string, Student>()
  const enrollments: { studentId: string; classId: string; status: string }[] = []
  const grades: {
    studentId: string
    classId: string
    percent: number | null
    letter: string | null
    attendanceRate: number | null
  }[] = []
  const homeworkAssignments: {
    id: string
    classId: string
    title: string
    description: string | null
    dueDate: string | null
    fileName: string | null
    fileData: string | null
    topic: string | null
    questions: {
      type: string
      prompt: string
      options: string[] | null
      correctAnswer: string
      points: number
    }[]
  }[] = []
  const invites: { code: string; classId: string; revoked: boolean }[] = []
  const materials: {
    id: string
    classId: string
    title: string
    studyGuide: string | null
    flashcards: Flashcard[] | null
    practiceQuiz: PracticeQuestion[] | null
    chunks: string[]
  }[] = []

  // Only resources the teacher explicitly opted in (classId set + shareWithStudents) and
  // has indexed (chunks exist) get pushed — an unindexed "shared" resource would have
  // nothing for the Portal's search to find, so it's silently skipped rather than sent
  // with zero chunks.
  for (const resource of listLessonResources()) {
    if (!resource.classId || !resource.shareWithStudents) continue
    const chunks = listResourceChunks(resource.id)
    if (!chunks.length) continue
    materials.push({
      id: resource.id,
      classId: resource.classId,
      title: resource.title,
      studyGuide: resource.studyGuide,
      flashcards: resource.flashcards,
      practiceQuiz: resource.practiceQuiz,
      chunks
    })
  }

  for (const cls of classes) {
    const roster = getRosterForClass(cls.id)
    const classGrades = getClassGrades(cls.id)

    for (const { student, enrollment } of roster) {
      studentsById.set(student.id, student)
      enrollments.push({ studentId: student.id, classId: cls.id, status: enrollment.status })

      if (enrollment.status !== 'active') continue
      const grade = classGrades.get(student.id)
      const attendance = getStudentAttendanceSummary(student.id, cls.id)
      grades.push({
        studentId: student.id,
        classId: cls.id,
        percent: grade?.percent ?? null,
        letter: grade?.letter ?? null,
        attendanceRate: attendance.rate
      })
    }

    // Drafts stay local — only an assignment the teacher explicitly published (see
    // HomeworkTab's Publish button) ever reaches the Portal, so building out homework
    // ahead of time never puts it in front of students early.
    for (const hw of listHomeworkAssignmentsByClass(cls.id)) {
      if (hw.status !== 'published') continue
      homeworkAssignments.push({
        id: hw.id,
        classId: cls.id,
        title: hw.title,
        description: hw.description,
        dueDate: hw.dueDate,
        fileName: hw.fileName,
        fileData: readHomeworkFile(hw.filePath),
        topic: hw.topic,
        // Correct answers travel here for the Portal to grade with server-side — it
        // strips them before ever sending a homework list to a family's browser.
        questions: listHomeworkQuestions(hw.id).map((q) => ({
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points
        }))
      })
    }

    for (const batch of listInviteBatchesByClass(cls.id)) {
      for (const invite of batch.invites) {
        invites.push({ code: invite.code, classId: cls.id, revoked: invite.revoked })
      }
    }
  }

  const settings = getSettings()
  const res = await fetch(`${portalUrl}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({
      classes: classes.map((c) => ({ id: c.id, name: c.name, levelType: c.levelType })),
      students: [...studentsById.values()].map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        dateOfBirth: s.dateOfBirth,
        studentNumber: s.studentNumber
      })),
      enrollments,
      grades,
      homeworkAssignments,
      invites,
      materials,
      // The one shared AI key every student can use — see AppSettings.portalAiApiKey.
      // Sent on every publish so a key change (or clearing it) takes effect right away.
      aiProvider: settings.portalAiProvider,
      aiApiKey: settings.portalAiApiKey,
      aiCustomBaseUrl: settings.portalAiCustomBaseUrl,
      aiCustomModel: settings.portalAiCustomModel,
      digestEnabled: settings.digestEnabled,
      digestSmtpHost: settings.digestSmtpHost,
      digestSmtpPort: settings.digestSmtpPort,
      digestSmtpUser: settings.digestSmtpUser,
      digestSmtpPass: settings.digestSmtpPass,
      digestFromEmail: settings.digestFromEmail,
      digestFromName: settings.digestFromName,
      // Due dates end at midnight in this zone (see src/shared/deadlines.ts), so the
      // Portal's Late/Missing labels match what the teacher sees here.
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    })
  })
  if (!res.ok) throw new Error(`Portal sync failed: ${res.status} ${await res.text()}`)
}

/** Pulls homework submission statuses students have set for themselves on the Portal
 * and mirrors them into local tracking — the one place data flows back in, and only on
 * explicit request (see PortalTab's "Pull from portal" button), never automatically. */
export async function pullSubmissionsFromPortal(): Promise<number> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/submissions`, {
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw new Error(`Portal pull failed: ${res.status} ${await res.text()}`)

  const rows = (await res.json()) as {
    homeworkAssignmentId: string
    studentId: string
    status: HomeworkSubmissionStatus
    submittedAt: string | null
    textAnswer: string | null
    fileName: string | null
    grade: string | null
    feedback: string | null
    aiDeclared?: boolean
    aiHelpCount?: number
    aiOverlap?: number | null
  }[]
  for (const row of rows) {
    upsertSubmissionFromPortal(row)
  }
  return rows.length
}

// pushSubmissionPortfolio is the only path that writes `portfolio` — this pull never
// touches it, so a teacher's star survives being left out of a Portal submissions row.

/** Pushes a grade/feedback the teacher just entered for one submission straight up to
 * the Portal — immediate, not batched with the next full publish, so a family sees it
 * without the teacher needing to remember a separate "publish" step. */
export async function pushSubmissionGrade(input: {
  homeworkAssignmentId: string
  studentId: string
  grade: string | null
  feedback: string | null
}): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/submissions/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({ grades: [input] })
  })
  if (!res.ok) throw new Error(`Portal grade push failed: ${res.status} ${await res.text()}`)
}

/** Pushes whether a submission is starred for the student's Portfolio, immediately —
 * same "no publish step needed" pattern as pushSubmissionGrade. */
export async function pushSubmissionPortfolio(input: {
  homeworkAssignmentId: string
  studentId: string
  portfolio: boolean
}): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/submissions/portfolio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify(input)
  })
  if (!res.ok) throw new Error(`Portal portfolio push failed: ${res.status} ${await res.text()}`)
}

/** Downloads a student's submitted file to a local temp folder so the teacher can open
 * it — the file itself lives only on the Portal, never copied into the local database. */
export async function downloadSubmissionFile(
  homeworkAssignmentId: string,
  studentId: string,
  fileName: string
): Promise<string> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(
    `${portalUrl}/api/sync/submissions/${homeworkAssignmentId}/${studentId}/file`,
    { headers: { 'X-Sync-Secret': portalSyncSecret } }
  )
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${await res.text()}`)

  const dir = join(tmpdir(), 'eduboard-submissions')
  mkdirSync(dir, { recursive: true })
  // fileName is whatever the student's browser sent. Never let it choose where on disk
  // this lands (see untrustedFiles.ts).
  const destPath = safeDownloadPath(dir, studentId, fileName)
  const bytes = Buffer.from(await res.arrayBuffer())
  // Checked again here, not only on upload: files turned in before the Portal checked
  // contents, or through an older Portal, must not reach the disk unvetted.
  const check = checkUpload(fileName, bytes)
  if (!check.ok) {
    throw new Error(`EduBoard didn't open this file because ${check.reason}.`)
  }
  writeFileSync(destPath, bytes)
  markAsDownloadedFromInternet(destPath)
  return destPath
}

/** A student's Portal profile as shared with the teacher, fetched live (nothing is
 * mirrored locally). The photo arrives as bytes and is only passed on as an image if it
 * really is one. The Portal re-encodes every photo, so anything else means tampering. */
export async function getPortalProfile(studentId: string): Promise<PortalStudentProfile | null> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()
  const headers = { 'X-Sync-Secret': portalSyncSecret }

  const res = await fetch(`${portalUrl}/api/sync/profiles`, { headers })
  if (!res.ok) throw new Error(`Could not load Portal profiles: ${res.status}`)
  const profiles = (await res.json()) as (Omit<PortalStudentProfile, 'photoDataUrl'> & {
    hasPhoto: boolean
  })[]
  const profile = profiles.find((p) => p.studentId === studentId)
  if (!profile) return null

  let photoDataUrl: string | null = null
  if (profile.hasPhoto) {
    const photo = await fetch(
      `${portalUrl}/api/sync/profiles/${encodeURIComponent(studentId)}/photo`,
      { headers }
    )
    const bytes = photo.ok ? Buffer.from(await photo.arrayBuffer()) : null
    if (bytes && checkUpload('photo.webp', bytes).ok) {
      photoDataUrl = `data:image/webp;base64,${bytes.toString('base64')}`
    }
  }
  return {
    studentId: profile.studentId,
    preferredName: profile.preferredName,
    pronouns: profile.pronouns,
    bio: profile.bio,
    birthday: profile.birthday,
    goals: profile.goals,
    teacherNote: profile.teacherNote,
    preferredLanguage: profile.preferredLanguage,
    photoDataUrl,
    updatedAt: profile.updatedAt
  }
}

/** Every family's message thread, fetched live from the Portal — nothing here is
 * mirrored locally, so this always reflects exactly what's on the Portal right now. */
export async function listMessageThreads(): Promise<PortalMessageThread[]> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/messages/threads`, {
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw new Error(`Could not load messages: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function sendTeacherMessage(accountId: string, body: string): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({ accountId, body })
  })
  if (!res.ok) throw new Error(`Could not send message: ${res.status} ${await res.text()}`)
}

/** Every question a student asked the Portal's Study Helper and the answers, optionally
 * just those asked from one assignment: what's behind a "Used AI" badge. */
export async function getStudentAiActivity(
  studentId: string,
  homeworkId: string | null
): Promise<PortalAiInteraction[]> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()
  const query = new URLSearchParams({ studentId })
  if (homeworkId) query.set('homeworkId', homeworkId)
  const res = await fetch(`${portalUrl}/api/sync/ai-activity?${query}`, {
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (res.status === 404) return []
  if (!res.ok) throw new Error(`Could not load AI activity: ${res.status} ${await res.text()}`)
  return (await res.json()) as PortalAiInteraction[]
}

/** Translates one message into targetLang (e.g. "English" or "Chinese"), via the
 * Portal's per-teacher AI key. Cached server-side, so calling this again for the same
 * message+language is instant. */
export async function translateMessage(messageId: string, targetLang: string): Promise<string> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/messages/${messageId}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({ targetLang })
  })
  if (!res.ok) throw new Error(`Could not translate message: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.translatedBody
}

export async function markMessageThreadRead(accountId: string): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/messages/${accountId}/read`, {
    method: 'POST',
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw new Error(`Could not mark read: ${res.status} ${await res.text()}`)
}

export async function listClassPosts(): Promise<ClassPost[]> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/posts`, {
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw new Error(`Could not load posts: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function createClassPost(
  classId: string,
  body: string,
  imagePath: string | null
): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  let imageName: string | null = null
  let imageData: string | null = null
  if (imagePath) {
    imageName = imagePath.split(/[/\\]/).pop() ?? imagePath
    imageData = readFileSync(imagePath).toString('base64')
  }

  const res = await fetch(`${portalUrl}/api/sync/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({ classId, body, imageName, imageData })
  })
  if (!res.ok) throw new Error(`Could not post: ${res.status} ${await res.text()}`)
}

export async function deleteClassPost(id: string): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/posts/${id}`, {
    method: 'DELETE',
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw new Error(`Could not delete post: ${res.status} ${await res.text()}`)
}

/** Triggers an immediate send of the weekly digest to every family with an email on
 * file — for testing the setup, or sending an out-of-cycle update, without waiting for
 * next Monday's automatic run. */
/** Teacher-triggered password reset for a Portal account — the Portal's only recovery
 * path, since it deliberately has no "forgot password" email. The Portal refuses
 * accounts that aren't linked to one of this teacher's students. */
export async function resetPortalPassword(username: string, newPassword: string): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({ username, newPassword })
  })
  if (!res.ok) {
    // The Portal's own message ("No such account", "Password must be at least 8
    // characters") is what the teacher needs to see, not the raw status line.
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error || `Password reset failed: ${res.status}`)
  }
}

export async function sendDigestNow(): Promise<{
  sent: number
  total: number
  errors: { username: string; error: string }[]
}> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/digest/send-now`, {
    method: 'POST',
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw new Error(`Digest send failed: ${res.status} ${await res.text()}`)
  return res.json()
}
