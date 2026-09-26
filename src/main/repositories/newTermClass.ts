import { getDb } from '../db/client'
import { getClass, createClass } from './classes'
import { createGradeCategory, listGradeCategories } from './gradeCategories'
import { enrollStudent, getRosterForClass } from './enrollments'
import type { ClassSection } from '@shared/types'
import type { DuplicateClassForNewTermInput } from '@shared/inputs'

export type { DuplicateClassForNewTermInput }

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
  if (!source) throw new Error('That class no longer exists.')
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
    return created
  })
}
