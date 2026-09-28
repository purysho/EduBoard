import { AppError } from './errorCodes'
import { LESSON_RESOURCE_TYPES, type LessonResourceType, type StudentField } from './types'

export const COURSE_PACK_KIND = 'eduboard-course-pack' as const
export const COURSE_PACK_VERSION = 1 as const

export interface CoursePackTerm {
  key: string
  name: string
  schoolYear: string
  startDate: string | null
  endDate: string | null
  sortOrder: number
}

export interface CoursePackStandard {
  code: string
  description: string
  subject: string | null
}

export interface CoursePackRubricCriterion {
  name: string
  description: string | null
  standardCode: string | null
  levels: { label: string; points: number; description: string | null }[]
}

export interface CoursePackRubric {
  key: string
  name: string
  description: string | null
  criteria: CoursePackRubricCriterion[]
}

export interface CoursePackAssessmentTemplate {
  key: string
  termKey: string
  name: string
  description: string | null
  maxScore: number
  rubricKey: string | null
  isFinal: boolean
}

export interface CoursePackHomeworkTemplate {
  key: string
  termKey: string
  title: string
  description: string | null
  topic: string | null
  rubricKey: string | null
}

export interface CoursePackResource {
  key: string
  title: string
  type: LessonResourceType
  url: string | null
  notes: string | null
  tags: string[]
  standardCode: string | null
  termKeys: string[]
}

export interface CoursePackSession {
  key: string
  termKey: string
  sequence: number
  title: string
  durationMinutes: number | null
  optional: boolean
  objectives: string | null
  framework: string | null
  materials: string | null
  activities: string | null
  homework: string | null
  standardCodes: string[]
  assessmentKeys: string[]
  resourceKeys: string[]
}

export interface CoursePack {
  kind: typeof COURSE_PACK_KIND
  version: typeof COURSE_PACK_VERSION
  packId: string
  revision: number
  createdAt: string
  name: string
  description: string | null
  courseGroupName: string
  subject: string | null
  terms: CoursePackTerm[]
  studentFields: StudentField[]
  standards: CoursePackStandard[]
  rubrics: CoursePackRubric[]
  assessments: CoursePackAssessmentTemplate[]
  homework: CoursePackHomeworkTemplate[]
  resources: CoursePackResource[]
  sessions: CoursePackSession[]
}

export interface ImportedCoursePack {
  id: string
  packId: string
  revision: number
  name: string
  description: string | null
  courseGroupId: string
  importedAt: string
}

export interface CurriculumSession {
  id: string
  coursePackId: string
  termKey: string
  sequence: number
  title: string
  durationMinutes: number | null
  optional: boolean
  objectives: string | null
  framework: string | null
  materials: string | null
  activities: string | null
  homework: string | null
  standardCodes: string[]
  assessmentKeys: string[]
  resourceKeys: string[]
}

function invalid(reason: string): never {
  throw new AppError('EB-2007', reason)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return invalid('That course pack contains an invalid object.')
  }
  return value as Record<string, unknown>
}

function asString(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string') return invalid(label + ' must be text.')
  const out = value.trim()
  if (!out || out.length > max) return invalid(label + ' is missing or too long.')
  return out
}

function asNullableString(value: unknown, label: string, max: number): string | null {
  if (value === undefined || value === null || value === '') return null
  return asString(value, label, max)
}

function asSlug(value: unknown, label: string): string {
  const out = asString(value, label, 64)
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(out)) {
    return invalid(label + ' may contain only lowercase letters, numbers, ".", "_" and "-".')
  }
  return out
}

function asNumber(
  value: unknown,
  label: string,
  min: number,
  max: number,
  integer = false
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    return invalid(
      label +
        ' must be a ' +
        (integer ? 'whole ' : '') +
        'number between ' +
        min +
        ' and ' +
        max +
        '.'
    )
  }
  return value
}

function asDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
    return invalid(label + ' must be YYYY-MM-DD.')
  }
  return value
}

function asList(value: unknown, label: string, max: number): unknown[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value) || value.length > max) {
    return invalid(label + ' must be a list with at most ' + max + ' items.')
  }
  return value
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = value.toLowerCase()
    if (seen.has(normalized)) return invalid(label + ' contains duplicate value "' + value + '".')
    seen.add(normalized)
  }
}

function requireKnown(value: string | null, known: Set<string>, label: string): void {
  if (value && !known.has(value)) invalid(label + ' refers to unknown key "' + value + '".')
}

