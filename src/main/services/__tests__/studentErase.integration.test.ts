import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ dir: '' }))

vi.mock('electron', () => ({
  app: { relaunch: vi.fn(), exit: vi.fn(), getPath: () => state.dir, isPackaged: false }
}))
vi.mock('../../db/path', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../db/path')>()
  return {
    ...real,
    resolveDbPath: () => join(state.dir, 'eduboard.db'),
    resolveBackupsDir: () => {
      const d = join(state.dir, 'backups')
      mkdirSync(d, { recursive: true })
      return d
    }
  }
})

import { closeDb, getSqlite, initDb, setDbPathForTesting } from '../../db/client'
import { createClass } from '../../repositories/classes'
import { createStudent, getStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { markAttendance } from '../../repositories/attendanceRecords'
import { createStudentLogEntry } from '../../repositories/studentLogEntries'
import { listAuditLog } from '../../repositories/auditLog'
import {
  setExitTicketOpen,
  submitExitTicketResponse,
  upsertExitTicket
} from '../../repositories/exitTickets'
import { createLessonResource } from '../../repositories/lessonResources'
import { importStudyProgressReturn } from '../../repositories/studyProgressReturns'
import { createBackup } from '../backup'
import { eraseStudent, exportStudentData } from '../studentErase'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

const dbFile = (): string => join(state.dir, 'eduboard.db')
type Row = Record<string, unknown>

function student(firstName: string, lastName: string, notes: string): string {
  return createStudent({
    firstName,
    lastName,
    preferredName: null,
    studentNumber: null,
    dateOfBirth: '2016-03-04',
    gradeLevel: null,
    guardianName: 'Guardian Zanzibar',
    guardianContact: '555-0199',
    email: null,
    notes
  }).id
}

let classId: string
let erased: string
let kept: string

beforeEach(() => {
  state.dir = mkdtempSync(join(tmpdir(), 'eduboard-erase-'))
  setDbPathForTesting(dbFile())
  initDb()
  classId = createClass({
    name: 'Grade 4',
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
  }).id
  erased = student('Quillon', 'Vantasse', 'Allergic to peanuts')
  kept = student('Mai', 'Chen', 'Sits near the front')
  for (const id of [erased, kept]) {
    enrollStudent({ studentId: id, classId, enrolledOn: '2026-09-01' })
    markAttendance({ classId, studentId: id, date: '2026-09-02', status: 'present' })
    createStudentLogEntry({ studentId: id, type: 'note', text: `Note about ${id}` })
  }
  const ticket = upsertExitTicket({
    classId,
    title: 'T',
    questions: [{ id: 'q1', prompt: 'Q', type: 'text' }]
  })
  setExitTicketOpen(ticket.id, true)
  submitExitTicketResponse({
    exitTicketId: ticket.id,
    studentName: 'Quillon Vantasse',
    studentId: erased,
    answers: { q1: 'roster answer' }
  })
  // From before names came from the roster: only the typed name links it to them.
  submitExitTicketResponse({
    exitTicketId: ticket.id,
    studentName: 'quillon vantasse ',
    answers: { q1: 'typed answer' }
  })
  // Offline Study Pack progress that was never linked to a student (no unique match):
  // only the typed name says whose it is.
  const resource = createLessonResource({
    title: 'Museum vocabulary',
    type: 'note',
    url: null,
    filePath: null,
    notes: null,
    tags: [],
    standardId: null,
    classId: null,
    shareWithStudents: false,
    studyGuide: null
  })
  for (const studentName of ['QUILLON  Vantasse', 'Mai Chen']) {
    importStudyProgressReturn(
      {
        format: 'eduboard-study-progress',
        version: 1,
        resourceId: resource.id,
        resourceTitle: resource.title,
        studentName,
        exportedAt: '2026-10-02T08:00:00.000Z',
        cards: { got: 3, again: 1, total: 5 },
        quiz: { correct: 2, answered: 3, total: 4 }
      },
      null
    )
  }
})

afterEach(() => {
  closeDb()
  rmSync(state.dir, { recursive: true, force: true })
})

describe('a student’s data', () => {
  it('is gathered from every table that refers to them', () => {
    const data = exportStudentData(erased)
    expect(data.student).toMatchObject({ first_name: 'Quillon', guardian_contact: '555-0199' })
    expect(Object.keys(data.records)).toEqual(
      expect.arrayContaining([
        'enrollments',
        'attendance_records',
        'student_log_entries',
        'exit_ticket_responses',
        'audit_log'
      ])
    )
    expect(data.records.exit_ticket_responses).toHaveLength(2)
    expect(data.records.study_progress_returns).toMatchObject([
      { student_name: 'QUILLON  Vantasse' }
    ])
    expect(JSON.stringify(data)).not.toContain('Mai')
  })

  it('is erased for good: every row, their audit trail, and from the file itself', () => {
    createBackup()
    const result = eraseStudent(erased)
    expect(result.rowsErased).toBeGreaterThan(5)
    expect(result.olderBackups).toBe(1)

    expect(getStudent(erased)).toBeUndefined()
    expect(getStudent(kept)).toBeDefined()
    const count = (sql: string, ...args: unknown[]): number =>
      (
        getSqlite()
          .prepare(sql)
          .get(...args) as { c: number }
      ).c
    for (const table of ['enrollments', 'attendance_records', 'student_log_entries', 'audit_log']) {
      expect(count(`SELECT count(*) c FROM ${table} WHERE student_id = ?`, erased)).toBe(0)
      expect(count(`SELECT count(*) c FROM ${table} WHERE student_id = ?`, kept)).toBeGreaterThan(0)
    }
    expect(count('SELECT count(*) c FROM exit_ticket_responses')).toBe(0)
    // The unlinked progress return is theirs and goes; the other student's stays.
    expect(
      (getSqlite().prepare('SELECT student_name FROM study_progress_returns').all() as Row[]).map(
        (r) => r.student_name
      )
    ).toEqual(['Mai Chen'])

    const log = listAuditLog({}).map((e) => e.summary)
    expect(log.some((s) => /Quillon|Vantasse/.test(s))).toBe(false)
    expect(log).toContain('Erased all records of a student at their request')

    // Deleted rows can linger in a SQLite file's free pages; erasing rebuilds it.
    closeDb()
    const bytes = readFileSync(dbFile()).toString('latin1')
    // (Both test students share a guardian, so the guardian's name rightly stays.)
    for (const secret of ['Quillon', 'Vantasse', 'Allergic to peanuts']) {
      expect(bytes.includes(secret)).toBe(false)
    }
    expect(bytes.includes('Sits near the front')).toBe(true) // the other student is untouched
  })
})
