import { describe, expect, it } from 'vitest'
import { AppError } from '../errorCodes'
import { parseCoursePack, serializeCoursePack } from '../coursePack'

function validPack(): Record<string, unknown> {
  return {
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
  }
}

describe('Course Pack schema', () => {
  it('parses a valid pack and normalizes optional fields', () => {
    const pack = parseCoursePack(JSON.stringify(validPack()))
    expect(pack.packId).toBe('sample-course')
    expect(pack.terms[0].sortOrder).toBe(0)
    expect(pack.sessions[0].optional).toBe(false)
    expect(pack.sessions[0].framework).toBeNull()
    expect(pack.rubrics[0].criteria[0].levels[0].description).toBeNull()
    expect(JSON.parse(serializeCoursePack(pack))).toEqual(pack)
  })

  it('rejects cross-references to unknown standards', () => {
    const raw = validPack()
    ;(raw.sessions as Record<string, unknown>[])[0].standardCodes = ['MISSING']
    expect(() => parseCoursePack(JSON.stringify(raw))).toThrowError(AppError)
    try {
      parseCoursePack(JSON.stringify(raw))
    } catch (error) {
      expect((error as AppError).code).toBe('EB-2007')
    }
  })

  it('rejects duplicate session positions inside one term', () => {
    const raw = validPack()
    ;(raw.sessions as Record<string, unknown>[]).push({
      key: 't1-02',
      termKey: 't1',
      sequence: 1,
      title: 'Duplicate position'
    })
    expect(() => parseCoursePack(JSON.stringify(raw))).toThrow(/Session positions/)
  })

  it('does not accept a School Pack as a Course Pack', () => {
    expect(() =>
      parseCoursePack(
        JSON.stringify({
          kind: 'eduboard-school-pack',
          version: 1,
          createdAt: '2026-09-29T00:00:00.000Z'
        })
      )
    ).toThrow(/Course Pack/)
  })
})
