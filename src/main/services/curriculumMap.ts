import { AppError } from '@shared/errorCodes'
import type {
  ClassSection,
  CurriculumMap,
  CurriculumMapAssessmentRef,
  CurriculumMapLesson,
  CurriculumMapScopeType,
  CurriculumMapSection,
  CurriculumStandardCoverage
} from '@shared/types'
import { getClass, listClassesByCourseGroup } from '../repositories/classes'
import { listCourseGroups } from '../repositories/courseGroups'
import { listTerms } from '../repositories/terms'
import { listAssessmentsByClass } from '../repositories/assessments'
import { listLessonPlansByClass, listLessonResourceIds } from '../repositories/lessonPlans'
import { listLessonResources } from '../repositories/lessonResources'

function parseStandards(value: string | null): string[] {
  if (!value) return []
  return [
    ...new Set(
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    )
  ]
}

function resolveScope(
  scopeType: CurriculumMapScopeType,
  scopeId: string
): {
  name: string
  classes: ClassSection[]
} {
  if (scopeType === 'class') {
    const cls = getClass(scopeId)
    if (!cls) throw new AppError('EB-0002', `Class ${scopeId} not found`)
    return { name: cls.name, classes: [cls] }
  }

  const group = listCourseGroups().find((item) => item.id === scopeId)
  if (!group) throw new AppError('EB-0002', `Course group ${scopeId} not found`)
  return { name: group.name, classes: listClassesByCourseGroup(scopeId) }
}

export function getCurriculumMap(
  scopeType: CurriculumMapScopeType,
  scopeId: string
): CurriculumMap {
  const scope = resolveScope(scopeType, scopeId)
  const terms = new Map(listTerms().map((term) => [term.id, term]))
  const resources = new Map(listLessonResources().map((resource) => [resource.id, resource]))

  const sections: CurriculumMapSection[] = scope.classes
    .map((cls) => {
      const term = cls.termId ? terms.get(cls.termId) : undefined
      return {
        classId: cls.id,
        className: cls.name,
        termId: cls.termId,
        termName: term?.name ?? null,
        termSortOrder: term?.sortOrder ?? 10_000
      }
    })
    .sort(
      (a, b) =>
        a.termSortOrder - b.termSortOrder ||
        (a.termName ?? '').localeCompare(b.termName ?? '') ||
        a.className.localeCompare(b.className)
    )

  const sectionOrder = new Map(sections.map((section, index) => [section.classId, index]))
  const allAssessments: CurriculumMapAssessmentRef[] = []
  const linkedAssessmentIds = new Set<string>()
  const lessons: CurriculumMapLesson[] = []

  for (const section of sections) {
    const assessmentRows = listAssessmentsByClass(section.classId)
    const assessmentById = new Map(assessmentRows.map((assessment) => [assessment.id, assessment]))

    for (const assessment of assessmentRows) {
      allAssessments.push({
        id: assessment.id,
        classId: section.classId,
        className: section.className,
        name: assessment.name,
        date: assessment.assessmentDate
      })
    }

    for (const plan of listLessonPlansByClass(section.classId)) {
      const linkedAssessment = plan.linkedAssessmentId
        ? assessmentById.get(plan.linkedAssessmentId)
        : undefined
      if (linkedAssessment) linkedAssessmentIds.add(linkedAssessment.id)

      const attachedResources = listLessonResourceIds(plan.id)
        .map((id) => resources.get(id))
        .filter((resource) => !!resource)
        .map((resource) => ({
          id: resource.id,
          title: resource.title,
          type: resource.type
        }))

      lessons.push({
        id: plan.id,
        classId: section.classId,
        className: section.className,
        termId: section.termId,
        termName: section.termName,
        date: plan.date,
        originalDate: plan.originalDate,
        moved: !!plan.originalDate && plan.originalDate !== plan.date,
        weekLabel: plan.weekLabel,
        title: plan.title,
        status: plan.status,
        standards: parseStandards(plan.standards),
        assessment: linkedAssessment
          ? {
              id: linkedAssessment.id,
              classId: section.classId,
              className: section.className,
              name: linkedAssessment.name,
              date: linkedAssessment.assessmentDate
            }
          : null,
        resources: attachedResources
      })
    }
  }

  lessons.sort(
    (a, b) =>
      (sectionOrder.get(a.classId) ?? 10_000) - (sectionOrder.get(b.classId) ?? 10_000) ||
      a.date.localeCompare(b.date) ||
      a.title.localeCompare(b.title)
  )

  const coverage = new Map<string, CurriculumStandardCoverage>()
  for (const lesson of lessons) {
    for (const code of lesson.standards) {
      const row = coverage.get(code) ?? {
        code,
        lessonCount: 0,
        taughtCount: 0,
        plannedCount: 0,
        skippedCount: 0
      }
      row.lessonCount++
      if (lesson.status === 'taught') row.taughtCount++
      else if (lesson.status === 'planned') row.plannedCount++
      else row.skippedCount++
      coverage.set(code, row)
    }
  }

  const summary = {
    total: lessons.length,
    planned: lessons.filter((lesson) => lesson.status === 'planned').length,
    taught: lessons.filter((lesson) => lesson.status === 'taught').length,
    skipped: lessons.filter((lesson) => lesson.status === 'skipped').length,
    moved: lessons.filter((lesson) => lesson.moved).length
  }

  return {
    scopeType,
    scopeId,
    name: scope.name,
    sections,
    lessons,
    unlinkedAssessments: allAssessments
      .filter((assessment) => !linkedAssessmentIds.has(assessment.id))
      .sort(
        (a, b) =>
          (sectionOrder.get(a.classId) ?? 10_000) - (sectionOrder.get(b.classId) ?? 10_000) ||
          (a.date ?? '').localeCompare(b.date ?? '') ||
          a.name.localeCompare(b.name)
      ),
    standardCoverage: [...coverage.values()].sort((a, b) => a.code.localeCompare(b.code)),
    nextLessonId: lessons.find((lesson) => lesson.status === 'planned')?.id ?? null,
    summary
  }
}
