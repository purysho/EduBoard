import JSZip from 'jszip'
import { AppError } from '@shared/errorCodes'
import { tr } from '@shared/i18n'
import { getClass } from '../repositories/classes'
import { listGradeCategories } from '../repositories/gradeCategories'
import { getRosterForClass } from '../repositories/enrollments'
import { listScheduleSlotsByClass } from '../repositories/classScheduleSlots'
import { listSeatAssignments } from '../repositories/seatAssignments'
import { listLessonPlansByClass } from '../repositories/lessonPlans'
import { getTerm } from '../repositories/terms'
import { listCourseGroups } from '../repositories/courseGroups'

const VERSION = 1

function safeFileName(value: string): string {
  return (
    value
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} ._-]/gu, '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'Class'
  )
}

export interface ClassHandoverBundle {
  buffer: Buffer
  classCount: number
  studentCount: number
}

export async function buildClassHandoverBundle(classIds: string[]): Promise<ClassHandoverBundle> {
  const uniqueIds = [...new Set(classIds.filter((id) => typeof id === 'string' && id.trim()))]
  if (!uniqueIds.length) throw new AppError('EB-0004', tr('Choose at least one class to export.'))

  const zip = new JSZip()
  const exportedAt = new Date().toISOString()
  const files: string[] = []
  let studentCount = 0
  const courseGroups = listCourseGroups()

  for (const classId of uniqueIds) {
    const cls = getClass(classId)
    if (!cls) continue

    const roster = getRosterForClass(classId)
      .filter(({ enrollment }) => enrollment.status === 'active')
      .map(({ student }) => ({
        firstName: student.firstName,
        lastName: student.lastName,
        preferredName: student.preferredName,
        gradeLevel: student.gradeLevel
      }))
    studentCount += roster.length

    const seats = listSeatAssignments(classId)
    const activeNames = new Map(
      getRosterForClass(classId)
        .filter(({ enrollment }) => enrollment.status === 'active')
        .map(({ student }) => [
          student.id,
          `${student.preferredName?.trim() || student.firstName} ${student.lastName}`
        ])
    )
    const term = cls.termId ? getTerm(cls.termId) : undefined
    const courseGroup = cls.courseGroupId
      ? courseGroups.find((group) => group.id === cls.courseGroupId)
      : undefined
    const lessons = listLessonPlansByClass(classId)

    const handover = {
      kind: 'eduboard-class-handover',
      version: VERSION,
      exportedAt,
      privacy: {
        includes: [
          'class setup',
          'active student names',
          'timetable',
          'grade categories',
          'seating positions',
          'lesson plan dates, titles and statuses'
        ],
        excludes: [
          'grades',
          'attendance history',
          'guardian contacts',
          'student notes',
          'passwords',
          'API keys',
          'Portal secrets',
          'student submissions'
        ]
      },
      class: {
        name: cls.name,
        subject: cls.subject,
        levelType: cls.levelType,
        gradeLevel: cls.gradeLevel,
        term: term ? { name: term.name, schoolYear: term.schoolYear } : null,
        courseGroup: courseGroup?.name ?? null,
        schedule: cls.schedule,
        room: cls.room,
        color: cls.color,
        passMark: cls.passMark,
        maxScore: cls.maxScore,
        gradeThresholds: cls.gradeThresholds,
        termWeight: cls.termWeight,
        minAttendance: cls.minAttendance,
        noHomework: cls.noHomework,
        seatingRows: cls.seatingRows,
        seatingCols: cls.seatingCols
      },
      gradeCategories: listGradeCategories(classId).map((category) => ({
        name: category.name,
        weightPercent: category.weightPercent,
        sortOrder: category.sortOrder
      })),
      timetable: listScheduleSlotsByClass(classId).map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room
      })),
      activeStudents: roster,
      seating: seats
        .filter((seat) => activeNames.has(seat.studentId))
        .map((seat) => ({
          studentName: activeNames.get(seat.studentId)!,
          row: seat.row,
          col: seat.col
        })),
      lessons: lessons.map((lesson) => ({
        date: lesson.date,
        originalDate: lesson.originalDate,
        weekLabel: lesson.weekLabel,
        title: lesson.title,
        status: lesson.status
      })),
      lessonSummary: {
        total: lessons.length,
        planned: lessons.filter((lesson) => lesson.status === 'planned').length,
        taught: lessons.filter((lesson) => lesson.status === 'taught').length,
        partly: lessons.filter((lesson) => lesson.status === 'partly').length,
        skipped: lessons.filter((lesson) => lesson.status === 'skipped').length
      }
    }

    let fileName = `${safeFileName(cls.name)}.handover.json`
    let suffix = 2
    while (files.includes(fileName)) {
      fileName = `${safeFileName(cls.name)}-${suffix++}.handover.json`
    }
    files.push(fileName)
    zip.file(fileName, JSON.stringify(handover, null, 2))
  }

  if (!files.length) throw new AppError('EB-0002', tr('Those classes no longer exist.'))

  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        kind: 'eduboard-class-handover-bundle',
        version: VERSION,
        exportedAt,
        classCount: files.length,
        files
      },
      null,
      2
    )
  )

  return {
    buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
    classCount: files.length,
    studentCount
  }
}
