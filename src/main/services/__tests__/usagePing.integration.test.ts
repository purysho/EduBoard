import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '0.4.0' } }))

import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { updateSettings } from '../../repositories/settingsRepo'
import { sendUsagePingIfDue, usagePingPreview, usagePingSettingChanged } from '../usagePing'
import { classBand, studentBand, usagePingDue, USAGE_PING_URL } from '@shared/usagePing'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eb-ping-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const recorder = (): { fetch: typeof fetch; sent: unknown[] } => {
  const sent: unknown[] = []
  return {
    sent,
    fetch: (async (url: string, init: RequestInit) => {
      expect(url).toBe(USAGE_PING_URL)
      sent.push(JSON.parse(String(init.body)))
      return Response.json({ ok: true })
    }) as unknown as typeof fetch
  }
}

describe('usage ping', () => {
  it('sends nothing while it is off (the default)', async () => {
    const r = recorder()
    expect(await sendUsagePingIfDue(new Date(), r.fetch)).toBe(false)
    expect(r.sent).toEqual([])
    expect(usagePingPreview().id).toBe('')
  })

  it('once turned on, sends only the fixed fields, at most once a week', async () => {
    updateSettings({ usagePing: true })
    usagePingSettingChanged(true)
    const r = recorder()
    const now = new Date('2026-10-01T09:00:00Z')
    expect(await sendUsagePingIfDue(now, r.fetch)).toBe(true)
    expect(await sendUsagePingIfDue(new Date('2026-10-05T09:00:00Z'), r.fetch)).toBe(false)
    expect(await sendUsagePingIfDue(new Date('2026-10-08T09:00:00Z'), r.fetch)).toBe(true)
    expect(r.sent).toHaveLength(2)
    const ping = r.sent[0] as Record<string, unknown>
    expect(Object.keys(ping).sort()).toEqual(
      ['classes', 'id', 'language', 'os', 'portal', 'students', 'version'].sort()
    )
    expect(ping).toMatchObject({ version: '0.4.0', classes: '0', students: '0', portal: false })
    expect(ping.id).toMatch(/^[0-9a-f-]{36}$/)
    expect((r.sent[1] as { id: string }).id).toBe(ping.id)

    // Turning it off forgets the id.
    updateSettings({ usagePing: false })
    usagePingSettingChanged(false)
    expect(usagePingPreview().id).toBe('')
  })

  it('bands sizes and knows when a ping is due', () => {
    expect([0, 2, 3, 9].map(classBand)).toEqual(['0', '1-2', '3-5', '6+'])
    expect([0, 30, 31, 101].map(studentBand)).toEqual(['0', '1-30', '31-100', '101+'])
    const now = new Date('2026-10-08T00:00:00Z')
    expect(usagePingDue(false, null, now)).toBe(false)
    expect(usagePingDue(true, null, now)).toBe(true)
    expect(usagePingDue(true, '2026-10-02T00:00:00Z', now)).toBe(false)
    expect(usagePingDue(true, '2026-10-01T00:00:00Z', now)).toBe(true)
  })
})
