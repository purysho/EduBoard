import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { terms } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { Term } from '@shared/types'
import type { CreateTermInput, UpdateTermInput } from '@shared/inputs'

export type { CreateTermInput, UpdateTermInput }

export function listTerms(): Term[] {
  return getDb().select().from(terms).orderBy(asc(terms.sortOrder), asc(terms.name)).all() as Term[]
}

export function getTerm(id: string): Term | undefined {
  return getDb().select().from(terms).where(eq(terms.id, id)).get() as Term | undefined
}

export function createTerm(input: CreateTermInput): Term {
  const now = nowIso()
  const row: Term = { id: newId(), createdAt: now, updatedAt: now, ...input }
  getDb().insert(terms).values(row).run()
  return row
}

export function updateTerm(id: string, patch: UpdateTermInput): Term {
  getDb()
    .update(terms)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(terms.id, id))
    .run()
  const updated = getTerm(id)
  if (!updated) throw new Error(`Term ${id} not found after update`)
  return updated
}

export function deleteTerm(id: string): void {
  getDb().delete(terms).where(eq(terms.id, id)).run()
}
