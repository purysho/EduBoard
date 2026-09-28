import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { getSettings, updateSettings } from '../../repositories/settingsRepo'
import { listTerms } from '../../repositories/terms'
import { applyManagedPackFile } from '../managedSchoolPack'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-managed-pack-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

const pack = (extra: Record<string, unknown> = {}): string =>
  JSON.stringify({
    kind: 'eduboard-school-pack',
    version: 1,
    createdAt: '2026-09-01T00:00:00Z',
    appName: 'Riverside Teacher Hub',
    schoolName: 'Riverside Bilingual School',
    accentColor: '#0f766e',
    defaultPassMark: 50,
    terms: [{ name: 'Term 1', schoolYear: '2026-27', startDate: null, endDate: null }],
    ...extra
  })

describe('a school pack installed for everyone on the computer', () => {
  it('sets and locks the branding every time, and the rest once per version', () => {
    const file = join(dir, 'school-pack.json')
    writeFileSync(file, pack())

    const first = applyManagedPackFile(file)
    expect(first).toEqual({
      filePath: file,
      locked: ['appDisplayName', 'schoolName', 'accentColor']
    })
    expect(getSettings()).toMatchObject({
      appDisplayName: 'Riverside Teacher Hub',
      schoolName: 'Riverside Bilingual School',
      accentColor: '#0f766e',
      defaultPassMark: 50
    })
    expect(listTerms().map((t) => t.name)).toEqual(['Term 1'])

    // A teacher changes their pass mark, and something (an old backup, say) changes the name.
    updateSettings({ defaultPassMark: 65, schoolName: 'Something else' })
    applyManagedPackFile(file)
    expect(getSettings().defaultPassMark).toBe(65)
    expect(getSettings().schoolName).toBe('Riverside Bilingual School')
    expect(listTerms()).toHaveLength(1)

    // IT publishes a new version of the file: its settings apply again.
    writeFileSync(file, pack({ defaultPassMark: 55 }))
    applyManagedPackFile(file)
    expect(getSettings().defaultPassMark).toBe(55)
  })

  it('ignores a file that isn’t a school pack', () => {
    const file = join(dir, 'school-pack.json')
    writeFileSync(file, '{"not":"a pack"}')
    expect(applyManagedPackFile(file)).toBeNull()
    expect(getSettings().appDisplayName).toBe('')
  })
})
