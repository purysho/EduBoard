import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { courseGroups } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { CourseGroup } from '@shared/types'
import type { CreateCourseGroupInput } from '@shared/inputs'

export type { CreateCourseGroupInput }

export function listCourseGroups(): CourseGroup[] {
  return getDb().select().from(courseGroups).orderBy(asc(courseGroups.name)).all() as CourseGroup[]
}

export function createCourseGroup(input: CreateCourseGroupInput): CourseGroup {
  const row: CourseGroup = { id: newId(), createdAt: nowIso(), ...input }
  getDb().insert(courseGroups).values(row).run()
  return row
}

export function renameCourseGroup(id: string, name: string): CourseGroup {
  getDb().update(courseGroups).set({ name }).where(eq(courseGroups.id, id)).run()
  const updated = getDb().select().from(courseGroups).where(eq(courseGroups.id, id)).get() as
    CourseGroup | undefined
  if (!updated) throw new Error(`Course group ${id} not found after update`)
  return updated
}

export function deleteCourseGroup(id: string): void {
  getDb().delete(courseGroups).where(eq(courseGroups.id, id)).run()
}
