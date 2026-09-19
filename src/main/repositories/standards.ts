import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { standards } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { Standard } from '@shared/types'
import type { CreateStandardInput, UpdateStandardInput } from '@shared/inputs'

export type { CreateStandardInput, UpdateStandardInput }

export function listStandards(): Standard[] {
  return getDb().select().from(standards).orderBy(asc(standards.code)).all() as Standard[]
}

export function createStandard(input: CreateStandardInput): Standard {
  const row: Standard = { id: newId(), createdAt: nowIso(), ...input }
  getDb().insert(standards).values(row).run()
  return row
}

export function updateStandard(id: string, patch: UpdateStandardInput): Standard {
  getDb().update(standards).set(patch).where(eq(standards.id, id)).run()
  const updated = getDb().select().from(standards).where(eq(standards.id, id)).get() as
    Standard | undefined
  if (!updated) throw new Error(`Standard ${id} not found after update`)
  return updated
}

export function deleteStandard(id: string): void {
  getDb().delete(standards).where(eq(standards.id, id)).run()
}
