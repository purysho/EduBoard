import { addDays } from '@shared/dates'
import type { CoursePack } from '@shared/coursePack'
import type { CourseGroup, Standard, Term, RubricWithCriteria } from '@shared/types'
import { getSqlite } from '../db/client'
import { listCourseGroups, createCourseGroup } from './courseGroups'
import { listTerms, createTerm } from './terms'
import { listStandards, createStandard } from './standards'
import { listRubrics, createRubric } from './rubrics'
import { getClass, updateClass } from './classes'
import { listAssessmentsByClass, createAssessment } from './assessments'
import { listHomeworkAssignmentsByClass, createHomeworkAssignment } from './homeworkAssignments'
import {
  createLessonPlan,
  linkLessonResource,
  listLessonPlansByClass
} from './lessonPlans'
import { listLessonResources, createLessonResource } from './lessonResources'
import { getSettings, updateSettings } from './settingsRepo'

export interface InstallCoursePackInput {
  pack: CoursePack
  /** Course-pack term key -> an existing EduBoard class that should receive that term. */
  termBindings: Record<string, string>
  /** Optional term key -> actual first class date. Relative curriculum dates use this
   * rather than assuming the institution's teaching week begins on the class weekday. */
  firstClassDates?: Record<string, string>
}

export interface CoursePackInstallResult {
  courseGroupId: string
  termIds: Record<string, string>
  standardIds: Record<string, string>
  rubricIds: Record<string, string>
  assessmentIds: Record<string, string>
  created: {
    courseGroups: number
    terms: number
    standards: number
    rubrics: number
    resources: number
    studentFields: number
    assessments: number
    homework: number
    lessons: number
  }
  reused: {
    courseGroups: number
    terms: number
    standards: number
    rubrics: number
    resources: number
    studentFields: number
    assessments: number
    homework: number
    lessons: number
  }
}

const norm = (value: string): string => value.trim().toLowerCase()
const termIdentity = (name: string, schoolYear: string): string => `${norm(name)}|${norm(schoolYear)}`

function dateFromOffset(
  term: Term,
  offset: number | null | undefined,
  firstClassDate?: string
): string | null {
  if (offset === null || offset === undefined) return null
  const anchor = firstClassDate || term.startDate
  if (!anchor) {
    throw new Error(
      `Course Pack term "${term.name}" needs a first class date before relative lesson/assessment dates can be installed.`
    )
  }
  return addDays(anchor, offset)
}

function neededBindingKeys(pack: CoursePack): Set<string> {
  return new Set(
    [...(pack.lessons ?? []), ...(pack.assessments ?? []), ...(pack.homework ?? [])].map((x) =>
      norm(x.termKey)
    )
  )
}

function validateBindings(pack: CoursePack, bindings: Record<string, string>): void {
  const terms = new Map(pack.terms.map((t) => [norm(t.key), t]))
  const usedClassIds = new Map<string, string>()

  for (const key of neededBindingKeys(pack)) {
    const term = terms.get(key)
    if (!term) throw new Error(`Course Pack uses unknown term key ${key}.`)
    const classId = bindings[term.key] ?? bindings[key]
    if (!classId) throw new Error(`Choose an EduBoard class for Course Pack term "${term.name}".`)
    if (!getClass(classId)) throw new Error(`The selected class for "${term.name}" no longer exists.`)

    const previousTerm = usedClassIds.get(classId)
    if (previousTerm) {
      throw new Error(
        `Choose a different EduBoard class for "${term.name}". The same class is already assigned to "${previousTerm}".`
      )
    }
    usedClassIds.set(classId, term.name)
  }
}

/**
 * Installs a reusable Course Pack into existing EduBoard classes.
 *
 * - one SQLite transaction: a failed import leaves no partial curriculum behind;
 * - duplicate-safe: natural identities (course-group name, term name/year, standard code,
 *   rubric name and class-bound template names/dates) are reused;
 * - class-bound content is only created in classes explicitly supplied by the teacher.
 *
 * It deliberately does not delete or overwrite an existing teacher-authored item on a
 * re-import. Pack update/replace semantics can therefore be added later without risking
 * silent loss of local edits.
 */
