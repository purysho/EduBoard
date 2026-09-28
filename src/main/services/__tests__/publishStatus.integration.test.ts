import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { updateSettings } from '../../repositories/settingsRepo'
import { createClass } from '../../repositories/classes'
import { createStudent, updateStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { getPublishStatus, publishToPortal } from '../portalSyncService'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

// The Portal's own test helper starts a real Portal on a free port.
const { startPortal } = createRequire(import.meta.url)('../../../../portal/test/helpers.js')

let tempDir: string
let portal: {
  url: string
  dataDir: string
  secrets: { sync: string }
  stop: () => Promise<void>
}

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
  portal = await startPortal()
})

afterEach(async () => {
  await portal.stop()
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('unpublished changes', () => {
  it('knows when students can’t see the latest changes, and when they can', async () => {
    expect(getPublishStatus().configured).toBe(false)
    updateSettings({ portalUrl: portal.url, portalSyncSecret: portal.secrets.sync })
    const cls = createClass({
      name: 'Writing',
      subject: null,
      levelType: 'university',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const student = createStudent({
      firstName: 'Mai',
      lastName: 'Chen',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })

    // Never published.
    expect(getPublishStatus()).toMatchObject({
      configured: true,
      upToDate: false,
      lastPublishedAt: null
    })

    await publishToPortal()
    const published = getPublishStatus()
    expect(published.upToDate).toBe(true)
    expect(published.lastPublishedAt).not.toBeNull()

    updateStudent(student.id, { firstName: 'Maimai' })
    expect(getPublishStatus().upToDate).toBe(false)

    await publishToPortal()
    expect(getPublishStatus().upToDate).toBe(true)
    // Asked again with nothing changed, the answer holds (it's kept, not rebuilt)…
    expect(getPublishStatus().upToDate).toBe(true)

    // …and any change still shows, a new mark as much as a name.
    const quiz = createAssessment({
      classId: cls.id,
      categoryId: null,
      name: 'Spelling',
      description: null,
      assessmentDate: '2026-09-15',
      maxScore: 20
    })
    await publishToPortal()
    expect(getPublishStatus().upToDate).toBe(true)
    upsertScore({ assessmentId: quiz.id, studentId: student.id, pointsEarned: 17 })
    expect(getPublishStatus().upToDate).toBe(false)
  }, 30_000)

  it('publishes marked assessments, with comments only once the teacher allows them', async () => {
    updateSettings({ portalUrl: portal.url, portalSyncSecret: portal.secrets.sync })
    const cls = createClass({
      name: 'Maths',
      subject: null,
      levelType: 'k12',
      gradeLevel: null,
      termId: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const student = createStudent({
      firstName: 'Mai',
      lastName: 'Chen',
      preferredName: null,
      studentNumber: null,
      dateOfBirth: null,
      gradeLevel: null,
      guardianName: null,
      guardianContact: null,
      email: null,
      notes: null
    })
    enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })
    const quiz = createAssessment({
      classId: cls.id,
      categoryId: null,
      name: 'Fractions quiz',
      description: null,
      assessmentDate: '2026-09-15',
      maxScore: 20
    })
    upsertScore({
      assessmentId: quiz.id,
      studentId: student.id,
      pointsEarned: 17,
      comment: 'Well done'
    })

    const portalDb = (): {
      prepare: (sql: string) => { all: () => unknown[] }
      close: () => void
    } =>
      new (createRequire(import.meta.url)('../../../../portal/node_modules/better-sqlite3'))(
        join(portal.dataDir, 'portal.db'),
        { readonly: true }
      )
    const read = (): unknown[] => {
      const db = portalDb()
      try {
        return db
          .prepare(
            'SELECT a.name, s.points, s.comment FROM assessments a JOIN assessment_scores s ON s.assessment_id = a.id'
          )
          .all()
      } finally {
        db.close()
      }
    }

    await publishToPortal()
    expect(read()).toEqual([{ name: 'Fractions quiz', points: 17, comment: null }])

    updateSettings({ portalScores: { assessments: true, comments: true, classAverage: false } })
    await publishToPortal()
    expect(read()).toEqual([{ name: 'Fractions quiz', points: 17, comment: 'Well done' }])
  }, 30_000)
})
