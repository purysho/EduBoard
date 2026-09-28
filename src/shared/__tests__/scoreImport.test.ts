import { describe, expect, it } from 'vitest'
import {
  buildScoreImportPlan,
  guessScoreColumns,
  guessStudentColumns,
  matchStudents,
  parseScore,
  splitHeading,
  type ScoreSheet
} from '../scoreImport'

const roster = [
  { id: 'mai', firstName: 'Mai', lastName: 'Chen', studentNumber: '1001' },
  { id: 'leo', firstName: 'Leo', lastName: 'Wang', studentNumber: '1002' },
  { id: 'li', firstName: '麦', lastName: '陈', studentNumber: null }
]

function sheet(headers: string[], rows: (string | number | null)[][]): ScoreSheet {
  return { sheetNames: ['Sheet1'], sheetIndex: 0, headers, rows, truncated: false }
}

describe('score import', () => {
  it('finds the student column: number first, then name, then first + last', () => {
    expect(guessStudentColumns(['姓名', '学号', '语文'])).toEqual({ kind: 'number', column: 1 })
    expect(guessStudentColumns(['Student Name', 'Quiz 1'])).toEqual({ kind: 'name', column: 0 })
    expect(guessStudentColumns(['First name', 'Surname', 'Test'])).toEqual({
      kind: 'split',
      first: 0,
      last: 1
    })
    expect(guessStudentColumns(['Quiz', 'Test'])).toBeNull()
    // An empty student number column is passed over for the names.
    expect(
      guessStudentColumns(
        ['学号', '姓名', 'Test'],
        [
          [null, 'Mai Chen', 10],
          [null, 'Leo Wang', 12]
        ]
      )
    ).toEqual({ kind: 'name', column: 1 })
    expect(guessStudentColumns(['学号', '姓名'], [], 'name')).toEqual({ kind: 'name', column: 1 })
  })

  it('reads scores, percentages and excused marks', () => {
    expect(parseScore(17, 20)).toEqual({ kind: 'score', points: 17 })
    expect(parseScore(' 8.5 ', 10)).toEqual({ kind: 'score', points: 8.5 })
    expect(parseScore('8,5', 10)).toEqual({ kind: 'score', points: 8.5 })
    expect(parseScore('85%', 20)).toEqual({ kind: 'score', points: 17 })
    expect(parseScore('EX', 20)).toEqual({ kind: 'excused' })
    expect(parseScore('免考', 20)).toEqual({ kind: 'excused' })
    expect(parseScore('', 20)).toEqual({ kind: 'empty' })
    expect(parseScore('absent', 20)).toEqual({ kind: 'bad' })
  })

  it('takes a maximum from the heading', () => {
    expect(splitHeading('Quiz 3 (/20)')).toEqual({ name: 'Quiz 3', max: 20 })
    expect(splitHeading('Quiz 3 /20')).toEqual({ name: 'Quiz 3', max: 20 })
    expect(splitHeading('Unit test (out of 50)')).toEqual({ name: 'Unit test', max: 50 })
    expect(splitHeading('期中考试（满分120）')).toEqual({ name: '期中考试', max: 120 })
    expect(splitHeading('Quiz 3')).toEqual({ name: 'Quiz 3', max: null })
  })

  it('matches names in any usual order, and student numbers', () => {
    const s = sheet(['Name'], [['Mai Chen'], ['wang leo'], ['Chen, Mai'], ['陈麦'], ['Nobody']])
    expect(matchStudents(s, { kind: 'name', column: 0 }, roster)).toEqual([
      'mai',
      'leo',
      'mai',
      'li',
      null
    ])
    const byNumber = sheet(['学号'], [['1002'], [1001], ['9999']])
    expect(matchStudents(byNumber, { kind: 'number', column: 0 }, roster)).toEqual([
      'leo',
      'mai',
      null
    ])
  })

  it('picks score columns, and matches them to assessments of the same name', () => {
    const s = sheet(
      ['Name', 'Class', 'Quiz 1 (/20)', 'Midterm', 'Comment'],
      [
        ['Mai Chen', '4B', 18, 71, 'Good'],
        ['Leo Wang', '4B', 'EX', 88, 'Fine']
      ]
    )
    const choices = guessScoreColumns(s, { kind: 'name', column: 0 }, [
      { id: 'a1', name: 'quiz 1', maxScore: 20 }
    ])
    expect(choices.map((c) => [c.column, c.target, c.newName, c.maxScore])).toEqual([
      [2, 'a1', 'Quiz 1', 20],
      [3, 'new', 'Midterm', 100]
    ])
    // A heading with a different maximum isn't matched to the gradebook's assessment.
    const other = guessScoreColumns(s, { kind: 'name', column: 0 }, [
      { id: 'a1', name: 'Quiz 1', maxScore: 10 }
    ])
    expect(other[0].target).toBe('new')
  })

  it('plans the writes, and lists what it leaves out and why', () => {
    const s = sheet(
      ['Name', 'Quiz 1', 'Test'],
      [
        ['Mai Chen', 18, 'abs'],
        ['Leo Wang', 25, 40],
        ['Mai Chen', 1, 1],
        ['Ghost Student', 10, 10],
        [null, null, null]
      ]
    )
    const plan = buildScoreImportPlan(
      s,
      { kind: 'name', column: 0 },
      [
        { column: 1, include: true, target: 'a1', newName: 'Quiz 1', maxScore: 20 },
        { column: 2, include: true, target: 'new', newName: 'Test', maxScore: 50 }
      ],
      roster,
      [{ assessmentId: 'a1', studentId: 'mai', pointsEarned: 15, excused: false }]
    )
    expect(plan.writes).toEqual([
      { target: 'a1', studentId: 'mai', pointsEarned: 18, excused: false, previous: 15 },
      { target: 'new:2', studentId: 'leo', pointsEarned: 40, excused: false, previous: null }
    ])
    expect(plan.skipped).toEqual([
      { row: 2, column: 'Test', value: 'abs', reason: 'not-a-score' },
      { row: 3, column: 'Quiz 1', value: '25', reason: 'over-max' }
    ])
    expect(plan.duplicates).toEqual([{ row: 4, label: 'Mai Chen' }])
    expect(plan.unmatched).toEqual([{ row: 5, label: 'Ghost Student' }])
  })
})
