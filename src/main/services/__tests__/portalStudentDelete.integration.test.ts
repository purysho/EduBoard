import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { updateSettings } from '../../repositories/settingsRepo'
import { removeStudentFromPortal } from '../portalSyncService'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-portal-delete-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  vi.unstubAllGlobals()
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const portal = (): void => {
  updateSettings({ portalUrl: 'https://portal.example.edu', portalSyncSecret: 'secret' })
}
const reply = (status: number): Response =>
  new Response(JSON.stringify(status === 200 ? { ok: true } : { error: 'x' }), { status })

describe('removing a student from the Portal', () => {
  it('does nothing without a Portal', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await removeStudentFromPortal('s1')).toBe('no-portal')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('removes straight away when the Portal answers', async () => {
    portal()
    const fetchMock = vi.fn(async () => reply(200))
    vi.stubGlobal('fetch', fetchMock)
    expect(await removeStudentFromPortal('s1')).toBe('removed')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://portal.example.edu/api/sync/delete-student')
    expect(JSON.parse(String(init.body))).toEqual({ studentId: 's1' })
  })

  it('keeps it queued while offline and sends it on the next try', async () => {
    portal()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      })
    )
    expect(await removeStudentFromPortal('s1')).toBe('queued')
    expect(await removeStudentFromPortal('s2')).toBe('queued')

    const sent: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        sent.push(JSON.parse(String(init.body)).studentId)
        return reply(200)
      })
    )
    expect(await removeStudentFromPortal('s3')).toBe('removed')
    expect(sent).toEqual(['s1', 's2', 's3'])
  })

  it('keeps it queued for a Portal too old to delete', async () => {
    portal()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply(404))
    )
    expect(await removeStudentFromPortal('s1')).toBe('queued')
  })
})
