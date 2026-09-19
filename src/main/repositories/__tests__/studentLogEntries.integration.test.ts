import { randomUUID } from 'crypto'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, initDb, setDbPathForTesting } from '../../db/client'
import { createStudent } from '../students'
import {
  createStudentLogEntry,
  listParentCommunications,
  listStudentLogEntries,
  updateStudentLogEntry
} from '../studentLogEntries'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'eduboard-test-'))
  setDbPathForTesting(join(tempDir, `${randomUUID()}.db`))
  initDb()
})

afterEach(() => {
  closeDb()
  rmSync(tempDir, { recursive: true, force: true })
})

function makeStudent(firstName: string, lastName: string): string {
  return createStudent({
    firstName,
    lastName,
    preferredName: null,
    studentNumber: null,
    dateOfBirth: null,
    gradeLevel: null,
    guardianName: null,
    guardianContact: null,
    email: null,
    notes: null
  }).id
}

describe('student log entries', () => {
  it('defaults contact fields when omitted and preserves them when supplied', () => {
    const studentId = makeStudent('Ava', 'Smith')
    const note = createStudentLogEntry({ studentId, type: 'note', text: 'Doing well.' })
    expect(note.contactMethod).toBeNull()
    expect(note.followUpNeeded).toBe(false)
    expect(note.followUpDone).toBe(false)

    const contact = createStudentLogEntry({
      studentId,
      type: 'contact',
      text: 'Called home.',
      contactMethod: 'phone',
      followUpNeeded: true
    })
    expect(contact.contactMethod).toBe('phone')
    expect(contact.followUpNeeded).toBe(true)
    expect(contact.followUpDone).toBe(false)

    expect(listStudentLogEntries(studentId)).toHaveLength(2)
  })

  it('lists only contact-type entries across all students, newest first, with student names', () => {
    const aliceId = makeStudent('Alice', 'Nguyen')
    const bobId = makeStudent('Bob', 'Diaz')

    createStudentLogEntry({ studentId: aliceId, type: 'note', text: 'Not a contact.' })
    const first = createStudentLogEntry({
      studentId: bobId,
      type: 'contact',
      text: 'Emailed guardian.',
      contactMethod: 'email',
      followUpNeeded: false
    })
    const second = createStudentLogEntry({
      studentId: aliceId,
      type: 'contact',
      text: 'Called home about attendance.',
      contactMethod: 'phone',
      followUpNeeded: true
    })

    // createdAt has second-level resolution, so same-second entries can tie — assert the
    // right set came back (with the right per-student fields), not a specific tie-break order.
    const comms = listParentCommunications()
    expect(comms.map((c) => c.id).sort()).toEqual([first.id, second.id].sort())
    const byId = new Map(comms.map((c) => [c.id, c]))
    expect(byId.get(first.id)).toMatchObject({ studentName: 'Bob Diaz', contactMethod: 'email' })
    expect(byId.get(second.id)).toMatchObject({
      studentName: 'Alice Nguyen',
      contactMethod: 'phone'
    })
  })

  it('toggles follow-up state via updateStudentLogEntry', () => {
    const studentId = makeStudent('Cara', 'Lee')
    const entry = createStudentLogEntry({
      studentId,
      type: 'contact',
      text: 'Left voicemail.',
      contactMethod: 'phone',
      followUpNeeded: true
    })
    expect(entry.followUpDone).toBe(false)

    const updated = updateStudentLogEntry(entry.id, { followUpDone: true })
    expect(updated.followUpDone).toBe(true)
    expect(listParentCommunications()[0].followUpDone).toBe(true)
  })
})
