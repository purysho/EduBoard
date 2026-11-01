import { describe, expect, it } from 'vitest'
import { sharedScreenName, sharedScreenNameFormat, sharedScreenNames } from '../sharedScreenNames'

const xan = {
  firstName: 'Xanthippe',
  lastName: 'Quillfeather',
  preferredName: null,
  studentNumber: 'SYN-042'
}

describe('names on shared screens', () => {
  it('defaults to first name + last initial in a pilot, the full name otherwise', () => {
    expect(sharedScreenNameFormat({ pilotMode: true, sharedScreenNames: '' })).toBe('firstInitial')
    expect(sharedScreenNameFormat({ pilotMode: false, sharedScreenNames: '' })).toBe('full')
    expect(sharedScreenNameFormat({ pilotMode: true, sharedScreenNames: 'full' })).toBe('full')
    expect(sharedScreenNameFormat({ pilotMode: false, sharedScreenNames: 'number' })).toBe('number')
  })

  it('formats one name three ways', () => {
    expect(sharedScreenName(xan, 'full')).toBe('Xanthippe Quillfeather')
    expect(sharedScreenName(xan, 'firstInitial')).toBe('Xanthippe Q.')
    expect(sharedScreenName(xan, 'number')).toBe('SYN-042')
  })

  it('uses the preferred name, keeps whole characters, and never shows a name for "number"', () => {
    expect(sharedScreenName({ ...xan, preferredName: 'Xan' }, 'firstInitial')).toBe('Xan Q.')
    expect(sharedScreenName({ firstName: '小明', lastName: '王' }, 'firstInitial')).toBe('小明 王.')
    expect(sharedScreenName({ ...xan, studentNumber: null }, 'number')).toBe('X.Q.')
    expect(sharedScreenName({ ...xan, studentNumber: '  ' }, 'number')).not.toContain('Xanthippe')
    expect(sharedScreenName({ ...xan, lastName: '' }, 'firstInitial')).toBe('Xanthippe')
  })

  it('numbers names that would look the same, so each student can find their own', () => {
    const list = [
      { firstName: 'Ming', lastName: 'Li' },
      { firstName: 'Ming', lastName: 'Liu' },
      { firstName: 'Ada', lastName: 'Test' }
    ]
    expect(sharedScreenNames(list, 'firstInitial')).toEqual([
      'Ming L. (1)',
      'Ming L. (2)',
      'Ada T.'
    ])
    expect(sharedScreenNames(list, 'full')).toEqual(['Ming Li', 'Ming Liu', 'Ada Test'])
  })
})
