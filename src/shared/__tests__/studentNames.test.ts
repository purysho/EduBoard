import { describe, expect, it } from 'vitest'
import { findPossibleDuplicates, sameName } from '../studentNames'

type S = { id: string; firstName: string; lastName: string; createdAt: string }

const s = (id: string, firstName: string, lastName: string, createdAt = '2026-01-01'): S => ({
  id,
  firstName,
  lastName,
  createdAt
})

describe('matching student names', () => {
  it('treats the same name in either order, spacing or case as one person', () => {
    expect(sameName(s('a', 'Mai', 'Chen'), s('b', 'Chen', 'Mai'))).toBe(true)
    expect(sameName(s('a', 'mai ', 'CHEN'), s('b', 'Mai', 'Chen'))).toBe(true)
    expect(sameName(s('a', '麦', '陈'), s('b', '陈麦', ''))).toBe(true)
  })

  it("doesn't join different names that only share letters", () => {
    expect(sameName(s('a', 'Anna', 'Lee'), s('b', 'Ann', 'Alee'))).toBe(false)
    expect(sameName(s('a', 'Mai', 'Chen'), s('b', 'Mai', 'Wang'))).toBe(false)
  })

  it('lists each likely duplicate pair once, older record first', () => {
    const pairs = findPossibleDuplicates([
      s('new', 'Chen', 'Mai', '2026-09-20'),
      s('old', 'Mai', 'Chen', '2026-09-01'),
      s('other', 'Leo', 'Wang')
    ])
    expect(pairs.map(([a, b]) => [a.id, b.id])).toEqual([['old', 'new']])
  })
})
