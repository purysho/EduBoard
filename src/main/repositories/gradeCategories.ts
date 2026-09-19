import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { gradeCategories } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { GradeCategory } from '@shared/types'
import type { CreateGradeCategoryInput, UpdateGradeCategoryInput } from '@shared/inputs'

export type { CreateGradeCategoryInput, UpdateGradeCategoryInput }

export function listGradeCategories(classId: string): GradeCategory[] {
  return getDb()
    .select()
    .from(gradeCategories)
    .where(eq(gradeCategories.classId, classId))
    .orderBy(asc(gradeCategories.sortOrder), asc(gradeCategories.name))
    .all() as GradeCategory[]
}

export function createGradeCategory(input: CreateGradeCategoryInput): GradeCategory {
  const row: GradeCategory = { id: newId(), createdAt: nowIso(), ...input }
  getDb().insert(gradeCategories).values(row).run()
  return row
}

export function updateGradeCategory(id: string, patch: UpdateGradeCategoryInput): GradeCategory {
  getDb().update(gradeCategories).set(patch).where(eq(gradeCategories.id, id)).run()
  const updated = getDb().select().from(gradeCategories).where(eq(gradeCategories.id, id)).get() as
    GradeCategory | undefined
  if (!updated) throw new Error(`Grade category ${id} not found after update`)
  return updated
}

export function deleteGradeCategory(id: string): void {
  getDb().delete(gradeCategories).where(eq(gradeCategories.id, id)).run()
}
