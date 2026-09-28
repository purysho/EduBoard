import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { SAMPLE_SCHOOL_FLAG } from '../../db/path'
import { listClasses } from '../../repositories/classes'
import { listStudents } from '../../repositories/students'
import { getRosterForClass } from '../../repositories/enrollments'
import { listScoresByClass } from '../../repositories/scores'
import { listAttendanceByClass } from '../../repositories/attendanceRecords'
import { getSettings } from '../../repositories/settingsRepo'
import { seedSampleSchoolIfEmpty } from '../sampleSchool'

let dir: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eduboard-sample-'))
  setDbPathForTesting(join(dir, `${randomUUID()}.db`))
  initDb()
})
afterEach(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
  process.argv = process.argv.filter((a) => a !== SAMPLE_SCHOOL_FLAG)
})

describe('sample school', () => {
  it('does nothing outside the sample school', () => {
    seedSampleSchoolIfEmpty()
    expect(listClasses(true)).toHaveLength(0)
  })

  it('fills in two classes with a term of made-up work, once', () => {
    process.argv.push(SAMPLE_SCHOOL_FLAG)
    seedSampleSchoolIfEmpty()
    const classes = listClasses(true)
    expect(classes).toHaveLength(2)
    expect(listStudents()).toHaveLength(24)
    for (const c of classes) {
      expect(getRosterForClass(c.id)).toHaveLength(12)
      expect(listScoresByClass(c.id).length).toBeGreaterThan(70)
      expect(listAttendanceByClass(c.id).length).toBeGreaterThan(100)
    }
    expect(getSettings().schoolName).toMatch(/sample/i)

    // Opening it again doesn't add a second school.
    seedSampleSchoolIfEmpty()
    expect(listClasses(true)).toHaveLength(2)
  })
})
