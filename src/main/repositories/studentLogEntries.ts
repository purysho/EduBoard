import { desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { studentLogEntries, students } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { ParentCommunicationEntry, StudentLogEntry } from '@shared/types'
import type { CreateStudentLogEntryInput, UpdateStudentLogEntryInput } from '@shared/inputs'

export type { CreateStudentLogEntryInput, UpdateStudentLogEntryInput }

export function listStudentLogEntries(studentId: string): StudentLogEntry[] {
  return getDb()
    .select()
    .from(studentLogEntries)
    .where(eq(studentLogEntries.studentId, studentId))
    .orderBy(desc(studentLogEntries.createdAt))
    .all() as StudentLogEntry[]
}

export function createStudentLogEntry(input: CreateStudentLogEntryInput): StudentLogEntry {
  const row: StudentLogEntry = {
    id: newId(),
    createdAt: nowIso(),
    contactMethod: null,
    followUpNeeded: false,
    followUpDone: false,
    ...input
  }
  getDb().insert(studentLogEntries).values(row).run()
  return row
}

export function updateStudentLogEntry(
  id: string,
  patch: UpdateStudentLogEntryInput
): StudentLogEntry {
  getDb().update(studentLogEntries).set(patch).where(eq(studentLogEntries.id, id)).run()
  const updated = getDb()
    .select()
    .from(studentLogEntries)
    .where(eq(studentLogEntries.id, id))
    .get() as StudentLogEntry | undefined
  if (!updated) throw new Error(`Student log entry ${id} not found after update`)
  return updated
}

export function deleteStudentLogEntry(id: string): void {
  getDb().delete(studentLogEntries).where(eq(studentLogEntries.id, id)).run()
}

/** All parent-communication entries (type 'contact') across every student, newest first —
 * the data backing the standalone Communications page rather than a per-student panel. */
export function listParentCommunications(): ParentCommunicationEntry[] {
  const rows = getDb()
    .select({
      id: studentLogEntries.id,
      studentId: studentLogEntries.studentId,
      type: studentLogEntries.type,
      text: studentLogEntries.text,
      contactMethod: studentLogEntries.contactMethod,
      followUpNeeded: studentLogEntries.followUpNeeded,
      followUpDone: studentLogEntries.followUpDone,
      createdAt: studentLogEntries.createdAt,
      firstName: students.firstName,
      lastName: students.lastName
    })
    .from(studentLogEntries)
    .innerJoin(students, eq(studentLogEntries.studentId, students.id))
    .where(eq(studentLogEntries.type, 'contact'))
    .orderBy(desc(studentLogEntries.createdAt))
    .all() as (StudentLogEntry & { firstName: string; lastName: string })[]

  return rows.map(({ firstName, lastName, ...entry }) => ({
    ...entry,
    studentName: `${firstName} ${lastName}`
  }))
}
