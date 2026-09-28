import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import {
  exportCoursePack,
  importCoursePack,
  listCoursePacks,
  listCurriculumSessions,
  removeCoursePack
} from '../coursePacks'
import { listCourseGroups } from '../courseGroups'
import { listTerms } from '../terms'
import { createStandard, listStandards } from '../standards'
import { listRubrics } from '../rubrics'
import { listLessonResources } from '../lessonResources'
import { getSettings } from '../settingsRepo'
import { AppError } from '@shared/errorCodes'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-course-pack-'))
  setDbPathForTesting(join(tempDir, randomUUID() + '.db'))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

function packJson(): string {
  return JSON.stringify({
    kind: 'eduboard-course-pack',
    version: 1,
    packId: 'sample-course',
    revision: 1,
    createdAt: '2026-09-29T00:00:00.000Z',
    name: 'Sample Applied English',
    description: 'A reusable test curriculum.',
    courseGroupName: 'Applied English',
    subject: 'English',
    terms: [
      {
        key: 't1',
        name: 'Term 1',
        schoolYear: '2026-27',
        startDate: '2026-09-01',
        endDate: '2027-01-15'
      }
    ],
    studentFields: [{ id: 'pathway', label: 'Pathway' }],
    standards: [
      {
        code: 'ENG-01',
        description: 'Communicate clearly for a defined purpose.',
        subject: 'English'
      }
    ],
    rubrics: [
      {
        key: 'presentation',
        name: 'Presentation rubric',
        criteria: [
          {
            name: 'Message',
            standardCode: 'ENG-01',
            levels: [
              { label: 'Secure', points: 3 },
              { label: 'Developing', points: 2 }
            ]
          }
        ]
      }
    ],
    assessments: [
      {
        key: 'baseline',
        termKey: 't1',
        name: 'Baseline',
        maxScore: 10,
        rubricKey: 'presentation'
      }
    ],
    homework: [
      {
        key: 'reflection-1',
        termKey: 't1',
        title: 'Reflection',
        topic: 'Week 1'
      }
    ],
    resources: [
      {
        key: 'model-1',
        title: 'Model explanation',
        type: 'note',
        notes: 'Teacher-created model.',
        tags: ['T1', 'model'],
        standardCode: 'ENG-01',
        termKeys: ['t1']
      }
    ],
    sessions: [
      {
        key: 't1-01',
        termKey: 't1',
        sequence: 1,
        title: 'Where am I now?',
        durationMinutes: 90,
        objectives: 'Establish a baseline.',
        standardCodes: ['ENG-01'],
        assessmentKeys: ['baseline'],
        resourceKeys: ['model-1']
      }
    ]
  })
}

describe('Course Pack import', () => {
  it('imports the reusable curriculum layer into a real SQLite database', () => {
    const result = importCoursePack(packJson())

    expect(result.alreadyImported).toBe(false)
    expect(result.created).toEqual({
      courseGroup: true,
      terms: 1,
      standards: 1,
      rubrics: 1,
      resources: 1,
      studentFields: 1,
      sessions: 1
    })

    expect(listCourseGroups().map((x) => x.name)).toContain('Applied English')
    expect(listTerms().map((x) => x.name)).toContain('Term 1')
    expect(listStandards().map((x) => x.code)).toContain('ENG-01')
    expect(listRubrics().map((x) => x.name)).toContain('Presentation rubric')
    expect(listLessonResources()[0].tags).toEqual(['T1', 'model'])
    expect(getSettings().studentFields.some((x) => x.id === 'pathway')).toBe(true)

    const sessions = listCurriculumSessions(result.pack.id)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].title).toBe('Where am I now?')
    expect(sessions[0].standardCodes).toEqual(['ENG-01'])

    const exported = JSON.parse(exportCoursePack(result.pack.id))
    expect(exported.packId).toBe('sample-course')
    expect(exported.assessments[0].key).toBe('baseline')
  })

  it('is duplicate-safe when the same pack revision is imported twice', () => {
    const first = importCoursePack(packJson())
    const second = importCoursePack(packJson())

    expect(second.alreadyImported).toBe(true)
    expect(second.pack.id).toBe(first.pack.id)
    expect(listCoursePacks()).toHaveLength(1)
    expect(listStandards().filter((x) => x.code === 'ENG-01')).toHaveLength(1)
    expect(listRubrics().filter((x) => x.name === 'Presentation rubric')).toHaveLength(1)
    expect(listLessonResources().filter((x) => x.title === 'Model explanation')).toHaveLength(1)
  })

  it('stops on a conflicting standard before creating partial curriculum data', () => {
    createStandard({
      code: 'ENG-01',
      description: 'A different meaning already used by the teacher.',
      subject: 'English'
    })

    expect(() => importCoursePack(packJson())).toThrowError(AppError)
    expect(listCoursePacks()).toHaveLength(0)
    expect(listCourseGroups().map((x) => x.name)).not.toContain('Applied English')
    expect(listRubrics()).toHaveLength(0)
    expect(listLessonResources()).toHaveLength(0)
  })

  it('removes only the pack curriculum layer, leaving reusable library items alone', () => {
    const imported = importCoursePack(packJson())
    removeCoursePack(imported.pack.id)

    expect(listCoursePacks()).toHaveLength(0)
    expect(listCurriculumSessions(imported.pack.id)).toHaveLength(0)
    expect(listStandards().map((x) => x.code)).toContain('ENG-01')
    expect(listRubrics().map((x) => x.name)).toContain('Presentation rubric')
    expect(listLessonResources().map((x) => x.title)).toContain('Model explanation')
  })
})
