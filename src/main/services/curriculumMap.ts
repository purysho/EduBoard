import { listClassesByCourseGroup } from '../repositories/classes'
import { listTerms } from '../repositories/terms'
import { listLessonPlansByClass } from '../repositories/lessonPlans'
import { listAssessmentsByClass } from '../repositories/assessments'
import { listLessonResources } from '../repositories/lessonResources'
import { listStandards } from '../repositories/standards'
import { listCourseGroups } from '../repositories/courseGroups'
import type { CurriculumMap } from '@shared/types'

const normalizeCode = (value: string): string => value.trim().toLowerCase()

function lessonStandardCodes(value: string | null): string[] {
  if (!value) return []
  return [...new Set(value.split(',').map((code) => code.trim()).filter(Boolean))]
}

/**
 * Builds a read-only curriculum view from the course structure EduBoard already stores.
 * No curriculum-map tables are added: lesson plans, Standards, assessments and Resources
 * remain the source of truth.
 */
export function getCurriculumMap(courseGroupId: string): CurriculumMap | null {
  const group = listCourseGroups().find((item) => item.id === courseGroupId)
  if (!group) return null

  const terms = new Map(listTerms().map((term) => [term.id, term] as const))
  const standards = listStandards()
  const standardsByCode = new Map(standards.map((standard) => [normalizeCode(standard.code), standard]))
  const resources = listLessonResources()

  const classes = listClassesByCourseGroup(courseGroupId)
    .filter((classSection) => !classSection.archived)
    .map((classSection) => {
      const term = classSection.termId ? terms.get(classSection.termId) : undefined
      const assessments = new Map(
        listAssessmentsByClass(classSection.id).map((assessment) => [assessment.id, assessment] as const)
      )
      const lessons = listLessonPlansByClass(classSection.id).map((lesson) => {
        const standardCodes = lessonStandardCodes(lesson.standards)
        const standardIds = new Set(
          standardCodes
            .map((code) => standardsByCode.get(normalizeCode(code))?.id)
            .filter((id): id is string => !!id)
        )
        const linkedAssessment = lesson.linkedAssessmentId
          ? assessments.get(lesson.linkedAssessmentId)
          : undefined

        return {
          id: lesson.id,
          date: lesson.date,
          weekLabel: lesson.weekLabel,
          title: lesson.title,
          status: lesson.status,
          objectives: lesson.objectives,
          materials: lesson.materials,
          standardCodes,
          linkedAssessment: linkedAssessment
            ? { id: linkedAssessment.id, name: linkedAssessment.name }
            : null,
          resources: resources
            .filter(
              (resource) =>
                resource.standardId !== null &&
                standardIds.has(resource.standardId) &&
                (resource.classId === null || resource.classId === classSection.id)
            )
            .map((resource) => ({
              id: resource.id,
              title: resource.title,
              type: resource.type
            }))
        }
      })

      return {
        classId: classSection.id,
        className: classSection.name,
        termId: classSection.termId,
        termName: term?.name ?? null,
        termStartDate: term?.startDate ?? null,
        lessons
      }
    })
    .sort((a, b) => {
      const aDate = a.termStartDate ?? ''
      const bDate = b.termStartDate ?? ''
      return aDate.localeCompare(bDate) || a.className.localeCompare(b.className)
    })

  return {
    courseGroupId: group.id,
    courseGroupName: group.name,
    classes
  }
}
