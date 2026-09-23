import { mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { listClasses } from '../repositories/classes'
import { getRosterForClass } from '../repositories/enrollments'
import {
  listHomeworkAssignmentsByClass,
  upsertSubmissionFromPortal
} from '../repositories/homeworkAssignments'
import { listInviteBatchesByClass } from '../repositories/portalInvites'
import { getClassGrades, getStudentAttendanceSummary } from './reports'
import { getSettings } from '../repositories/settingsRepo'
import type {
  ClassPost,
  Student,
  HomeworkSubmissionStatus,
  PortalMessageThread
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
  const portalUrl = settings.portalUrl.trim().replace(/\/$/, '')
  const portalSyncSecret = settings.portalSyncSecret.trim()
  if (!portalUrl || !portalSyncSecret) throw new PortalNotConfiguredError()
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
  }[] = []
  const invites: { code: string; classId: string; revoked: boolean }[] = []

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

    for (const hw of listHomeworkAssignmentsByClass(cls.id)) {
      homeworkAssignments.push({
        id: hw.id,
        classId: cls.id,
        title: hw.title,
        description: hw.description,
        dueDate: hw.dueDate,
        fileName: hw.fileName,
        fileData: readHomeworkFile(hw.filePath),
        topic: hw.topic
      })
    }

    for (const batch of listInviteBatchesByClass(cls.id)) {
      for (const invite of batch.invites) {
        invites.push({ code: invite.code, classId: cls.id, revoked: invite.revoked })
      }
    }
  }

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
      invites
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
  const destPath = join(dir, `${studentId}-${fileName}`)
  writeFileSync(destPath, Buffer.from(await res.arrayBuffer()))
  return destPath
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
