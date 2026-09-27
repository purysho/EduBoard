import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  clearPending,
  launchAction,
  pendingFileReady,
  readPending,
  writePending,
  type PendingUpdate
} from '../pendingUpdate'

const pending = (over: Partial<PendingUpdate> = {}): PendingUpdate => ({
  version: '0.4.0',
  fileName: 'EduBoard-Setup.exe',
  size: 5,
  kind: 'windows-installer',
  attempts: 0,
  downloadedAt: '2026-09-27T00:00:00.000Z',
  ...over
})

const ready = {
  currentVersion: '0.3.3',
  kind: 'windows-installer' as const,
  fileReady: true,
  auto: true
}

describe('what a launch does with a waiting update', () => {
  it('installs a complete, newer download for this kind of install', () => {
    expect(launchAction(pending(), ready)).toBe('install')
  })

  it('clears it once that version (or a newer one) is running', () => {
    expect(launchAction(pending(), { ...ready, currentVersion: '0.4.0' })).toBe('clear')
    expect(launchAction(pending(), { ...ready, currentVersion: '0.5.0' })).toBe('clear')
  })

  it('clears an incomplete download or one for another kind of install', () => {
    expect(launchAction(pending(), { ...ready, fileReady: false })).toBe('clear')
    expect(launchAction(pending(), { ...ready, kind: 'windows-portable' })).toBe('clear')
    expect(launchAction(pending(), { ...ready, kind: null })).toBe('clear')
  })

  it('waits for the teacher when automatic updates are off', () => {
    expect(launchAction(pending(), { ...ready, auto: false })).toBe('wait')
  })

  it('tries automatically only once, so a bad update cannot close EduBoard every launch', () => {
    expect(launchAction(pending({ attempts: 1 }), ready)).toBe('wait')
  })

  it('has nothing to do with nothing waiting', () => {
    expect(launchAction(null, ready)).toBe('clear')
  })
})

describe('the waiting download on disk', () => {
  let dir: string
  beforeEach(() => {
    dir = join(mkdtempSync(join(tmpdir(), 'eb-pending-')), 'pending-update')
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('round-trips the record and checks the file is complete', () => {
    const p = pending()
    writePending(dir, p)
    expect(readPending(dir)).toEqual(p)
    expect(pendingFileReady(dir, p)).toBe(false)
    writeFileSync(join(dir, p.fileName), 'abc')
    expect(pendingFileReady(dir, p)).toBe(false)
    writeFileSync(join(dir, p.fileName), 'abcde')
    expect(pendingFileReady(dir, p)).toBe(true)
  })

  it('reads a missing or damaged record as nothing waiting', () => {
    expect(readPending(dir)).toBeNull()
    writePending(dir, pending())
    writeFileSync(join(dir, 'pending.json'), '{not json')
    expect(readPending(dir)).toBeNull()
  })

  it('clears everything', () => {
    writePending(dir, pending())
    clearPending(dir)
    expect(readPending(dir)).toBeNull()
  })
})
