import { LESSON_RESOURCE_TYPES, type HomeworkAssignmentStatus, type LessonResourceType, type StudentField } from './types'

export interface CoursePackTerm {
  key: string
  name: string
  schoolYear: string
  startDate: string | null
  endDate: string | null
  sortOrder?: number
}

export interface CoursePackStandard {
  key: string
  code: string
  description: string
  subject?: string | null
}

export interface CoursePackRubric {
  key: string
  name: string
  description?: string | null
  criteria: {
    name: string
    description?: string | null
    standardKey?: string | null
    levels: { label: string; points: number; description?: string | null }[]
  }[]
}

export interface CoursePackAssessmentTemplate {
  key: string
  termKey: string
  name: string
  description?: string | null
  offsetDays?: number | null
  maxScore?: number
  isFinal?: boolean
  sortOrder?: number
  rubricKey?: string | null
}

export interface CoursePackHomeworkTemplate {
  key: string
  termKey: string
  title: string
  description?: string | null
  dueOffsetDays?: number | null
  topic?: string | null
  status?: HomeworkAssignmentStatus
  rubricKey?: string | null
}

export interface CoursePackLessonTemplate {
  key: string
  termKey: string
  title: string
  offsetDays: number
  weekLabel?: string | null
  objectives?: string | null
  framework?: string | null
  materials?: string | null
  activities?: string | null
  homework?: string | null
  assessmentKey?: string | null
  standardKeys?: string[]
}

export interface CoursePackResourceTemplate {
  key: string
  title: string
  type: LessonResourceType
  url?: string | null
  notes?: string | null
  tags?: string[]
  standardKey?: string | null
}

export type CoursePackStudentField = StudentField

export interface CoursePackItemCounts {
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

export interface CoursePackInstallSummary {
  courseGroupId: string
  termIds: Record<string, string>
  standardIds: Record<string, string>
  rubricIds: Record<string, string>
  assessmentIds: Record<string, string>
  resourceIds: Record<string, string>
  created: CoursePackItemCounts
  reused: CoursePackItemCounts
}

export interface CoursePackPreview {
  filePath: string
  id: string
  name: string
  description?: string | null
  subject?: string | null
  terms: CoursePackTerm[]
  counts: Omit<CoursePackItemCounts, 'courseGroups' | 'terms'>
}

export interface CoursePack {
  kind: 'eduboard-course-pack'
  version: 1
  createdAt: string
  id: string
  name: string
  description?: string | null
  subject?: string | null
  terms: CoursePackTerm[]
  standards?: CoursePackStandard[]
  rubrics?: CoursePackRubric[]
  assessments?: CoursePackAssessmentTemplate[]
  homework?: CoursePackHomeworkTemplate[]
  lessons?: CoursePackLessonTemplate[]
  resources?: CoursePackResourceTemplate[]
  studentFields?: CoursePackStudentField[]
}

const MAX_ITEMS = 500
const keyPattern = /^[a-z0-9][a-z0-9._:-]{0,63}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/

function requiredString(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`Invalid course pack: ${label}`)
  }
  return value.trim()
}

function optionalString(value: unknown, label: string, max = 5000): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string' || value.length > max) {
    throw new Error(`Invalid course pack: ${label}`)
  }
  return value
}

function key(value: unknown, label: string): string {
  const out = requiredString(value, label, 64)
  if (!keyPattern.test(out)) throw new Error(`Invalid course pack: ${label}`)
  return out
}

function date(value: unknown, label: string): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || !datePattern.test(value)) {
    throw new Error(`Invalid course pack: ${label}`)
  }
  return value
}

function integer(value: unknown, label: string, fallback?: number): number | undefined {
  if (value === undefined && fallback !== undefined) return fallback
  if (value === undefined) return undefined
  if (!Number.isInteger(value) || Math.abs(Number(value)) > 10_000) {
    throw new Error(`Invalid course pack: ${label}`)
  }
  return Number(value)
}

function number(value: unknown, label: string, fallback?: number): number | undefined {
  if (value === undefined && fallback !== undefined) return fallback
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 10_000) {
    throw new Error(`Invalid course pack: ${label}`)
  }
  return value
}

function array(value: unknown, label: string): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_ITEMS) {
    throw new Error(`Invalid course pack: ${label}`)
  }
  return value
}

function uniqueKeys<T extends { key: string }>(items: T[], label: string): void {
  const seen = new Set<string>()
  for (const item of items) {
    const normalized = item.key.toLowerCase()
    if (seen.has(normalized)) throw new Error(`Invalid course pack: duplicate ${label} key ${item.key}`)
    seen.add(normalized)
  }
}

