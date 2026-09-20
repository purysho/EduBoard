import { desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { lessonResources } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { LessonResource } from '@shared/types'
import type { CreateLessonResourceInput, UpdateLessonResourceInput } from '@shared/inputs'

export type { CreateLessonResourceInput, UpdateLessonResourceInput }

/** All resources, newest first. Filtering by search text/tag happens client-side in the
 * renderer (the library is expected to stay small — a personal collection, not a
 * shared database — so a full round-trip per keystroke isn't worth the complexity). */
export function listLessonResources(): LessonResource[] {
  return getDb()
    .select()
    .from(lessonResources)
    .orderBy(desc(lessonResources.updatedAt))
    .all() as LessonResource[]
}

export function createLessonResource(input: CreateLessonResourceInput): LessonResource {
  const now = nowIso()
  const row: LessonResource = {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    indexedAt: null,
    ...input
  }
  getDb().insert(lessonResources).values(row).run()
  return row
}

export function updateLessonResource(id: string, patch: UpdateLessonResourceInput): LessonResource {
  getDb()
    .update(lessonResources)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(lessonResources.id, id))
    .run()
  const updated = getDb().select().from(lessonResources).where(eq(lessonResources.id, id)).get() as
    LessonResource | undefined
  if (!updated) throw new Error(`Lesson resource ${id} not found after update`)
  return updated
}

export function deleteLessonResource(id: string): void {
  getDb().delete(lessonResources).where(eq(lessonResources.id, id)).run()
}

export function getLessonResource(id: string): LessonResource | undefined {
  return getDb().select().from(lessonResources).where(eq(lessonResources.id, id)).get() as
    LessonResource | undefined
}

export function touchLessonResourceIndexedAt(id: string): void {
  getDb()
    .update(lessonResources)
    .set({ indexedAt: nowIso() })
    .where(eq(lessonResources.id, id))
    .run()
}
