import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { createTerm } from '../../repositories/terms'
import { createCourseGroup } from '../../repositories/courseGroups'
import { createClass } from '../../repositories/classes'
import { createAssessment } from '../../repositories/assessments'
import {
  createLessonPlan,
  linkLessonResource,
  updateLessonPlan
} from '../../repositories/lessonPlans'
import { createLessonResource } from '../../repositories/lessonResources'
import { getCurriculumMap } from '../curriculumMap'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-curriculum-map-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

function makeClass(
  name: string,
  termId: string,
  courseGroupId: string
): ReturnType<typeof createClass> {
  return createClass({
    name,
    subject: 'English',
    levelType: 'university',
    gradeLevel: null,
    termId,
    courseGroupId,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  })
}

describe('curriculum map', () => {
  it('aggregates a course group across terms with real delivery state and evidence links', () => {
    const term2 = createTerm({
      name: 'Term 2',
      schoolYear: '2026-27',
      startDate: '2027-02-01',
      endDate: '2027-06-30',
      sortOrder: 2
    })
    const term1 = createTerm({
      name: 'Term 1',
      schoolYear: '2026-27',
      startDate: '2026-09-01',
      endDate: '2027-01-31',
      sortOrder: 1
    })
    const group = createCourseGroup({ name: 'Applied English' })
    const class2 = makeClass('Applied English B', term2.id, group.id)
    const class1 = makeClass('Applied English A', term1.id, group.id)

    const linkedAssessment = createAssessment({
      classId: class1.id,
      categoryId: null,
      name: 'Explainer',
      description: null,
      assessmentDate: '2026-09-15',
      maxScore: 20
    })
    const unlinkedAssessment = createAssessment({
      classId: class2.id,
      categoryId: null,
      name: 'Interview',
      description: null,
      assessmentDate: '2027-03-10',
      maxScore: 20
    })
    const model = createLessonResource({
      title: 'Model explanation',
      type: 'note',
      url: null,
      filePath: null,
      notes: null,
      tags: ['model'],
      standardId: null,
      classId: null,
      shareWithStudents: false,
      studyGuide: null
    })

    const taught = createLessonPlan({
      classId: class1.id,
      date: '2026-09-08',
      weekLabel: 'Week 1',
      title: 'Explain an idea',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: linkedAssessment.id,
      standards: 'ENG-04, ENG-07',
      status: 'taught'
    })
    linkLessonResource(taught.id, model.id)

    const moved = createLessonPlan({
      classId: class1.id,
      date: '2026-09-15',
      weekLabel: 'Week 2',
      title: 'Source synthesis',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: 'ENG-02',
      status: 'planned'
    })
    updateLessonPlan(moved.id, { date: '2026-09-17' })

    createLessonPlan({
      classId: class2.id,
      date: '2027-02-08',
      weekLabel: 'Week 1',
      title: 'Meeting practice',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: 'ENG-03, ENG-06',
      status: 'skipped'
    })

    const map = getCurriculumMap('courseGroup', group.id)

    expect(map.name).toBe('Applied English')
    expect(map.sections.map((section) => section.termName)).toEqual(['Term 1', 'Term 2'])
    expect(map.lessons.map((lesson) => lesson.title)).toEqual([
      'Explain an idea',
      'Source synthesis',
      'Meeting practice'
    ])
    expect(map.lessons[0]).toMatchObject({
      status: 'taught',
      moved: false,
      assessment: { id: linkedAssessment.id, name: 'Explainer' },
      resources: [{ id: model.id, title: 'Model explanation', type: 'note' }]
    })
    expect(map.lessons[1]).toMatchObject({
      date: '2026-09-17',
      originalDate: '2026-09-15',
      moved: true,
      status: 'planned'
    })
    expect(map.unlinkedAssessments).toEqual([
      expect.objectContaining({ id: unlinkedAssessment.id, name: 'Interview' })
    ])
    expect(map.standardCoverage).toContainEqual({
      code: 'ENG-04',
      lessonCount: 1,
      taughtCount: 1,
      plannedCount: 0,
      skippedCount: 0
    })
    expect(map.standardCoverage).toContainEqual({
      code: 'ENG-03',
      lessonCount: 1,
      taughtCount: 0,
      plannedCount: 0,
      skippedCount: 1
    })
    expect(map.summary).toEqual({
      total: 3,
      planned: 1,
      taught: 1,
      skipped: 1,
      moved: 1
    })
    expect(map.nextLessonId).toBe(moved.id)
  })

  it('also supports a standalone class scope', () => {
    const term = createTerm({
      name: 'Autumn',
      schoolYear: '2026-27',
      startDate: null,
      endDate: null,
      sortOrder: 1
    })
    const cls = createClass({
      name: 'Standalone English',
      subject: 'English',
      levelType: 'university',
      gradeLevel: null,
      termId: term.id,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    createLessonPlan({
      classId: cls.id,
      date: '2026-09-09',
      weekLabel: null,
      title: 'Opening lesson',
      objectives: null,
      framework: null,
      materials: null,
      activities: null,
      homework: null,
      linkedAssessmentId: null,
      standards: null
    })

    const map = getCurriculumMap('class', cls.id)
    expect(map.scopeType).toBe('class')
    expect(map.sections).toHaveLength(1)
    expect(map.lessons).toHaveLength(1)
    expect(map.name).toBe('Standalone English')
  })
})
