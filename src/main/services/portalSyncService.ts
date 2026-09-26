import { createHash } from 'crypto'
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { PortalAiInteraction } from '@shared/aiUsage'
import { listClasses } from '../repositories/classes'
import { mergeStudents } from '../repositories/studentMerge'
import {
  enrollStudent,
  getRosterForClass,
  listEnrollmentsByStudent
} from '../repositories/enrollments'
import { listAllJoinLinks } from '../repositories/portalJoinLinks'
import { importStudentFromPortal } from '../repositories/students'
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
import { portalFailure } from './portalErrors'
import type { PublishResult } from '@shared/types'
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

// The Portal accepts attachments up to this size (see portal/routes/sync.js). A larger
// one is left off and named in the publish result, rather than failing the publish.
const MAX_HOMEWORK_FILE_BYTES = 25 * 1024 * 1024

const sha256 = (data: Buffer | string): string => createHash('sha256').update(data).digest('hex')

type AttachmentCheck =
  { ok: true; hash: string; path: string } | { ok: false; reason: 'missing' | 'too_large' }

function checkHomeworkFile(filePath: string | null): AttachmentCheck | null {
  if (!filePath) return null
  try {
    if (statSync(filePath).size > MAX_HOMEWORK_FILE_BYTES) return { ok: false, reason: 'too_large' }
    return { ok: true, hash: sha256(readFileSync(filePath)), path: filePath }
  } catch {
    return { ok: false, reason: 'missing' }
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
/** Publishes, then brings in any students who joined through a class link (and
 * publishes once more, so the Portal knows the desktop now has them). */
export async function publishToPortal(): Promise<PublishResult> {
  const result = await publishOnce()
  if (result.outdatedServer) return { ...result, studentsJoined: 0 }
  const studentsJoined = await importNewStudentsFromPortal()
  if (studentsJoined > 0) await publishOnce()
  return { ...result, studentsJoined }
}

async function publishOnce(): Promise<Omit<PublishResult, 'studentsJoined'>> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  // Archived classes go too, marked finished: students keep seeing their grades,
  // feedback and materials read-only, and can't hand anything more in.
  const classes = listClasses(true)
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
    fileHash: string | null
    topic: string | null
    questions: {
      type: string
      prompt: string
      options: string[] | null
      correctAnswer: string
      points: number
    }[]
  }[] = []
  const invites: {
    code: string
    classId: string
    revoked: boolean
    kind?: 'class_link' | 'student'
    studentId?: string | null
  }[] = []
  const materials: {
    id: string
    classId: string
    title: string
    studyGuide: string | null
    flashcards: Flashcard[] | null
    practiceQuiz: PracticeQuestion[] | null
    chunksHash: string
  }[] = []
  // Sent after the main publish, only for what the Portal says it doesn't have yet.
  const attachmentPaths = new Map<string, string>()
  const materialChunks = new Map<string, string[]>()
  const skipped: string[] = []

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
      chunksHash: sha256(JSON.stringify(chunks))
    })
    materialChunks.set(resource.id, chunks)
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
      const file = checkHomeworkFile(hw.filePath)
      if (file?.ok) attachmentPaths.set(hw.id, file.path)
      else if (file && hw.fileName) {
        skipped.push(
          `${hw.fileName} (${file.reason === 'too_large' ? 'over 25 MB' : 'file not found on this computer'})`
        )
      }
      homeworkAssignments.push({
        id: hw.id,
        classId: cls.id,
        title: hw.title,
        description: hw.description,
        dueDate: hw.dueDate,
        fileName: file?.ok ? hw.fileName : null,
        fileHash: file?.ok ? file.hash : null,
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
        invites.push({
          code: invite.code,
          classId: cls.id,
          revoked: invite.revoked || cls.archived
        })
      }
    }
  }

  // Join links, revoked ones included so turning a link off reaches the Portal.
  const publishedClassIds = new Set(classes.map((c) => c.id))
  const finishedClassIds = new Set(classes.filter((c) => c.archived).map((c) => c.id))
  for (const link of listAllJoinLinks()) {
    if (!publishedClassIds.has(link.classId)) continue
    invites.push({
      code: link.code,
      classId: link.classId,
      // Nobody joins a finished class, whatever the link's own state.
      revoked: link.revoked || finishedClassIds.has(link.classId),
      kind: link.kind,
      studentId: link.studentId
    })
  }

  const settings = getSettings()
  const res = await fetch(`${portalUrl}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({
      classes: classes.map((c) => ({
        id: c.id,
        name: c.name,
        levelType: c.levelType,
        finished: c.archived
      })),
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
  if (!res.ok) throw await portalFailure('Portal sync failed', res)
  const reply = (await res.json().catch(() => ({}))) as {
    needFiles?: unknown
    needChunks?: unknown
  }

  // An older Portal doesn't ask for anything: it still expects files inline, so it now
  // has the assignments without their attachments. Say so rather than pretend.
  if (!Array.isArray(reply.needFiles) || !Array.isArray(reply.needChunks)) {
    return { attachmentsUploaded: 0, materialsUploaded: 0, skipped, outdatedServer: true }
  }

  const headers = { 'X-Sync-Secret': portalSyncSecret }
  let attachmentsUploaded = 0
  for (const id of reply.needFiles) {
    const filePath = attachmentPaths.get(String(id))
    if (!filePath) continue
    const upload = await fetch(
      `${portalUrl}/api/sync/homework/${encodeURIComponent(String(id))}/file`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/octet-stream' },
        body: readFileSync(filePath)
      }
    )
    if (!upload.ok) throw await portalFailure('Uploading a homework attachment failed', upload)
    attachmentsUploaded++
  }
  let materialsUploaded = 0
  for (const id of reply.needChunks) {
    const chunks = materialChunks.get(String(id))
    if (!chunks) continue
    const upload = await fetch(
      `${portalUrl}/api/sync/materials/${encodeURIComponent(String(id))}/chunks`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks })
      }
    )
    if (!upload.ok) throw await portalFailure('Uploading study material text failed', upload)
    materialsUploaded++
  }
  return { attachmentsUploaded, materialsUploaded, skipped, outdatedServer: false }
}

/** Adds students who joined through a Portal class link to this computer's roster, under
 * the Portal's ids. Returns how many were new here. Safe to call repeatedly. */
export async function importNewStudentsFromPortal(): Promise<number> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()
  const res = await fetch(`${portalUrl}/api/sync/new-students`, {
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (res.status === 404) return 0 // a Portal from before join links
  if (!res.ok) throw await portalFailure('Checking for new students failed', res)
  const rows = (await res.json()) as {
    id: string
    firstName: string
    lastName: string
    dateOfBirth: string | null
    joinedAt: string | null
    classIds: string[]
  }[]
  const localClassIds = new Set(listClasses(true).map((c) => c.id))
  let added = 0
  for (const row of rows) {
    if (importStudentFromPortal(row)) added++
    const enrolledIn = new Set(listEnrollmentsByStudent(row.id).map((e) => e.classId))
    for (const classId of row.classIds) {
      if (!localClassIds.has(classId) || enrolledIn.has(classId)) continue
      enrollStudent({
        studentId: row.id,
        classId,
        enrolledOn: (row.joinedAt ?? new Date().toISOString()).slice(0, 10)
      })
    }
  }
  return added
}

/** Ids of this teacher's students who have a Portal account, or null if the Portal
 * couldn't be asked (not set up, offline, or too old to say). */
export async function getStudentsWithPortalAccounts(): Promise<string[] | null> {
  try {
    const { portalUrl, portalSyncSecret } = requirePortalConfig()
    const res = await fetch(`${portalUrl}/api/sync/accounts`, {
      headers: { 'X-Sync-Secret': portalSyncSecret }
    })
    return res.ok ? ((await res.json()) as string[]) : null
  } catch {
    return null
  }
}

/** Pulls homework submission statuses students have set for themselves on the Portal
 * and mirrors them into local tracking — the one place data flows back in, and only on
 * explicit request (see PortalTab's "Pull from portal" button), never automatically. */
export async function pullSubmissionsFromPortal(): Promise<number> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/submissions`, {
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw await portalFailure('Portal pull failed', res)

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
  // Students who joined through a class link may have turned work in already, so
  // they're brought in first: a submission can't be saved for a student not here.
  await importNewStudentsFromPortal().catch(() => 0)
  let saved = 0
  for (const row of rows) {
    // One row for a student or assignment no longer on this computer shouldn't stop
    // everyone else's work coming through.
    try {
      upsertSubmissionFromPortal(row)
      saved++
    } catch {
      // skipped
    }
  }
  return saved
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
  if (!res.ok) throw await portalFailure('Portal grade push failed', res)
}

/**
 * Merges a duplicate student into the one being kept, everywhere: first on the Portal
 * (so their login and handed-in work move to the kept student), then here, then a
 * publish so the Portal has the kept student's classes. If the Portal can't be reached,
 * nothing is changed anywhere and the teacher can simply try again. Without a Portal,
 * it's just the local merge.
 */
export async function mergeStudentsEverywhere(
  keepId: string,
  duplicateId: string
): Promise<Student> {
  let portalConfigured = true
  try {
    requirePortalConfig()
  } catch (err) {
    if (!(err instanceof PortalNotConfiguredError)) throw err
    portalConfigured = false
  }
  if (portalConfigured) {
    const { portalUrl, portalSyncSecret } = requirePortalConfig()
    const res = await fetch(`${portalUrl}/api/sync/merge-students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
      body: JSON.stringify({ from: duplicateId, into: keepId })
    })
    if (!res.ok) throw await portalFailure('Merging on the Portal failed', res)
  }
  const merged = mergeStudents(keepId, duplicateId)
  if (portalConfigured) {
    // The login already points at the kept student; publishing gives it their classes.
    await publishToPortal().catch((err) => console.error('Publish after merge failed:', err))
  }
  return merged
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
  if (!res.ok) throw await portalFailure('Portal portfolio push failed', res)
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
  if (!res.ok) throw await portalFailure('Download failed', res)

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
  if (!res.ok) throw await portalFailure('Could not load messages', res)
  return res.json()
}

export async function sendTeacherMessage(accountId: string, body: string): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sync-Secret': portalSyncSecret },
    body: JSON.stringify({ accountId, body })
  })
  if (!res.ok) throw await portalFailure('Could not send message', res)
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
  if (!res.ok) throw await portalFailure('Could not load AI activity', res)
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
  if (!res.ok) throw await portalFailure('Could not translate message', res)
  const data = await res.json()
  return data.translatedBody
}

export async function markMessageThreadRead(accountId: string): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/messages/${accountId}/read`, {
    method: 'POST',
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw await portalFailure('Could not mark read', res)
}

export async function listClassPosts(): Promise<ClassPost[]> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/posts`, {
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw await portalFailure('Could not load posts', res)
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
  if (!res.ok) throw await portalFailure('Could not post', res)
}

export async function deleteClassPost(id: string): Promise<void> {
  const { portalUrl, portalSyncSecret } = requirePortalConfig()

  const res = await fetch(`${portalUrl}/api/sync/posts/${id}`, {
    method: 'DELETE',
    headers: { 'X-Sync-Secret': portalSyncSecret }
  })
  if (!res.ok) throw await portalFailure('Could not delete post', res)
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
  if (!res.ok) throw await portalFailure('Digest send failed', res)
  return res.json()
}
