// The pilot summary holds counts only: never a name, a grade or anything anyone wrote.
// Seeded with made-up (synthetic) data.
import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { isPackaged: false, getVersion: () => '0.7.10', getPath: () => tmpdir() }
}))

import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { markAttendance } from '../../repositories/attendanceRecords'
import { createAssessment } from '../../repositories/assessments'
import { upsertScore } from '../../repositories/scores'
import { addBehaviourPoint } from '../../repositories/behaviourPoints'
import { createStudentLogEntry } from '../../repositories/studentLogEntries'
import { setReportComment } from '../../repositories/reportComments'
import { updateSettings } from '../../repositories/settingsRepo'
import { pilotSummaryNow } from '../pilotSummary'
import {
  PILOT_SUMMARY_FEATURES,
  buildPilotSummary,
  daysBand,
  usageBand
} from '@shared/pilotSummary'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-pilot-summary-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

// Distinctive made-up values, so finding any of them in the file would be no accident.
const SECRETS = {
  className: 'Quokkaclass Synthetica',
  subject: 'Zylophonics',
  firstName: 'Xanthippe',
  lastName: 'Quillfeather',
  preferredName: 'Xanny',
  studentNumber: 'SYN-90417',
  dateOfBirth: '2015-03-14',
  guardian: 'Barnaby Quillfeather',
  contact: '+86 139 0000 4242',
  email: 'xanthippe@example.invalid',
  notes: 'Allergic to synthetic peanuts',
  assessment: 'Wombat fractions quiz',
  score: 17.75,
  attendanceNote: 'Dentist on Mars',
  logText: 'Called about the imaginary trip',
  comment: 'Xanthippe reads every single night.',
  school: 'Synthetic Bilingual Academy'
}

function seed(): void {
  updateSettings({ schoolName: SECRETS.school, teacherName: 'Ms Synthetic', pilotMode: true })
  const classId = createClass({
    name: SECRETS.className,
    subject: SECRETS.subject,
    levelType: 'k12',
    gradeLevel: null,
    termId: null,
    schedule: null,
    room: 'Room 404',
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  }).id
  const studentId = createStudent({
    firstName: SECRETS.firstName,
    lastName: SECRETS.lastName,
    preferredName: SECRETS.preferredName,
    studentNumber: SECRETS.studentNumber,
    dateOfBirth: SECRETS.dateOfBirth,
    gradeLevel: null,
    guardianName: SECRETS.guardian,
    guardianContact: SECRETS.contact,
    email: SECRETS.email,
    notes: SECRETS.notes
  }).id
  enrollStudent({ studentId, classId, enrolledOn: '2026-09-01' })
  markAttendance({
    classId,
    studentId,
    date: '2026-09-11',
    status: 'absent',
    note: SECRETS.attendanceNote
  })
  const quiz = createAssessment({
    classId,
    categoryId: null,
    name: SECRETS.assessment,
    description: null,
    assessmentDate: '2026-09-15',
    maxScore: 20
  })
  upsertScore({ assessmentId: quiz.id, studentId, pointsEarned: SECRETS.score })
  addBehaviourPoint({ classId, studentId, points: 1 })
  createStudentLogEntry({ studentId, type: 'contact', text: SECRETS.logText })
  setReportComment(classId, studentId, SECRETS.comment)
}

describe('pilot summary', () => {
  it('contains no names, grades, dates of birth or anything anyone wrote', () => {
    seed()
    const json = JSON.stringify(pilotSummaryNow(new Date('2026-10-20T08:00:00Z')), null, 2)
    for (const [what, value] of Object.entries(SECRETS)) {
      expect(json, what).not.toContain(String(value))
    }
    expect(json).not.toContain('Ms Synthetic')
    expect(json).not.toContain('Room 404')
    // Nothing but the known keys and short, banded values.
    const summary = JSON.parse(json)
    expect(Object.keys(summary).sort()).toEqual(
      [
        'kind',
        'formatVersion',
        'madeOn',
        'appVersion',
        'os',
        'language',
        'pilotMode',
        'sampleSchool',
        'passwordProtected',
        'classes',
        'students',
        'daysActive',
        'features'
      ].sort()
    )
    expect(Object.keys(summary.features).sort()).toEqual(
      PILOT_SUMMARY_FEATURES.map((f) => f.id).sort()
    )
    for (const band of Object.values(summary.features)) {
      expect(['none', '1-9', '10-49', '50+']).toContain(band)
    }
  })

  it('counts what was used, in bands', () => {
    seed()
    const summary = pilotSummaryNow(new Date('2026-10-20T08:00:00Z'))
    expect(summary).toMatchObject({
      madeOn: '2026-10-20',
      appVersion: '0.7.10',
      pilotMode: true,
      classes: '1-2',
      students: '1-30'
    })
    expect(summary.features.attendance).toBe('1-9')
    expect(summary.features.gradebook).toBe('1-9')
    expect(summary.features.reportComments).toBe('1-9')
    expect(summary.features.homework).toBe('none')
    expect(summary.daysActive).not.toBe('0')
  })

  it('bands every count', () => {
    expect([0, 1, 9, 10, 49, 50, 5000].map(usageBand)).toEqual([
      'none',
      '1-9',
      '1-9',
      '10-49',
      '10-49',
      '50+',
      '50+'
    ])
    expect([0, 3, 12, 20, 45].map(daysBand)).toEqual(['0', '1-4', '5-14', '15-29', '30+'])
    const summary = buildPilotSummary({
      madeOn: new Date('2026-10-20T23:59:00Z'),
      appVersion: '1.0.0',
      os: 'windows',
      language: 'zh',
      pilotMode: true,
      sampleSchool: false,
      passwordProtected: true,
      classCount: 4,
      studentCount: 120,
      activeDays: 18,
      rowCounts: { scores: 600 }
    })
    expect(summary).toMatchObject({ classes: '3-5', students: '101+', daysActive: '15-29' })
    expect(summary.features.gradebook).toBe('50+')
    expect(summary.features.attendance).toBe('none')
  })
})
