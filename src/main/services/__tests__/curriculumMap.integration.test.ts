import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'
import { createCourseGroup } from '../../repositories/courseGroups'
import { createTerm } from '../../repositories/terms'
import { createClass } from '../../repositories/classes'
import { createStandard } from '../../repositories/standards'
import { createAssessment } from '../../repositories/assessments'
import { createLessonPlan } from '../../repositories/lessonPlans'
import { createLessonResource } from '../../repositories/lessonResources'
import { getCurriculumMap } from '../curriculumMap'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-curriculum-map-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

describe('curriculum map', () => {
  it('combines a course group sequence with standards, assessment links and standard-linked resources', () => {
    const group = createCourseGroup({ name: 'Applied Communication' })
    const term = createTerm({
      name: 'Term 1',
      schoolYear: '2026-27',
      startDate: '2026-09-07',
      endDate: '2026-12-18',
      sortOrder: 1
    })
    const cls = createClass({
      name: 'English A',
      subject: 'English',
      levelType: 'university',
      gradeLevel: null,
      termId: term.id,
      courseGroupId: group.id,
      termWeight: 1,
      minAttendance: null,
      schedule: null,
      room: null,
      color: null,
      passMark: 60,
      maxScore: 100,
      gradeThresholds: DEFAULT_GRADE_THRESHOLDS
    })
    const standard = createStandard({
      code: 'ENG-01',
      description: 'Explain an idea clearly.',
      subject: 'English'
    })
    const assessment = createAssessment({
      classId: cls.id,
      categoryId: null,
      rubricId: null,
      name: 'Explainer',
      description: null,
      assessmentDate: '2026-09-21',
      maxScore: 100
    })
    createLessonResource({
      title: 'Explainer model',
      type: 'note',
      url: null,
      filePath: null,
      notes: 'A short model.',
      tags: ['model'],
      standardId: standard.id,
      classId: null,
      shareWithStudents: false,
      studyGuide: null
    })
    createLessonResource({
      title: 'Unrelated source',
      type: 'note',
      url: null,
      filePath: null,
      notes: null,
      tags: [],
      standardId: null,
      classId: null,
      shareWithStudents: false,
      studyGuide: null
    })
    createLessonPlan({
      classId: cls.id,
      date: '2026-09-07',
      weekLabel: 'Week 1',
      title: 'Explain clearly',
      objectives: 'Explain one idea.',
      framework: null,
      materials: 'Teacher model',
      activities: null,
      homework: null,
      linkedAssessmentId: assessment.id,
      standards: 'ENG-01'
    })

    const map = getCurriculumMap(group.id)

    expect(map?.courseGroupName).toBe('Applied Communication')
    expect(map?.classes).toHaveLength(1)
    expect(map?.classes[0]).toMatchObject({
      className: 'English A',
      termName: 'Term 1'
    })
    expect(map?.classes[0].lessons[0]).toMatchObject({
      title: 'Explain clearly',
      standardCodes: ['ENG-01'],
      linkedAssessment: { id: assessment.id, name: 'Explainer' },
      resources: [{ title: 'Explainer model', type: 'note' }]
    })
  })

  it('returns null for an unknown course group rather than inventing a map', () => {
    expect(getCurriculumMap('missing')).toBeNull()
  })
})