export function parseCoursePack(json: string): CoursePack {
  let raw: Record<string, unknown>
  try {
    raw = asRecord(JSON.parse(json))
  } catch (err) {
    if (err instanceof AppError) throw err
    return invalid('That file is not readable JSON.')
  }

  if (raw.kind !== COURSE_PACK_KIND || raw.version !== COURSE_PACK_VERSION) {
    return invalid('That file is not an EduBoard Course Pack (version 1).')
  }

  const terms = asList(raw.terms, 'terms', 20).map((value, index): CoursePackTerm => {
    const x = asRecord(value)
    return {
      key: asSlug(x.key, 'term key'),
      name: asString(x.name, 'term name', 100),
      schoolYear: asString(x.schoolYear, 'term school year', 40),
      startDate: asDate(x.startDate, 'term start date'),
      endDate: asDate(x.endDate, 'term end date'),
      sortOrder:
        x.sortOrder === undefined ? index : asNumber(x.sortOrder, 'term sort order', 0, 1000, true)
    }
  })
  if (!terms.length) invalid('A Course Pack needs at least one term.')
  assertUnique(
    terms.map((term) => term.key),
    'Term keys'
  )
  const termKeys = new Set(terms.map((term) => term.key))

  const studentFields = asList(raw.studentFields, 'studentFields', 30).map(
    (value): StudentField => {
      const x = asRecord(value)
      return {
        id: asSlug(x.id, 'student field id'),
        label: asString(x.label, 'student field label', 60),
        ...(x.onSeatingChart === true ? { onSeatingChart: true } : {})
      }
    }
  )
  assertUnique(
    studentFields.map((field) => field.id),
    'Student field ids'
  )

  const standards = asList(raw.standards, 'standards', 200).map(
    (value): CoursePackStandard => {
      const x = asRecord(value)
      return {
        code: asString(x.code, 'standard code', 40),
        description: asString(x.description, 'standard description', 1000),
        subject: asNullableString(x.subject, 'standard subject', 120)
      }
    }
  )
  assertUnique(
    standards.map((standard) => standard.code),
    'Standard codes'
  )
  const standardCodes = new Set(standards.map((standard) => standard.code))

  const rubrics = asList(raw.rubrics, 'rubrics', 100).map((value): CoursePackRubric => {
    const x = asRecord(value)
    const criteria = asList(x.criteria, 'rubric criteria', 40).map(
      (criterionValue): CoursePackRubricCriterion => {
        const criterion = asRecord(criterionValue)
        const standardCode = asNullableString(criterion.standardCode, 'rubric standard code', 40)
        requireKnown(standardCode, standardCodes, 'Rubric criterion')
        const levels = asList(criterion.levels, 'rubric levels', 12).map((levelValue) => {
          const level = asRecord(levelValue)
          return {
            label: asString(level.label, 'rubric level label', 60),
            points: asNumber(level.points, 'rubric level points', 0, 1000),
            description: asNullableString(level.description, 'rubric level description', 1000)
          }
        })
        if (!levels.length) invalid('Every rubric criterion needs at least one level.')
        return {
          name: asString(criterion.name, 'rubric criterion name', 120),
          description: asNullableString(criterion.description, 'rubric criterion description', 1000),
          standardCode,
          levels
        }
      }
    )
    if (!criteria.length) invalid('Every rubric needs at least one criterion.')
    return {
      key: asSlug(x.key, 'rubric key'),
      name: asString(x.name, 'rubric name', 120),
      description: asNullableString(x.description, 'rubric description', 2000),
      criteria
    }
  })
  assertUnique(
    rubrics.map((rubric) => rubric.key),
    'Rubric keys'
  )
  const rubricKeys = new Set(rubrics.map((rubric) => rubric.key))

  const assessments = asList(raw.assessments, 'assessments', 200).map(
    (value): CoursePackAssessmentTemplate => {
      const x = asRecord(value)
      const termKey = asSlug(x.termKey, 'assessment term key')
      requireKnown(termKey, termKeys, 'Assessment')
      const rubricKey = asNullableString(x.rubricKey, 'assessment rubric key', 64)
      requireKnown(rubricKey, rubricKeys, 'Assessment')
      return {
        key: asSlug(x.key, 'assessment key'),
        termKey,
        name: asString(x.name, 'assessment name', 120),
        description: asNullableString(x.description, 'assessment description', 3000),
        maxScore:
          x.maxScore === undefined ? 100 : asNumber(x.maxScore, 'assessment max score', 0.1, 1000),
        rubricKey,
        isFinal: x.isFinal === true
      }
    }
  )
  assertUnique(
    assessments.map((assessment) => assessment.key),
    'Assessment keys'
  )
  const assessmentKeys = new Set(assessments.map((assessment) => assessment.key))

  const homework = asList(raw.homework, 'homework', 300).map(
    (value): CoursePackHomeworkTemplate => {
      const x = asRecord(value)
      const termKey = asSlug(x.termKey, 'homework term key')
      requireKnown(termKey, termKeys, 'Homework')
      const rubricKey = asNullableString(x.rubricKey, 'homework rubric key', 64)
      requireKnown(rubricKey, rubricKeys, 'Homework')
      return {
        key: asSlug(x.key, 'homework key'),
        termKey,
        title: asString(x.title, 'homework title', 160),
        description: asNullableString(x.description, 'homework description', 5000),
        topic: asNullableString(x.topic, 'homework topic', 160),
        rubricKey
      }
    }
  )
  assertUnique(
    homework.map((assignment) => assignment.key),
    'Homework keys'
  )

  const resources = asList(raw.resources, 'resources', 500).map(
    (value): CoursePackResource => {
      const x = asRecord(value)
      const type = asString(x.type, 'resource type', 20) as LessonResourceType
      if (!(LESSON_RESOURCE_TYPES as readonly string[]).includes(type)) {
        invalid('A resource has an unsupported type.')
      }
      const standardCode = asNullableString(x.standardCode, 'resource standard code', 40)
      requireKnown(standardCode, standardCodes, 'Resource')
      const resourceTermKeys = asList(x.termKeys, 'resource term keys', 20).map((key) =>
        asSlug(key, 'resource term key')
      )
      for (const termKey of resourceTermKeys) requireKnown(termKey, termKeys, 'Resource')
      const tags = asList(x.tags, 'resource tags', 30).map((tag) =>
        asString(tag, 'resource tag', 60)
      )
      assertUnique(tags, 'Resource tags')
      return {
        key: asSlug(x.key, 'resource key'),
        title: asString(x.title, 'resource title', 160),
        type,
        url: asNullableString(x.url, 'resource url', 2000),
        notes: asNullableString(x.notes, 'resource notes', 5000),
        tags,
        standardCode,
        termKeys: resourceTermKeys
      }
    }
  )
  assertUnique(
    resources.map((resource) => resource.key),
    'Resource keys'
  )
  const resourceKeys = new Set(resources.map((resource) => resource.key))

  const sessions = asList(raw.sessions, 'sessions', 500).map((value): CoursePackSession => {
    const x = asRecord(value)
    const termKey = asSlug(x.termKey, 'session term key')
    requireKnown(termKey, termKeys, 'Session')
    const sessionStandards = asList(x.standardCodes, 'session standard codes', 40).map((code) =>
      asString(code, 'session standard code', 40)
    )
    for (const code of sessionStandards) requireKnown(code, standardCodes, 'Session')
    const sessionAssessments = asList(x.assessmentKeys, 'session assessment keys', 20).map((key) =>
      asSlug(key, 'session assessment key')
    )
    for (const key of sessionAssessments) requireKnown(key, assessmentKeys, 'Session')
    const sessionResources = asList(x.resourceKeys, 'session resource keys', 50).map((key) =>
      asSlug(key, 'session resource key')
    )
    for (const key of sessionResources) requireKnown(key, resourceKeys, 'Session')
    assertUnique(sessionStandards, 'Session standard codes')
    assertUnique(sessionAssessments, 'Session assessment keys')
    assertUnique(sessionResources, 'Session resource keys')
    return {
      key: asSlug(x.key, 'session key'),
      termKey,
      sequence: asNumber(x.sequence, 'session sequence', 1, 1000, true),
      title: asString(x.title, 'session title', 160),
      durationMinutes:
        x.durationMinutes === undefined || x.durationMinutes === null
          ? null
          : asNumber(x.durationMinutes, 'session duration', 1, 600, true),
      optional: x.optional === true,
      objectives: asNullableString(x.objectives, 'session objectives', 5000),
      framework: asNullableString(x.framework, 'session framework', 5000),
      materials: asNullableString(x.materials, 'session materials', 5000),
      activities: asNullableString(x.activities, 'session activities', 10000),
      homework: asNullableString(x.homework, 'session homework', 5000),
      standardCodes: sessionStandards,
      assessmentKeys: sessionAssessments,
      resourceKeys: sessionResources
    }
  })
  if (!sessions.length) invalid('A Course Pack needs at least one curriculum session.')
  assertUnique(
    sessions.map((session) => session.key),
    'Session keys'
  )
  assertUnique(
    sessions.map((session) => session.termKey + ':' + session.sequence),
    'Session positions'
  )

  return {
    kind: COURSE_PACK_KIND,
    version: COURSE_PACK_VERSION,
    packId: asSlug(raw.packId, 'packId'),
    revision: asNumber(raw.revision, 'revision', 1, 1000000, true),
    createdAt: asString(raw.createdAt, 'createdAt', 40),
    name: asString(raw.name, 'name', 160),
    description: asNullableString(raw.description, 'description', 5000),
    courseGroupName: asString(raw.courseGroupName, 'courseGroupName', 160),
    subject: asNullableString(raw.subject, 'subject', 120),
    terms,
    studentFields,
    standards,
    rubrics,
    assessments,
    homework,
    resources,
    sessions
  }
}

export function serializeCoursePack(pack: CoursePack): string {
  return JSON.stringify(pack, null, 2) + '\\n'
}
