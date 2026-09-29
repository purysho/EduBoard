import { randomUUID } from 'crypto'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS, type ClassSection } from '@shared/types'
import type { CoursePack } from '@shared/coursePack'
import { parseCoursePack } from '@shared/coursePack'
import { createClass, getClass } from '../classes'
import { listCourseGroups } from '../courseGroups'
import { listTerms } from '../terms'
import { listStandards } from '../standards'
import { listRubrics } from '../rubrics'
import { listAssessmentsByClass } from '../assessments'
import { listHomeworkAssignmentsByClass } from '../homeworkAssignments'
import {
  linkLessonResource,
  listLessonPlansByClass,
  listLessonResourceIds,
  updateLessonPlan
} from '../lessonPlans'
import { createLessonResource, listLessonResources } from '../lessonResources'
import { getSettings, updateSettings } from '../settingsRepo'
import { installCoursePack } from '../coursePacks'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-coursepack-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

function universityClass(name: string): ClassSection {
  return createClass({
    name,
    subject: 'English',
    levelType: 'university',
    gradeLevel: null,
    termId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  })
}

function samplePack(): CoursePack {
  return parseCoursePack(
    JSON.stringify({
      kind: 'eduboard-course-pack',
      version: 1,
      createdAt: '2026-09-29T00:00:00.000Z',
      id: 'sample-english',
      name: 'Sample Applied English',
      description: 'A reusable example course.',
      subject: 'English',
      terms: [
        {
          key: 't1',
          name: 'Term 1',
          schoolYear: '2026-27',
          startDate: '2026-09-07',
          endDate: '2026-12-18',
          sortOrder: 1
        }
      ],
      standards: [
        {
          key: 'communication',
          code: 'ENG-01',
          description: 'Communicate a clear message for an audience.'
        }
      ],
      rubrics: [
        {
          key: 'presentation',
          name: 'Presentation',
          criteria: [
            {
              name: 'Message',
              standardKey: 'communication',
              levels: [
                { label: 'Secure', points: 4 },
                { label: 'Developing', points: 2 }
              ]
            }
          ]
        }
      ],
      assessments: [
        {
          key: 'presentation-1',
          termKey: 't1',
          name: 'Presentation 1',
          offsetDays: 14,
          rubricKey: 'presentation'
        }
      ],
      homework: [
        {
          key: 'reflection-1',
          termKey: 't1',
          title: 'Reflection 1',
          dueOffsetDays: 15,
          status: 'draft'
        }
      ],
      lessons: [
        {
          key: 'session-1',
          termKey: 't1',
          title: 'Explain an idea clearly',
          offsetDays: 0,
          objectives: 'Explain one idea clearly for a non-specialist audience.',
          assessmentKey: 'presentation-1',
          standardKeys: ['communication'],
          resourceKeys: ['model-explanation']
        }
      ],
      resources: [
        {
          key: 'model-explanation',
          title: 'Model explanation',
          type: 'note',
          notes: 'A teacher model for clear explanation.',
          tags: ['speaking', 'model'],
          standardKey: 'communication'
        }
      ],
      studentFields: [{ id: 'english-goal', label: 'English goal' }]
    })
  )
}

