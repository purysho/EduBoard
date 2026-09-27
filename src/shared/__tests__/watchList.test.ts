import { describe, expect, it } from 'vitest'
import { watchReasons } from '../watchList'

const base = { percent: 75, passMark: 60, trend: [70, 72, 75], recentConcerns: 0 }

describe('students to check on', () => {
  it('flags nobody doing fine', () => {
    expect(watchReasons(base)).toEqual([])
  })

  it('names each reason in plain words', () => {
    expect(
      watchReasons({ percent: 52.4, passMark: 60, trend: [80, 70, 61, 52], recentConcerns: 3 })
    ).toEqual([
      'Below the pass mark (52% vs 60%)',
      'Grades down 28 points',
      '3 concerns logged in 30 days'
    ])
  })

  it('needs three scores before calling a trend, and ignores small dips', () => {
    expect(watchReasons({ ...base, trend: [90, 70] })).toEqual([])
    expect(watchReasons({ ...base, trend: [80, 78, 74] })).toEqual([])
  })

  it('has nothing to say about a grade that doesn’t exist yet', () => {
    expect(watchReasons({ ...base, percent: null, trend: [] })).toEqual([])
  })
})
