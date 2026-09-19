import { desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { studentLogEntries } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { StudentLogEntry } from '@shared/types'
import type { CreateStudentLogEntryInput } from '@shared/inputs'

export type { CreateStudentLogEntryInput }

export function listStudentLogEntries(studentId: string): StudentLogEntry[] {
  return getDb()
    .select()
    .from(studentLogEntries)
    .where(eq(studentLogEntries.studentId, studentId))
    .orderBy(desc(studentLogEntries.createdAt))
    .all() as StudentLogEntry[]
}

export function createStudentLogEntry(input: CreateStudentLogEntryInput): StudentLogEntry {
  const row: StudentLogEntry = { id: newId(), createdAt: nowIso(), ...input }
  getDb().insert(studentLogEntries).values(row).run()
  return row
}

export function deleteStudentLogEntry(id: string): void {
  getDb().delete(studentLogEntries).where(eq(studentLogEntries.id, id)).run()
}
