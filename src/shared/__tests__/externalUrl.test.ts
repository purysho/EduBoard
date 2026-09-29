import { describe, expect, it } from 'vitest'
import { isSafeExternalUrl } from '../externalUrl'

describe('links EduBoard will open', () => {
  it('opens web pages and email addresses', () => {
    expect(isSafeExternalUrl('https://edu-board.com/brochure')).toBe(true)
    expect(isSafeExternalUrl('http://example.org')).toBe(true)
    expect(isSafeExternalUrl(' https://example.org ')).toBe(true)
    expect(isSafeExternalUrl('mailto:teacher@example.org')).toBe(true)
  })

  it('refuses anything that could open a local program or file', () => {
    for (const url of [
      'file:///C:/Windows/System32/calc.exe',
      'file://\\\\attacker\\share\\run.exe',
      'ms-msdt:/id PCWDiagnostic',
      'search-ms:query=x',
      'javascript:alert(1)',
      'C:\\Windows\\notepad.exe',
      'not a link',
      '',
      null,
      42
    ]) {
      expect(isSafeExternalUrl(url)).toBe(false)
    }
  })
})
