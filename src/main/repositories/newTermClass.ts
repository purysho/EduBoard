import { AppError } from '@shared/errorCodes'
import { getDb } from '../db/client'
import { getClass, createClass } from './classes'
import { getClassAiProfile, setClassAiProfile } from './classAiProfiles'
import { getClassHelperRules, setClassHelperRules } from './classHelperRules'
import { createGradeCategory, listGradeCategories } from './gradeCategories'
import { enrollStudent, getRosterForClass } from './enrollments'
import { createScheduleSlot, listScheduleSlotsByClass } from './classScheduleSlots'
import { listClasses, updateClass } from './classes'
import type { ClassSection } from '@shared/types'
import type {
  DuplicateClassForNewTermInput,
  StartNextTermForClassesInput,
  StartNextTermForClassesResult
} from '@shared/inputs'
import { tr } from '@shared/i18n'

export type { DuplicateClassForNewTermInput, StartNextTermForClassesInput }

/**
 * Starts the next term of a class: a new class with the same setup (grading scale,
 * categories, course group) and, if asked, the same active students. Students are
 * the same student records, so anyone with a Portal account sees the new class under
 * their existing login once it's published; nobody has to sign up again. Grades,
 * attendance and homework stay with the old class.
 */
export function duplicateClassForNewTerm(
  classId: string,
  input: DuplicateClassForNewTermInput
): ClassSection {
  const source = getClass(classId)
  if (!source) throw new AppError('EB-0002', tr('That class no longer exists.'))
  return getDb().transaction(() => {
    const created = createClass({
      name: input.name.trim() || source.name,
      subject: source.subject,
      levelType: source.levelType,
      gradeLevel: source.gradeLevel,
      termId: input.termId,
      courseGroupId: source.courseGroupId,
      termWeight: source.termWeight,
      minAttendance: source.minAttendance,
      schedule: source.schedule,
      room: source.room,
      color: source.color,
      passMark: source.passMark,
      maxScore: source.maxScore,
      gradeThresholds: source.gradeThresholds,
      seatingRows: source.seatingRows,
      seatingCols: source.seatingCols
    })
    // How the teacher teaches the class carries over; the students' level may need a tweak.
    setClassAiProfile(created.id, getClassAiProfile(classId))
    setClassHelperRules(created.id, getClassHelperRules(classId))
    for (const cat of listGradeCategories(classId)) {
      createGradeCategory({
        classId: created.id,
        name: cat.name,
        weightPercent: cat.weightPercent,
        sortOrder: cat.sortOrder
      })
    }
    if (input.copyStudents) {
      const today = new Date().toISOString().slice(0, 10)
      for (const { student, enrollment } of getRosterForClass(classId)) {
        if (enrollment.status !== 'active') continue
        enrollStudent({ studentId: student.id, classId: created.id, enrolledOn: today })
      }
    }
    if (input.copyTimetable) {
      for (const slot of listScheduleSlotsByClass(classId)) {
        createScheduleSlot({
          classId: created.id,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room
        })
      }
    }
    return created
  })
}

/**
 * The end-of-term step for every class at once: a next-term class for each chosen one,
 * all or nothing. A class whose name the chosen term already has is skipped, so running
 * it twice doesn't make doubles. The old classes can be archived in the same step; the
 * Portal keeps archived classes read-only for students.
 */
export function startNextTermForClasses(
  input: StartNextTermForClassesInput
): StartNextTermForClassesResult {
  const key = (name: string): string => name.trim().toLowerCase()
  const taken = new Set(
    listClasses(true)
      .filter((c) => c.termId === input.termId && !c.archived)
      .map((c) => key(c.name))
  )
  const skipped: string[] = []
  let created = 0
  getDb().transaction(() => {
    for (const classId of input.classIds) {
      const source = getClass(classId)
      if (!source) continue
      if (source.termId === input.termId || taken.has(key(source.name))) {
        skipped.push(source.name)
        continue
      }
      duplicateClassForNewTerm(classId, {
        name: source.name,
        termId: input.termId,
        copyStudents: input.copyStudents,
        copyTimetable: input.copyTimetable
      })
      taken.add(key(source.name))
      created++
      if (input.archiveOld) updateClass(classId, { archived: true })
    }
  })
  return { created, skipped }
}
