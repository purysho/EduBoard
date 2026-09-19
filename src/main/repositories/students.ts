import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { students } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { Student } from '@shared/types'
import type { CreateStudentInput, UpdateStudentInput } from '@shared/inputs'

export type { CreateStudentInput, UpdateStudentInput }

export function listStudents(includeArchived = false): Student[] {
  const db = getDb()
  const rows = db
    .select()
    .from(students)
    .orderBy(asc(students.lastName), asc(students.firstName))
    .all() as Student[]
  return includeArchived ? rows : rows.filter((s) => !s.archived)
}

export function getStudent(id: string): Student | undefined {
  return getDb().select().from(students).where(eq(students.id, id)).get() as Student | undefined
}

export function createStudent(input: CreateStudentInput): Student {
  const now = nowIso()
  const row: Student = { id: newId(), createdAt: now, updatedAt: now, archived: false, ...input }
  getDb().insert(students).values(row).run()
  return row
}

export function updateStudent(id: string, patch: UpdateStudentInput): Student {
  getDb()
    .update(students)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(students.id, id))
    .run()
  const updated = getStudent(id)
  if (!updated) throw new Error(`Student ${id} not found after update`)
  return updated
}

export function deleteStudent(id: string): void {
  getDb().delete(students).where(eq(students.id, id)).run()
}