describe('Course Packs', () => {
  it('validates cross-references instead of silently accepting broken pack data', () => {
    const raw = JSON.parse(JSON.stringify(samplePack()))
    raw.lessons[0].standardKeys = ['does-not-exist']
    expect(() => parseCoursePack(JSON.stringify(raw))).toThrow(/unknown standard key/i)
  })

  it('rejects a lesson linked to an unknown resource', () => {
    const raw = JSON.parse(JSON.stringify(samplePack()))
    raw.lessons[0].resourceKeys = ['does-not-exist']
    expect(() => parseCoursePack(JSON.stringify(raw))).toThrow(/unknown resource key/i)
  })

  it('rejects a resource linked to an unknown standard', () => {
    const raw = JSON.parse(JSON.stringify(samplePack()))
    raw.resources[0].standardKey = 'does-not-exist'
    expect(() => parseCoursePack(JSON.stringify(raw))).toThrow(/unknown standard key/i)
  })

  it('rejects duplicate student-field ids', () => {
    const raw = JSON.parse(JSON.stringify(samplePack()))
    raw.studentFields.push({ id: 'english-goal', label: 'Duplicate' })
    expect(() => parseCoursePack(JSON.stringify(raw))).toThrow(/duplicate student field id/i)
  })

  it('installs a pack transactionally into an explicitly mapped class', () => {
    const cls = universityClass('University English A')
    const result = installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })

    expect(result.created).toMatchObject({
      courseGroups: 1,
      terms: 1,
      standards: 1,
      rubrics: 1,
      resources: 1,
      studentFields: 1,
      assessments: 1,
      homework: 1,
      lessons: 1
    })
    expect(listCourseGroups()).toHaveLength(1)
    expect(listTerms()).toHaveLength(1)
    expect(listStandards().map((s) => s.code)).toEqual(['ENG-01'])
    expect(listRubrics()).toHaveLength(1)
    expect(listLessonResources()[0]).toMatchObject({
      title: 'Model explanation',
      type: 'note',
      tags: ['speaking', 'model']
    })
    expect(getSettings().studentFields).toContainEqual({ id: 'english-goal', label: 'English goal' })
    expect(listAssessmentsByClass(cls.id)[0]).toMatchObject({
      name: 'Presentation 1',
      assessmentDate: '2026-09-21'
    })
    expect(listHomeworkAssignmentsByClass(cls.id)[0]).toMatchObject({
      title: 'Reflection 1',
      dueDate: '2026-09-22',
      status: 'draft'
    })
    const installedLesson = listLessonPlansByClass(cls.id)[0]
    expect(installedLesson).toMatchObject({
      title: 'Explain an idea clearly',
      date: '2026-09-07',
      originalDate: '2026-09-07',
      standards: 'ENG-01'
    })
    expect(listLessonResourceIds(installedLesson.id)).toEqual([listLessonResources()[0].id])

    const updatedClass = getClass(cls.id)!
    expect(updatedClass.courseGroupId).toBe(result.courseGroupId)
    expect(updatedClass.termId).toBe(result.termIds.t1)
  })

  it('anchors relative dates to the actual first class date when supplied', () => {
    const cls = universityClass('University English Tuesday')
    installCoursePack({
      pack: samplePack(),
      termBindings: { t1: cls.id },
      firstClassDates: { t1: '2026-09-08' }
    })

    expect(listLessonPlansByClass(cls.id)[0]).toMatchObject({
      date: '2026-09-08',
      originalDate: '2026-09-08'
    })
    expect(listAssessmentsByClass(cls.id)[0].assessmentDate).toBe('2026-09-22')
    expect(listHomeworkAssignmentsByClass(cls.id)[0].dueDate).toBe('2026-09-23')
  })

  it('is duplicate-safe when the same pack is imported again', () => {
    const cls = universityClass('University English A')
    installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })
    const second = installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })

    expect(second.created).toMatchObject({
      courseGroups: 0,
      terms: 0,
      standards: 0,
      rubrics: 0,
      resources: 0,
      studentFields: 0,
      assessments: 0,
      homework: 0,
      lessons: 0
    })
    expect(second.reused).toMatchObject({
      courseGroups: 1,
      terms: 1,
      standards: 1,
      rubrics: 1,
      resources: 1,
      studentFields: 1,
      assessments: 1,
      homework: 1,
      lessons: 1
    })
    expect(listCourseGroups()).toHaveLength(1)
    expect(listStandards()).toHaveLength(1)
    expect(listAssessmentsByClass(cls.id)).toHaveLength(1)
    expect(listLessonResources().filter((r) => r.title === 'Model explanation')).toHaveLength(1)
    expect(getSettings().studentFields.filter((field) => field.id === 'english-goal')).toHaveLength(1)
    expect(listHomeworkAssignmentsByClass(cls.id)).toHaveLength(1)
    const lesson = listLessonPlansByClass(cls.id)[0]
    expect(listLessonPlansByClass(cls.id)).toHaveLength(1)
    expect(listLessonResourceIds(lesson.id)).toHaveLength(1)

    // A local teacher link survives Course Pack re-import; the pack only adds its own
    // missing links and never replaces the lesson's whole resource set.
    const packResource = listLessonResources().find((item) => item.title === 'Model explanation')!
    const local = createLessonResource({
      title: 'Teacher local note',
      type: 'note',
      url: null,
      filePath: null,
      notes: 'Added after the pack import.',
      tags: ['local'],
      standardId: null,
      classId: cls.id,
      shareWithStudents: false,
      studyGuide: null
    })
    linkLessonResource(lesson.id, local.id)
    installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })
    expect(new Set(listLessonResourceIds(lesson.id))).toEqual(new Set([packResource.id, local.id]))
  })

  it('reuses an imported lesson after the teacher moves it', () => {
    const cls = universityClass('University English moved lesson')
    installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })

    const lesson = listLessonPlansByClass(cls.id)[0]
    updateLessonPlan(lesson.id, { date: '2026-09-09' })

    const second = installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })
    const lessons = listLessonPlansByClass(cls.id)

    expect(second.created.lessons).toBe(0)
    expect(second.reused.lessons).toBe(1)
    expect(lessons).toHaveLength(1)
    expect(lessons[0]).toMatchObject({
      id: lesson.id,
      date: '2026-09-09',
      originalDate: '2026-09-07'
    })
  })

  it('installs and re-imports the real JUST 2026–27 pack without duplication', () => {
    const pack = parseCoursePack(
      readFileSync(
        join(process.cwd(), 'course-packs', 'just-applied-english-2026-27.coursepack.json'),
        'utf8'
      )
    )
    const t1 = universityClass('JUST Applied English — Term 1')
    const t2 = universityClass('JUST Applied English — Term 2')
    const input = {
      pack,
      termBindings: { t1: t1.id, t2: t2.id },
      firstClassDates: { t1: '2026-09-07', t2: '2027-02-22' }
    }

    const first = installCoursePack(input)
    expect(first.created).toMatchObject({
      courseGroups: 1,
      terms: 2,
      standards: 9,
      rubrics: 5,
      resources: 40,
      studentFields: 9,
      assessments: 10,
      homework: 0,
      lessons: 34
    })
    expect(listLessonPlansByClass(t1.id)).toHaveLength(15)
    expect(listLessonPlansByClass(t2.id)).toHaveLength(19)
    expect(listAssessmentsByClass(t1.id)).toHaveLength(5)
    expect(listAssessmentsByClass(t2.id)).toHaveLength(5)
    expect(listStandards().map((standard) => standard.code)).toEqual([
      'UENG-01',
      'UENG-02',
      'UENG-03',
      'UENG-04',
      'UENG-05',
      'UENG-06',
      'UENG-07',
      'UENG-08',
      'UENG-09'
    ])

    const second = installCoursePack(input)
    expect(second.created).toMatchObject({
      courseGroups: 0,
      terms: 0,
      standards: 0,
      rubrics: 0,
      resources: 0,
      studentFields: 0,
      assessments: 0,
      homework: 0,
      lessons: 0
    })
    expect(second.reused).toMatchObject({
      courseGroups: 1,
      terms: 2,
      standards: 9,
      rubrics: 5,
      resources: 40,
      studentFields: 9,
      assessments: 10,
      homework: 0,
      lessons: 34
    })
    expect(listLessonPlansByClass(t1.id)).toHaveLength(15)
    expect(listLessonPlansByClass(t2.id)).toHaveLength(19)
    expect(listLessonResources()).toHaveLength(40)
  })

  it('rolls the whole install back if materialisation fails', () => {
    const cls = universityClass('University English A')
    const pack = samplePack()
    pack.terms[0].startDate = null

    expect(() => installCoursePack({ pack, termBindings: { t1: cls.id } })).toThrow(
      /needs a first class date/i
    )
    expect(listCourseGroups()).toHaveLength(0)
    expect(listTerms()).toHaveLength(0)
    expect(listStandards()).toHaveLength(0)
    expect(listRubrics()).toHaveLength(0)
    expect(listAssessmentsByClass(cls.id)).toHaveLength(0)
    expect(getClass(cls.id)?.courseGroupId).toBeNull()
    expect(getClass(cls.id)?.termId).toBeNull()
  })

  it('rolls back the whole install when a student field conflicts with local meaning', () => {
    const cls = universityClass('University English A')
    updateSettings({ studentFields: [{ id: 'english-goal', label: 'Different local meaning' }] })

    expect(() => installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })).toThrow(
      /student field/i
    )
    expect(listCourseGroups()).toHaveLength(0)
    expect(listTerms()).toHaveLength(0)
    expect(listStandards()).toHaveLength(0)
    expect(listRubrics()).toHaveLength(0)
    expect(listLessonResources()).toHaveLength(0)
    expect(getClass(cls.id)?.courseGroupId).toBeNull()
  })

  it('rejects mapping two required terms onto the same class', () => {
    const cls = universityClass('One class cannot represent two terms')
    const pack = samplePack()
    pack.terms.push({
      key: 't2',
      name: 'Term 2',
      schoolYear: '2026-27',
      startDate: '2027-02-01',
      endDate: '2027-06-30',
      sortOrder: 2
    })
    pack.lessons!.push({
      key: 'session-2',
      termKey: 't2',
      title: 'Second term lesson',
      offsetDays: 0,
      standardKeys: ['communication']
    })

    expect(() =>
      installCoursePack({
        pack,
        termBindings: { t1: cls.id, t2: cls.id }
      })
    ).toThrow(/different EduBoard class/i)
    expect(listCourseGroups()).toHaveLength(0)
    expect(getClass(cls.id)?.courseGroupId).toBeNull()
  })

  it('never applies class-bound curriculum without an explicit class mapping', () => {
    universityClass('Unrelated primary class')
    expect(() => installCoursePack({ pack: samplePack(), termBindings: {} })).toThrow(
      /choose an EduBoard class/i
    )
    expect(listCourseGroups()).toHaveLength(0)
  })
})
