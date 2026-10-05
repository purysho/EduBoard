import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { join } from 'path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { updateSettings } from '../../repositories/settingsRepo'
import { createClass, deleteClass } from '../../repositories/classes'
import {
  getClassHelperRules,
  listClassHelperRules,
  setClassHelperRules
} from '../../repositories/classHelperRules'
import { duplicateClassForNewTerm } from '../../repositories/newTermClass'
import { getPublishStatus, publishToPortal } from '../portalSyncService'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

// The Portal's own test helper starts a real Portal on a free port.
const { startPortal } = createRequire(import.meta.url)('../../../../portal/test/helpers.js')

let tempDir: string
let portal: { url: string; dataDir: string; secrets: { sync: string }; stop: () => Promise<void> }

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
  portal = await startPortal()
})

afterEach(async () => {
  await portal.stop()
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

function makeClass(name = 'Speaking 1'): string {
  return createClass({
    name,
    subject: null,
    levelType: 'university',
    gradeLevel: null,
    termId: null,
    schedule: null,
    room: null,
    color: null,
    passMark: 60,
    maxScore: 100,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS
  }).id
}

const portalRules = (classId: string): string | null => {
  const db = new Database(join(portal.dataDir, 'portal.db'), { readonly: true })
  try {
    const row = db.prepare('SELECT helper_rules FROM classes WHERE id = ?').get(classId) as
      { helper_rules: string | null } | undefined
    return row?.helper_rules ?? null
  } finally {
    db.close()
  }
}

describe("a class's Study Helper rules", () => {
  it('are saved, carried into a new term, cleared when empty, and gone with the class', () => {
    const classId = makeClass()
    expect(getClassHelperRules(classId).replyLanguage).toBe('')
    setClassHelperRules(classId, { replyLanguage: 'english', vocabulary: 'A2', rules: '' })
    const next = duplicateClassForNewTerm(classId, {
      name: 'Speaking 2',
      termId: null,
      copyStudents: false
    })
    expect(getClassHelperRules(next.id).vocabulary).toBe('A2')

    setClassHelperRules(classId, { replyLanguage: '', vocabulary: ' ', rules: '' })
    expect([...listClassHelperRules().keys()]).toEqual([next.id])
    deleteClass(next.id)
    expect(listClassHelperRules().size).toBe(0)
  })

  it('reach the Portal with the next publish, and are removed from it when cleared', async () => {
    updateSettings({ portalUrl: portal.url, portalSyncSecret: portal.secrets.sync })
    const classId = makeClass()
    await publishToPortal()
    expect(portalRules(classId)).toBeNull()

    setClassHelperRules(classId, {
      replyLanguage: 'english-gloss',
      vocabulary: 'A2: short sentences',
      rules: 'Never write their script.'
    })
    expect(getPublishStatus().upToDate).toBe(false)
    await publishToPortal()
    expect(JSON.parse(portalRules(classId) as string)).toEqual({
      replyLanguage: 'english-gloss',
      vocabulary: 'A2: short sentences',
      rules: 'Never write their script.'
    })

    setClassHelperRules(classId, {})
    await publishToPortal()
    expect(portalRules(classId)).toBeNull()
  })
})
