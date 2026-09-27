import { describe, expect, it } from 'vitest'
import { checkCss, exampleStylesheet } from '../cssCheck'

describe('checking a school stylesheet', () => {
  it('finds EduBoard colour variables and rules for everyday elements', () => {
    const c = checkCss(
      ':root { --color-primary: #0a6e4f; --color-bg:#fff } .dark{--color-bg:#000} body, h1:hover { font-family: serif } .wp-block-button { color: red }',
      50_000
    )
    expect(c.tokens).toEqual(['--color-bg', '--color-primary'])
    // The two :root / .dark blocks only set variables (counted as tokens).
    expect(c.generalRules).toBe(1)
    expect(c.otherRules).toBe(1)
    expect(c.truncated).toBe(false)
  })

  it('sees that a website theme’s stylesheet changes nothing here', () => {
    const wordpress = `/* Theme Name: Montana */
      :root { --montana-edge: color-mix(in srgb, var(--wp--preset--color--contrast) 50%, white); }
      .screen-reader-text { position: absolute; }
      .wp-block-navigation a { color: var(--wp--preset--color--base); }
      body:not(:has(.montana-hero)) .montana-header { background: black; }
      @media (min-width: 600px) { .montana-hero { height: 80vh } }`
    const c = checkCss(wordpress, 50_000)
    expect(c.tokens).toEqual([])
    // ":root" only sets the theme's own variables, which nothing here uses.
    expect(c.generalRules).toBe(0)
    expect(c.otherRules).toBe(4)
  })

  it('says when a file was cut short', () => {
    expect(checkCss('a{}'.repeat(10), 12).truncated).toBe(true)
  })

  it('offers an example that sets every main colour', () => {
    expect(checkCss(exampleStylesheet(), 50_000).tokens.length).toBeGreaterThanOrEqual(12)
  })
})
