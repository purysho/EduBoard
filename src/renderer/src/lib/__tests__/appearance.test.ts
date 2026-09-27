import { describe, expect, it } from 'vitest'
import { accentCss, isHexColour, whiteTextContrast } from '../appearance'

describe('school colour', () => {
  it('accepts only #rrggbb, so nothing else can reach the stylesheet', () => {
    expect(isHexColour('#0f766e')).toBe(true)
    expect(isHexColour('red')).toBe(false)
    expect(isHexColour('#fff')).toBe(false)
    expect(accentCss('red;}body{display:none')).toBe('')
    expect(accentCss('')).toBe('')
    expect(accentCss('#0f766e')).toContain('--color-primary:#0f766e')
  })

  it('flags colours too light for white button text', () => {
    expect(whiteTextContrast('#1d4ed8')).toBeGreaterThan(4.5)
    expect(whiteTextContrast('#facc15')).toBeLessThan(3)
  })
})
