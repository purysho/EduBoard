import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { classes } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { ClassSection } from '@shared/types'
import type { CreateClassInput, UpdateClassInput } from '@shared/inputs'

export type { CreateClassInput, UpdateClassInput }

export function listClasses(includeArchived = false): ClassSection[] {
  const db = getDb()
  const rows = db.select().from(classes).orderBy(asc(classes.name)).all() as ClassSection[]
  return includeArchived ? rows : rows.filter((c) => !c.archived)
}

export function getClass(id: string): ClassSection | undefined {
  return getDb().select().from(classes).where(eq(classes.id, id)).get() as ClassSection | undefined
}

export function createClass(input: CreateClassInput): ClassSection {
  const now = nowIso()
  const row: ClassSection = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    archived: false,
    ...input
  }
  getDb().insert(classes).values(row).run()
  return row
}

export function updateClass(id: string, patch: UpdateClassInput): ClassSection {
  getDb()
    .update(classes)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(classes.id, id))
    .run()
  const updated = getClass(id)
  if (!updated) throw new Error(`Class ${id} not found after update`)
  return updated
}

export function deleteClass(id: string): void {
  getDb().delete(classes).where(eq(classes.id, id)).run()
}
