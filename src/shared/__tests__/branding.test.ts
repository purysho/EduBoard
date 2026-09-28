import { describe, expect, it } from 'vitest'
import { appInitials, cleanAppName, displayAppName, withoutLocked } from '../branding'

describe('school branding', () => {
  it('keeps an app name to one tidy line of at most 40 characters', () => {
    expect(cleanAppName('  Riverside\n Teacher\tHub  ')).toBe('Riverside Teacher Hub')
    expect(cleanAppName('x'.repeat(60))).toHaveLength(40)
    expect(cleanAppName('‮evil')).toBe('evil')
    expect(cleanAppName(42)).toBe('')
  })

  it('falls back to EduBoard', () => {
    expect(displayAppName({ appDisplayName: '' })).toBe('EduBoard')
    expect(displayAppName(undefined)).toBe('EduBoard')
    expect(displayAppName({ appDisplayName: '河滨教师助手' })).toBe('河滨教师助手')
  })

  it('makes two-letter badges', () => {
    expect(appInitials('EduBoard')).toBe('EB')
    expect(appInitials('Riverside Teacher Hub')).toBe('RT')
    expect(appInitials('Hub')).toBe('HU')
    expect(appInitials('河滨 教师助手')).toBe('河滨')
  })

  it('drops locked settings from a change', () => {
    expect(
      withoutLocked({ schoolName: 'X', teacherName: 'Ms Li' }, ['schoolName', 'appDisplayName'])
    ).toEqual({ teacherName: 'Ms Li' })
  })
})
