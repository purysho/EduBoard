import { describe, expect, it } from 'vitest'
import { styleLibrary } from '../styleLibrary'
import { MAX_CSS_CHARS, sanitizeCss } from '../schoolPack'
import { checkCss } from '../cssCheck'

describe('style library', () => {
  const styles = styleLibrary()

  it('offers several distinct styles', () => {
    expect(styles.length).toBeGreaterThanOrEqual(6)
    expect(new Set(styles.map((s) => s.id)).size).toBe(styles.length)
    expect(new Set(styles.map((s) => s.swatch.primary)).size).toBe(styles.length)
  })

  it('every style is already safe: the stylesheet filter changes nothing in it', () => {
    for (const style of styles) expect(sanitizeCss(style.css)).toBe(style.css)
  })

  it('every style really changes EduBoard’s colours (not a stylesheet that does nothing)', () => {
    for (const style of styles) {
      const check = checkCss(style.css, MAX_CSS_CHARS)
      expect(check.tokens).toContain('--color-primary')
      expect(check.otherRules).toBe(0)
    }
  })
})
