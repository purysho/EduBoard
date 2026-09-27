import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { APP_ERROR_CODES, AppError, splitCode, withCode } from '../errorCodes'
import { buildErrorCodesDoc } from '../../../tools/error-codes/build.mjs'

const ROOT = join(__dirname, '../../..')

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}

describe('error codes', () => {
  it('puts the code (and reference) at the end of a message and reads it back', () => {
    expect(withCode('Couldn’t reach the Portal.', 'EB-1003')).toBe(
      'Couldn’t reach the Portal. [EB-1003]'
    )
    expect(splitCode('Oops. [EB-0900 ref 7KQ2MX]')).toEqual({
      text: 'Oops.',
      code: 'EB-0900',
      ref: '7KQ2MX'
    })
    expect(splitCode('No code here')).toEqual({ text: 'No code here' })
    const e = new AppError('EB-1003', 'x')
    expect(e.code).toBe('EB-1003')
  })

  it('uses every catalog code somewhere, and no code that isn’t in the catalog', () => {
    const used = new Set<string>()
    for (const file of sources(join(ROOT, 'src'))) {
      if (file.endsWith('errorCodes.ts')) continue
      for (const m of readFileSync(file, 'utf8').matchAll(/'(EB-\d{4})'/g)) used.add(m[1])
    }
    // EB-0901 is shown by the window's crash screen as plain text, not a quoted code.
    used.add('EB-0901')
    expect([...used].filter((c) => !(c in APP_ERROR_CODES))).toEqual([])
    expect(Object.keys(APP_ERROR_CODES).filter((c) => !used.has(c))).toEqual([])
  })

  it('has docs/ERROR_CODES.md up to date (npm run error-codes)', () => {
    expect(readFileSync(join(ROOT, 'docs/ERROR_CODES.md'), 'utf8')).toBe(buildErrorCodesDoc())
  })
})