export function parseCoursePack(json: string): CoursePack {
  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Invalid course pack: unreadable JSON')
  }
  if (!raw || raw.kind !== 'eduboard-course-pack' || raw.version !== 1) {
    throw new Error('Invalid course pack: unsupported kind or version')
  }

  const terms = array(raw.terms, 'terms').map((item, index): CoursePackTerm => {
    const x = item as Record<string, unknown>
    return {
      key: key(x?.key, `terms[${index}].key`),
      name: requiredString(x?.name, `terms[${index}].name`, 120),
      schoolYear: requiredString(x?.schoolYear, `terms[${index}].schoolYear`, 40),
      startDate: date(x?.startDate ?? null, `terms[${index}].startDate`),
      endDate: date(x?.endDate ?? null, `terms[${index}].endDate`),
      sortOrder: integer(x?.sortOrder, `terms[${index}].sortOrder`)
    }
  })
  if (!terms.length) throw new Error('Invalid course pack: at least one term is required')
  uniqueKeys(terms, 'term')

  const standards = array(raw.standards, 'standards').map((item, index): CoursePackStandard => {
    const x = item as Record<string, unknown>
    return {
      key: key(x?.key, `standards[${index}].key`),
      code: requiredString(x?.code, `standards[${index}].code`, 80),
      description: requiredString(x?.description, `standards[${index}].description`, 1000),
      subject: optionalString(x?.subject, `standards[${index}].subject`, 120)
    }
  })
  uniqueKeys(standards, 'standard')

  const standardKeys = new Set(standards.map((s) => s.key.toLowerCase()))
  const rubrics = array(raw.rubrics, 'rubrics').map((item, index): CoursePackRubric => {
    const x = item as Record<string, unknown>
    const criteria = array(x?.criteria, `rubrics[${index}].criteria`).map((criterion, ci) => {
      const c = criterion as Record<string, unknown>
      const standardKey =
        c?.standardKey === undefined || c?.standardKey === null
          ? null
          : key(c.standardKey, `rubrics[${index}].criteria[${ci}].standardKey`)
      if (standardKey && !standardKeys.has(standardKey.toLowerCase())) {
        throw new Error(`Invalid course pack: unknown standard key ${standardKey}`)
      }
      const levels = array(c?.levels, `rubrics[${index}].criteria[${ci}].levels`).map(
        (level, li) => {
          const l = level as Record<string, unknown>
          return {
            label: requiredString(l?.label, `rubrics[${index}].criteria[${ci}].levels[${li}].label`, 80),
            points: number(l?.points, `rubrics[${index}].criteria[${ci}].levels[${li}].points`, 0)!,
            description: optionalString(
              l?.description,
              `rubrics[${index}].criteria[${ci}].levels[${li}].description`,
              1000
            )
          }
        }
      )
      if (!levels.length) throw new Error(`Invalid course pack: rubric criterion ${ci + 1} has no levels`)
      return {
        name: requiredString(c?.name, `rubrics[${index}].criteria[${ci}].name`, 120),
        description: optionalString(c?.description, `rubrics[${index}].criteria[${ci}].description`, 1000),
        standardKey,
        levels
      }
    })
    if (!criteria.length) throw new Error(`Invalid course pack: rubric ${index + 1} has no criteria`)
    return {
      key: key(x?.key, `rubrics[${index}].key`),
      name: requiredString(x?.name, `rubrics[${index}].name`, 120),
      description: optionalString(x?.description, `rubrics[${index}].description`, 1000),
      criteria
    }
  })
  uniqueKeys(rubrics, 'rubric')
  const rubricKeys = new Set(rubrics.map((r) => r.key.toLowerCase()))
  const termKeys = new Set(terms.map((t) => t.key.toLowerCase()))

  const checkTermKey = (value: unknown, label: string): string => {
    const out = key(value, label)
    if (!termKeys.has(out.toLowerCase())) throw new Error(`Invalid course pack: unknown term key ${out}`)
    return out
  }
  const checkRubricKey = (value: unknown, label: string): string | null => {
    if (value === undefined || value === null) return null
    const out = key(value, label)
    if (!rubricKeys.has(out.toLowerCase())) throw new Error(`Invalid course pack: unknown rubric key ${out}`)
    return out
  }

  const assessments = array(raw.assessments, 'assessments').map(
    (item, index): CoursePackAssessmentTemplate => {
      const x = item as Record<string, unknown>
      return {
        key: key(x?.key, `assessments[${index}].key`),
        termKey: checkTermKey(x?.termKey, `assessments[${index}].termKey`),
        name: requiredString(x?.name, `assessments[${index}].name`, 160),
        description: optionalString(x?.description, `assessments[${index}].description`, 3000),
        offsetDays:
          x?.offsetDays === null ? null : integer(x?.offsetDays, `assessments[${index}].offsetDays`),
        maxScore: number(x?.maxScore, `assessments[${index}].maxScore`),
        isFinal: x?.isFinal === true,
        sortOrder: integer(x?.sortOrder, `assessments[${index}].sortOrder`),
        rubricKey: checkRubricKey(x?.rubricKey, `assessments[${index}].rubricKey`)
      }
    }
  )
  uniqueKeys(assessments, 'assessment')
  const assessmentKeys = new Set(assessments.map((a) => a.key.toLowerCase()))

  const homework = array(raw.homework, 'homework').map(
    (item, index): CoursePackHomeworkTemplate => {
      const x = item as Record<string, unknown>
      const status = x?.status === undefined ? 'draft' : x.status
      if (status !== 'draft' && status !== 'published') {
        throw new Error(`Invalid course pack: homework[${index}].status`)
      }
      return {
        key: key(x?.key, `homework[${index}].key`),
        termKey: checkTermKey(x?.termKey, `homework[${index}].termKey`),
        title: requiredString(x?.title, `homework[${index}].title`, 160),
        description: optionalString(x?.description, `homework[${index}].description`, 5000),
        dueOffsetDays:
          x?.dueOffsetDays === null ? null : integer(x?.dueOffsetDays, `homework[${index}].dueOffsetDays`),
        topic: optionalString(x?.topic, `homework[${index}].topic`, 160),
        status,
        rubricKey: checkRubricKey(x?.rubricKey, `homework[${index}].rubricKey`)
      }
    }
  )
  uniqueKeys(homework, 'homework')

  const resources = array(raw.resources, 'resources').map(
    (item, index): CoursePackResourceTemplate => {
      const x = item as Record<string, unknown>
      const type = requiredString(x?.type, `resources[${index}].type`, 20) as LessonResourceType
      if (!(LESSON_RESOURCE_TYPES as readonly string[]).includes(type)) {
        throw new Error(`Invalid course pack: resources[${index}].type`)
      }
      const standardKey =
        x?.standardKey === undefined || x?.standardKey === null
          ? null
          : key(x.standardKey, `resources[${index}].standardKey`)
      if (standardKey && !standardKeys.has(standardKey.toLowerCase())) {
        throw new Error(`Invalid course pack: unknown standard key ${standardKey}`)
      }
      const tags = array(x?.tags, `resources[${index}].tags`).map((tag, ti) =>
        requiredString(tag, `resources[${index}].tags[${ti}]`, 80)
      )
      return {
        key: key(x?.key, `resources[${index}].key`),
        title: requiredString(x?.title, `resources[${index}].title`, 160),
        type,
        url: optionalString(x?.url, `resources[${index}].url`, 2000),
        notes: optionalString(x?.notes, `resources[${index}].notes`, 5000),
        tags,
        standardKey
      }
    }
  )
  uniqueKeys(resources, 'resource')

  const studentFields = array(raw.studentFields, 'studentFields').map(
    (item, index): CoursePackStudentField => {
      const x = item as Record<string, unknown>
      return {
        id: key(x?.id, `studentFields[${index}].id`),
        label: requiredString(x?.label, `studentFields[${index}].label`, 80),
        ...(x?.onSeatingChart === true ? { onSeatingChart: true } : {})
      }
    }
  )
  const seenStudentFields = new Set<string>()
  for (const field of studentFields) {
    const normalized = field.id.toLowerCase()
    if (seenStudentFields.has(normalized)) {
      throw new Error(`Invalid course pack: duplicate student field id ${field.id}`)
    }
    seenStudentFields.add(normalized)
  }

  const lessons = array(raw.lessons, 'lessons').map((item, index): CoursePackLessonTemplate => {
    const x = item as Record<string, unknown>
    const standardKeysForLesson = array(x?.standardKeys, `lessons[${index}].standardKeys`).map(
      (v, si) => {
        const out = key(v, `lessons[${index}].standardKeys[${si}]`)
        if (!standardKeys.has(out.toLowerCase())) {
          throw new Error(`Invalid course pack: unknown standard key ${out}`)
        }
        return out
      }
    )
    const assessmentKey =
      x?.assessmentKey === undefined || x?.assessmentKey === null
        ? null
        : key(x.assessmentKey, `lessons[${index}].assessmentKey`)
    if (assessmentKey && !assessmentKeys.has(assessmentKey.toLowerCase())) {
      throw new Error(`Invalid course pack: unknown assessment key ${assessmentKey}`)
    }
    return {
      key: key(x?.key, `lessons[${index}].key`),
      termKey: checkTermKey(x?.termKey, `lessons[${index}].termKey`),
      title: requiredString(x?.title, `lessons[${index}].title`, 160),
      offsetDays: integer(x?.offsetDays, `lessons[${index}].offsetDays`, 0)!,
      weekLabel: optionalString(x?.weekLabel, `lessons[${index}].weekLabel`, 80),
      objectives: optionalString(x?.objectives, `lessons[${index}].objectives`),
      framework: optionalString(x?.framework, `lessons[${index}].framework`),
      materials: optionalString(x?.materials, `lessons[${index}].materials`),
      activities: optionalString(x?.activities, `lessons[${index}].activities`),
      homework: optionalString(x?.homework, `lessons[${index}].homework`),
      assessmentKey,
      standardKeys: standardKeysForLesson
    }
  })
  uniqueKeys(lessons, 'lesson')

  return {
    kind: 'eduboard-course-pack',
    version: 1,
    createdAt: requiredString(raw.createdAt, 'createdAt', 40),
    id: key(raw.id, 'id'),
    name: requiredString(raw.name, 'name', 160),
    description: optionalString(raw.description, 'description', 5000),
    subject: optionalString(raw.subject, 'subject', 160),
    terms,
    standards,
    rubrics,
    assessments,
    homework,
    lessons,
    resources,
    studentFields
  }
}
