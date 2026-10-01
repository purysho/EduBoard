import JSZip from 'jszip'
import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { createClass } from '../../repositories/classes'
import { createCourseGroup } from '../../repositories/courseGroups'
import { createGradeCategory } from '../../repositories/gradeCategories'
import { createScheduleSlot } from '../../repositories/classScheduleSlots'
import { createStudent } from '../../repositories/students'
import { enrollStudent } from '../../repositories/enrollments'
import { assignSeat } from '../../repositories/seatAssignments'
import { createLessonPlan } from '../../repositories/lessonPlans'
import { createTerm } from '../../repositories/terms'
import { buildClassHandoverBundle } from '../classHandover'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-handover-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('class handover export', () => {
  it('exports useful setup/context but omits private and historical student data', async () => {
    const term = createTerm({
      name: 'Term 1',
      schoolYear: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-01-15',
      sortOrder: 1
    })
    const group = createCourseGroup({ name: 'University English' })
    const cls = createClass({
      name: 'University English A',
      subject: 'English',
      levelType: 'university',
      gradeLevel: 'Year 1',
      termId: term.id,
      courseGroupId: group.id,
      schedule: 'Mon 09:00',
      room: 'B201',
      color: '#123456',
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    createGradeCategory({ classId: cls.id, name: 'Speaking', weightPercent: 40, sortOrder: 0 })
    createScheduleSlot({
      classId: cls.id,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '09:45',
      room: 'B201'
    })
    const student = createStudent({
      firstName: 'Mai',
      lastName: 'Test',
      preferredName: 'May',
      studentNumber: 'PRIVATE-NUMBER',
      dateOfBirth: '2007-01-01',
      gradeLevel: 'Year 1',
      guardianName: 'Private Guardian',
      guardianContact: 'private@example.com',
      email: 'student@example.com',
      notes: 'PRIVATE STUDENT NOTE'
    })
    enrollStudent({ studentId: student.id, classId: cls.id, enrolledOn: '2026-09-01' })
    assignSeat(cls.id, student.id, 1, 2)
    createLessonPlan({
      classId: cls.id,
      date: '2026-10-01',
      weekLabel: 'Week 5',
      title: 'Discussion strategies',
      objectives: 'Practice discussion strategies.',
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })

    const bundle = await buildClassHandoverBundle([cls.id])
    expect(bundle.classCount).toBe(1)
    expect(bundle.studentCount).toBe(1)

    const zip = await JSZip.loadAsync(bundle.buffer)
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('text'))
    expect(manifest.kind).toBe('eduboard-class-handover-bundle')
    expect(manifest.classCount).toBe(1)

    const handoverText = await zip.file(manifest.files[0])!.async('text')
    const handover = JSON.parse(handoverText)
    expect(handover.class.name).toBe('University English A')
    expect(handover.class.term).toEqual({ name: 'Term 1', schoolYear: '2026-2027' })
    expect(handover.gradeCategories[0].name).toBe('Speaking')
    expect(handover.timetable[0].startTime).toBe('09:00')
    expect(handover.activeStudents[0]).toEqual({
      firstName: 'Mai',
      lastName: 'Test',
      preferredName: 'May',
      gradeLevel: 'Year 1'
    })
    expect(handover.seating[0]).toEqual({ studentName: 'May Test', row: 1, col: 2 })
    expect(handover.lessons[0]).toMatchObject({
      date: '2026-10-01',
      title: 'Discussion strategies',
      status: 'planned'
    })

    expect(handoverText).not.toContain('private@example.com')
    expect(handoverText).not.toContain('PRIVATE STUDENT NOTE')
    expect(handoverText).not.toContain('PRIVATE-NUMBER')
    expect(handoverText).not.toContain('student@example.com')
    expect(handoverText).not.toContain('Private Guardian')
  })
})
