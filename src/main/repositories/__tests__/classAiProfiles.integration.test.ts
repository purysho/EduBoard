import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, getSqlite, initDb, setDbPathForTesting } from '../../db/client'
import { createClass, deleteClass } from '../classes'
import { getClassAiProfile, setClassAiProfile } from '../classAiProfiles'
import { duplicateClassForNewTerm } from '../newTermClass'
import { DEFAULT_GRADE_THRESHOLDS } from '@shared/types'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-class-ai-profile-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

function makeClass(): string {
  return createClass({
    name: 'English 1',
    subject: 'English',
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

const rows = (): number =>
  (getSqlite().prepare('SELECT count(*) c FROM class_ai_profiles').get() as { c: number }).c

describe('class teaching profiles', () => {
  it('saves, reads back cleaned, and removes the row when emptied', () => {
    const classId = makeClass()
    expect(getClassAiProfile(classId).level).toBe('')

    setClassAiProfile(classId, { level: '  A1–B1 ', lessonShape: '45 + 10 + 45' })
    expect(getClassAiProfile(classId)).toMatchObject({
      level: 'A1–B1',
      lessonShape: '45 + 10 + 45'
    })
    expect(rows()).toBe(1)

    setClassAiProfile(classId, { level: '' })
    expect(rows()).toBe(0)
  })

  it('goes when its class is deleted and carries over to the next term’s class', () => {
    const classId = makeClass()
    setClassAiProfile(classId, { routines: 'speaking ladder' })
    const next = duplicateClassForNewTerm(classId, {
      name: 'English 2',
      termId: null,
      copyStudents: false,
      copyTimetable: false
    })
    expect(getClassAiProfile(next.id).routines).toBe('speaking ladder')

    deleteClass(classId)
    expect(rows()).toBe(1) // only the new class's profile is left
  })
})
