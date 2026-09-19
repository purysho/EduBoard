import { listClassesByCourseGroup } from '../repositories/classes'
import { getTerm } from '../repositories/terms'
import { getRosterForClass } from '../repositories/enrollments'
import { getStudentClassGrade } from './reports'
import { letterForPercent } from './grading'
import type { ClassSection, CompositeGradeClassEntry, StudentCompositeGrade } from '@shared/types'

function classSortKey(cls: ClassSection): number {
  const term = cls.termId ? getTerm(cls.termId) : undefined
  // Classes with no term (or a term that's since been deleted) sort after every dated
  // term, rather than arbitrarily first — a "no term" class isn't earlier than the rest.
  return term ? term.sortOrder : Number.MAX_SAFE_INTEGER
}

/** A student's grade across every class in a course group (e.g. "Math" across Fall and
 * Spring terms), weighted by each class's termWeight and renormalized over whichever
 * classes actually have a grade yet — same "average of entered evidence" rule a single
 * class's category weighting already follows. */
export function getCourseGroupComposite(courseGroupId: string): StudentCompositeGrade[] {
  const classesInGroup = listClassesByCourseGroup(courseGroupId).sort(
    (a, b) => classSortKey(a) - classSortKey(b)
  )
  if (classesInGroup.length === 0) return []

  const studentsById = new Map<string, { id: string; firstName: string; lastName: string }>()
  const rosterByClass = new Map(
    classesInGroup.map((cls) => {
      const roster = getRosterForClass(cls.id)
      for (const { student } of roster) studentsById.set(student.id, student)
      return [cls.id, roster] as const
    })
  )

  const results: StudentCompositeGrade[] = []

  for (const student of studentsById.values()) {
    const classEntries: CompositeGradeClassEntry[] = []
    let weightedSum = 0
    let weightUsed = 0

    for (const cls of classesInGroup) {
      const enrolled = rosterByClass.get(cls.id)?.some((r) => r.student.id === student.id)
      if (!enrolled) continue

      const grade = getStudentClassGrade(student.id, cls.id)
      const term = cls.termId ? getTerm(cls.termId) : undefined

      classEntries.push({
        classId: cls.id,
        className: cls.name,
        termId: cls.termId,
        termName: term?.name ?? null,
        termWeight: cls.termWeight,
        percent: grade?.percent ?? null,
        letter: grade?.letter ?? null
      })

      if (grade?.percent !== null && grade?.percent !== undefined) {
        weightedSum += grade.percent * cls.termWeight
        weightUsed += cls.termWeight
      }
    }

    const compositePercent = weightUsed > 0 ? weightedSum / weightUsed : null
    // Letter grade uses the most recent (last-sorted) class's thresholds in the group —
    // there's no single "right" scale to blend across terms, so we use the latest one.
    const lastClass = classesInGroup[classesInGroup.length - 1]
    const compositeLetter =
      compositePercent !== null
        ? letterForPercent(compositePercent, lastClass.gradeThresholds)
        : null

    results.push({
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      classes: classEntries,
      compositePercent,
      compositeLetter
    })
  }

  return results.sort((a, b) => a.studentName.localeCompare(b.studentName))
}
