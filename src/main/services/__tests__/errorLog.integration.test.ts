import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ dir: '' }))
vi.mock('electron', () => ({ app: { getVersion: () => '0.5.0' } }))
vi.mock('../../db/path', () => ({ resolveDbPath: () => join(state.dir, 'eduboard.db') }))

import {
  errorLogPath,
  errorReportText,
  logWindowError,
  recentErrors,
  toWindowError
} from '../errorLog'
import { AppError, splitCode } from '@shared/errorCodes'

beforeEach(() => {
  state.dir = mkdtempSync(join(tmpdir(), 'eb-errlog-'))
})
afterEach(() => rmSync(state.dir, { recursive: true, force: true }))

describe('error log', () => {
  it('sends a coded error to the window with its code, and logs it', () => {
    const out = toWindowError(
      new AppError('EB-1003', 'Couldn’t reach the Portal.'),
      'portalSync:publish'
    )
    expect(splitCode(out.message)).toEqual({ text: 'Couldn’t reach the Portal.', code: 'EB-1003' })
    expect(recentErrors()[0]).toMatchObject({ code: 'EB-1003', where: 'portalSync:publish' })
    expect(recentErrors()[0].ref).toBeUndefined()
  })

  it('logs the same coded error from the same place once per 10 minutes', () => {
    for (let i = 0; i < 5; i++) {
      toWindowError(new AppError('EB-1006', 'Not responding.'), 'portalAccounts:list')
    }
    toWindowError(new AppError('EB-1006', 'Not responding.'), 'portalSync:publish')
    expect(recentErrors().filter((e) => e.code === 'EB-1006')).toHaveLength(2)
  })

  it('logs an unexpected error in full with a reference, and shows only a plain sentence', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = toWindowError(new Error('SQLITE_BUSY: database is locked'), 'classes:update')
    const { code, ref, text } = splitCode(out.message)
    expect(code).toBe('EB-0900')
    expect(ref).toMatch(/^[A-Z2-9]{6}$/)
    expect(text).not.toMatch(/SQLITE/)
    const logged = recentErrors()[0]
    expect(logged).toMatchObject({
      code: 'EB-0900',
      ref,
      message: 'SQLITE_BUSY: database is locked'
    })
    expect(logged.stack).toMatch(/errorLog\.integration\.test/)
  })

  it('logs a screen that failed to draw, and puts everything in the report', () => {
    const ref = logWindowError({
      message: 'x is undefined',
      stack: 'TypeError: x\n at Seat',
      where: '/classes/1'
    })
    const report = errorReportText({ language: 'zh', portal: true })
    expect(report).toMatch(/Version 0\.5\.0/)
    expect(report).toMatch(/language zh · Portal set up/)
    expect(report).toContain(`EB-0901 ref ${ref}  /classes/1  x is undefined`)
    expect(existsSync(errorLogPath())).toBe(true)
    expect(readFileSync(errorLogPath(), 'utf8').trim().split('\n')).toHaveLength(1)
  })

  it('keeps the log small', () => {
    const big = 'x'.repeat(900)
    for (let i = 0; i < 400; i++) logWindowError({ message: big })
    expect(existsSync(`${errorLogPath()}.1`)).toBe(true)
    expect(recentErrors(1000).length).toBeLessThan(700)
  })
})
