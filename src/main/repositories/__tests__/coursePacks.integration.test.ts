import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
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
import { listLessonPlansByClass } from '../lessonPlans'
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
          standardKeys: ['communication']
        }
      ]
    })
  )
}

describe('Course Packs', () => {
  it('validates cross-references instead of silently accepting broken pack data', () => {
    const raw = JSON.parse(JSON.stringify(samplePack()))
    raw.lessons[0].standardKeys = ['does-not-exist']
    expect(() => parseCoursePack(JSON.stringify(raw))).toThrow(/unknown standard key/i)
  })

  it('installs a pack transactionally into an explicitly mapped class', () => {
    const cls = universityClass('University English A')
    const result = installCoursePack({ pack: samplePack(), termBindings: { t1: cls.id } })

    expect(result.created).toMatchObject({
      courseGroups: 1,
      terms: 1,
      standards: 1,
      rubrics: 1,
      assessments: 1,
      homework: 1,
      lessons: 1
    })
    expect(listCourseGroups()).toHaveLength(1)
    expect(listTerms()).toHaveLength(1)
    expect(listStandards().map((s) => s.code)).toEqual(['ENG-01'])
    expect(listRubrics()).toHaveLength(1)
    expect(listAssessmentsByClass(cls.id)[0]).toMatchObject({
      name: 'Presentation 1',
      assessmentDate: '2026-09-21'
    })
    expect(listHomeworkAssignmentsByClass(cls.id)[0]).toMatchObject({
      title: 'Reflection 1',
      dueDate: '2026-09-22',
      status: 'draft'
    })
    expect(listLessonPlansByClass(cls.id)[0]).toMatchObject({
      title: 'Explain an idea clearly',
      date: '2026-09-07',
      standards: 'ENG-01'
    })

    const updatedClass = getClass(cls.id)!
    expect(updatedClass.courseGroupId).toBe(result.courseGroupId)
    expect(updatedClass.termId).toBe(result.termIds.t1)
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
      assessments: 0,
      homework: 0,
      lessons: 0
    })
    expect(second.reused).toMatchObject({
      courseGroups: 1,
      terms: 1,
      standards: 1,
      rubrics: 1,
      assessments: 1,
      homework: 1,
      lessons: 1
    })
    expect(listCourseGroups()).toHaveLength(1)
    expect(listStandards()).toHaveLength(1)
    expect(listAssessmentsByClass(cls.id)).toHaveLength(1)
    expect(listHomeworkAssignmentsByClass(cls.id)).toHaveLength(1)
    expect(listLessonPlansByClass(cls.id)).toHaveLength(1)
  })

  it('rolls the whole install back if materialisation fails', () => {
    const cls = universityClass('University English A')
    const pack = samplePack()
    pack.terms[0].startDate = null

    expect(() => installCoursePack({ pack, termBindings: { t1: cls.id } })).toThrow(
      /needs a start date/i
    )
    expect(listCourseGroups()).toHaveLength(0)
    expect(listTerms()).toHaveLength(0)
    expect(listStandards()).toHaveLength(0)
    expect(listRubrics()).toHaveLength(0)
    expect(listAssessmentsByClass(cls.id)).toHaveLength(0)
    expect(getClass(cls.id)?.courseGroupId).toBeNull()
    expect(getClass(cls.id)?.termId).toBeNull()
  })

  it('never applies class-bound curriculum without an explicit class mapping', () => {
    universityClass('Unrelated primary class')
    expect(() => installCoursePack({ pack: samplePack(), termBindings: {} })).toThrow(
      /choose an EduBoard class/i
    )
    expect(listCourseGroups()).toHaveLength(0)
  })
})
