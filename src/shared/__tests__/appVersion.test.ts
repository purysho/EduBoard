import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { isNewerVersion } from '../appVersion'

describe('update check', () => {
  it('compares versions number by number', () => {
    expect(isNewerVersion('0.3.10', '0.3.9')).toBe(true)
    expect(isNewerVersion('v1.0.0', '0.9.9')).toBe(true)
    expect(isNewerVersion('0.3.2', '0.3.2')).toBe(false)
    expect(isNewerVersion('0.3.1', '0.3.2')).toBe(false)
  })

  it('the Portal announces exactly this version of the desktop app', () => {
    // `npm version` keeps these in step; this catches a hand-edited version.
    const root = join(__dirname, '..', '..', '..')
    const app = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
    const announced = JSON.parse(
      readFileSync(join(root, 'portal', 'desktop-version.json'), 'utf8')
    ).version
    expect(announced).toBe(app)
  })
})