export function installCoursePack(input: InstallCoursePackInput): CoursePackInstallResult {
  const { pack, termBindings, firstClassDates = {} } = input
  validateBindings(pack, termBindings)

  return getSqlite().transaction(() => {
    const created = {
      courseGroups: 0,
      terms: 0,
      standards: 0,
      rubrics: 0,
      resources: 0,
      studentFields: 0,
      assessments: 0,
      homework: 0,
      lessons: 0
    }
    const reused = { ...created }

    let courseGroup: CourseGroup | undefined = listCourseGroups().find(
      (g) => norm(g.name) === norm(pack.name)
    )
    if (courseGroup) reused.courseGroups++
    else {
      courseGroup = createCourseGroup({ name: pack.name })
      created.courseGroups++
    }

    const existingTerms = new Map(
      listTerms().map((t) => [termIdentity(t.name, t.schoolYear), t] as const)
    )
    const termRows = new Map<string, Term>()
    const termIds: Record<string, string> = {}
    for (const source of pack.terms) {
      const identity = termIdentity(source.name, source.schoolYear)
      let term = existingTerms.get(identity)
      if (term) reused.terms++
      else {
        term = createTerm({
          name: source.name,
          schoolYear: source.schoolYear,
          startDate: source.startDate,
          endDate: source.endDate,
          sortOrder: source.sortOrder ?? existingTerms.size
        })
        existingTerms.set(identity, term)
        created.terms++
      }
      termRows.set(norm(source.key), term)
      termIds[source.key] = term.id
    }

    const existingStandards = new Map(listStandards().map((s) => [norm(s.code), s] as const))
    const standardRows = new Map<string, Standard>()
    const standardIds: Record<string, string> = {}
    for (const source of pack.standards ?? []) {
      let standard = existingStandards.get(norm(source.code))
      if (standard) reused.standards++
      else {
        standard = createStandard({
          code: source.code,
          description: source.description,
          subject: source.subject ?? pack.subject ?? null
        })
        existingStandards.set(norm(source.code), standard)
        created.standards++
      }
      standardRows.set(norm(source.key), standard)
      standardIds[source.key] = standard.id
    }

    const existingRubrics = new Map(listRubrics().map((r) => [norm(r.name), r] as const))
    const rubricRows = new Map<string, RubricWithCriteria>()
    const rubricIds: Record<string, string> = {}
    for (const source of pack.rubrics ?? []) {
      let rubric = existingRubrics.get(norm(source.name))
      if (rubric) reused.rubrics++
      else {
        rubric = createRubric({
          name: source.name,
          description: source.description ?? null,
          criteria: source.criteria.map((criterion) => ({
            name: criterion.name,
            description: criterion.description ?? null,
            standardId: criterion.standardKey
              ? (standardRows.get(norm(criterion.standardKey))?.id ?? null)
              : null,
            levels: criterion.levels.map((level) => ({
              label: level.label,
              points: level.points,
              description: level.description ?? null
            }))
          }))
        })
        existingRubrics.set(norm(source.name), rubric)
        created.rubrics++
      }
      rubricRows.set(norm(source.key), rubric)
      rubricIds[source.key] = rubric.id
    }

    const existingResources = listLessonResources()
    const resourceRows = new Map<string, (typeof existingResources)[number]>()
    for (const source of pack.resources ?? []) {
      const standardId = source.standardKey
        ? (standardRows.get(norm(source.standardKey))?.id ?? null)
        : null
      const existing = existingResources.find(
        (resource) =>
          norm(resource.title) === norm(source.title) &&
          resource.type === source.type &&
          (resource.url ?? null) === (source.url ?? null) &&
          (resource.notes ?? null) === (source.notes ?? null) &&
          resource.standardId === standardId &&
          JSON.stringify(resource.tags) === JSON.stringify(source.tags ?? [])
      )
      if (existing) {
        resourceRows.set(norm(source.key), existing)
        reused.resources++
        continue
      }
      const resource = createLessonResource({
        title: source.title,
        type: source.type,
        url: source.url ?? null,
        filePath: null,
        notes: source.notes ?? null,
        tags: source.tags ?? [],
        standardId,
        classId: null,
        shareWithStudents: false,
        studyGuide: null
      })
      existingResources.push(resource)
      resourceRows.set(norm(source.key), resource)
      created.resources++
    }

    const settings = getSettings()
    const existingFields = settings.studentFields ?? []
    const mergedFields = [...existingFields]
    for (const source of pack.studentFields ?? []) {
      const existing = existingFields.find((field) => norm(field.id) === norm(source.id))
      if (existing) {
        if (
          existing.label !== source.label ||
          Boolean(existing.onSeatingChart) !== Boolean(source.onSeatingChart)
        ) {
          throw new Error(
            `Course Pack student field "${source.id}" conflicts with the existing field of that id.`
          )
        }
        reused.studentFields++
        continue
      }
      mergedFields.push(source)
      created.studentFields++
    }
    if (created.studentFields > 0) updateSettings({ studentFields: mergedFields })

    // The user's selected classes are the only existing records a pack intentionally edits:
    // bind each to the reusable course group and to the matching term.
    for (const source of pack.terms) {
      const classId = termBindings[source.key] ?? termBindings[norm(source.key)]
      if (!classId) continue
      const term = termRows.get(norm(source.key))!
      const cls = getClass(classId)!
      if (cls.courseGroupId !== courseGroup.id || cls.termId !== term.id) {
        updateClass(classId, { courseGroupId: courseGroup.id, termId: term.id })
      }
    }

    const assessmentIds: Record<string, string> = {}
    const assessmentIdsByKey = new Map<string, string>()
    for (const source of pack.assessments ?? []) {
      const classId = termBindings[source.termKey] ?? termBindings[norm(source.termKey)]
      if (!classId) continue
      const term = termRows.get(norm(source.termKey))!
      const date = dateFromOffset(
        term,
        source.offsetDays,
        firstClassDates[source.termKey] ?? firstClassDates[norm(source.termKey)]
      )
      const existing = listAssessmentsByClass(classId).find(
        (a) => norm(a.name) === norm(source.name) && a.assessmentDate === date
      )
      if (existing) {
        assessmentIds[source.key] = existing.id
        assessmentIdsByKey.set(norm(source.key), existing.id)
        reused.assessments++
        continue
      }
      const rubric = source.rubricKey ? rubricRows.get(norm(source.rubricKey)) : undefined
      const assessment = createAssessment({
        classId,
        categoryId: null,
        rubricId: rubric?.id ?? null,
        name: source.name,
        description: source.description ?? null,
        assessmentDate: date,
        maxScore: source.maxScore ?? rubric?.maxPoints ?? 100,
        isFinal: source.isFinal ?? false,
        sortOrder: source.sortOrder ?? 0
      })
      assessmentIds[source.key] = assessment.id
      assessmentIdsByKey.set(norm(source.key), assessment.id)
      created.assessments++
    }

    for (const source of pack.homework ?? []) {
      const classId = termBindings[source.termKey] ?? termBindings[norm(source.termKey)]
      if (!classId) continue
      const term = termRows.get(norm(source.termKey))!
      const dueDate = dateFromOffset(
        term,
        source.dueOffsetDays,
        firstClassDates[source.termKey] ?? firstClassDates[norm(source.termKey)]
      )
      const existing = listHomeworkAssignmentsByClass(classId).find(
        (h) => norm(h.title) === norm(source.title) && h.dueDate === dueDate
      )
      if (existing) {
        reused.homework++
        continue
      }
      createHomeworkAssignment({
        classId,
        title: source.title,
        description: source.description ?? null,
        dueDate,
        filePath: null,
        fileName: null,
        topic: source.topic ?? null,
        status: source.status ?? 'draft',
        rubricId: source.rubricKey ? (rubricRows.get(norm(source.rubricKey))?.id ?? null) : null
      })
      created.homework++
    }

    for (const source of pack.lessons ?? []) {
      const classId = termBindings[source.termKey] ?? termBindings[norm(source.termKey)]
      if (!classId) continue
      const term = termRows.get(norm(source.termKey))!
      const date = dateFromOffset(
        term,
        source.offsetDays,
        firstClassDates[source.termKey] ?? firstClassDates[norm(source.termKey)]
      )
      if (!date) throw new Error(`Lesson "${source.title}" needs a first class date.`)
      const existing = listLessonPlansByClass(classId).find(
        (lesson) =>
          norm(lesson.title) === norm(source.title) &&
          (lesson.originalDate === date || lesson.date === date)
      )
      let lesson = existing
      if (lesson) {
        reused.lessons++
      } else {
        const standards = (source.standardKeys ?? [])
          .map((key) => standardRows.get(norm(key))?.code)
          .filter((code): code is string => !!code)
        lesson = createLessonPlan({
          classId,
          date,
          weekLabel: source.weekLabel ?? null,
          title: source.title,
          objectives: source.objectives ?? null,
          framework: source.framework ?? null,
          materials: source.materials ?? null,
          activities: source.activities ?? null,
          homework: source.homework ?? null,
          linkedAssessmentId: source.assessmentKey
            ? (assessmentIdsByKey.get(norm(source.assessmentKey)) ?? null)
            : null,
          standards: standards.length ? standards.join(', ') : null
        })
        created.lessons++
      }

      // Pack links are additive. Re-import restores missing pack links but never removes a
      // resource the teacher attached locally after import.
      for (const resourceKey of source.resourceKeys ?? []) {
        const resource = resourceRows.get(norm(resourceKey))
        if (resource) linkLessonResource(lesson.id, resource.id)
      }
    }

    return {
      courseGroupId: courseGroup.id,
      termIds,
      standardIds,
      rubricIds,
      assessmentIds,
      created,
      reused
    }
  })()
}
