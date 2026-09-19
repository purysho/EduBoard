import { asc, eq, inArray } from 'drizzle-orm'
import { getDb } from '../db/client'
import { rubrics, rubricCriteria, rubricLevels } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { Rubric, RubricCriterion, RubricLevel, RubricWithCriteria } from '@shared/types'
import type { CreateRubricInput, UpdateRubricInput } from '@shared/inputs'

export type { CreateRubricInput, UpdateRubricInput }

function attachCriteria(rubric: Rubric): RubricWithCriteria {
  const db = getDb()
  const criteria = db
    .select()
    .from(rubricCriteria)
    .where(eq(rubricCriteria.rubricId, rubric.id))
    .orderBy(asc(rubricCriteria.sortOrder))
    .all() as RubricCriterion[]

  const criterionIds = criteria.map((c) => c.id)
  const levels = criterionIds.length
    ? (db
        .select()
        .from(rubricLevels)
        .where(inArray(rubricLevels.criterionId, criterionIds))
        .orderBy(asc(rubricLevels.sortOrder))
        .all() as RubricLevel[])
    : []

  const levelsByCriterion = new Map<string, RubricLevel[]>()
  for (const level of levels) {
    const list = levelsByCriterion.get(level.criterionId) ?? []
    list.push(level)
    levelsByCriterion.set(level.criterionId, list)
  }

  const criteriaWithLevels = criteria.map((c) => ({
    ...c,
    levels: levelsByCriterion.get(c.id) ?? []
  }))

  const maxPoints = criteriaWithLevels.reduce((sum, c) => {
    const best = c.levels.reduce((max, l) => Math.max(max, l.points), 0)
    return sum + best
  }, 0)

  return { ...rubric, criteria: criteriaWithLevels, maxPoints }
}

export function listRubrics(): RubricWithCriteria[] {
  const rows = getDb().select().from(rubrics).orderBy(asc(rubrics.name)).all() as Rubric[]
  return rows.map(attachCriteria)
}

export function getRubric(id: string): RubricWithCriteria | undefined {
  const row = getDb().select().from(rubrics).where(eq(rubrics.id, id)).get() as Rubric | undefined
  return row ? attachCriteria(row) : undefined
}

/** Replaces a rubric's whole criteria/levels tree in one transaction — the builder
 * always saves the complete tree rather than diffing individual rows, since criteria
 * and levels are edited together as a unit and there's no meaningful "partial" save. */
function writeCriteriaTree(rubricId: string, criteria: CreateRubricInput['criteria']): void {
  const db = getDb()
  db.delete(rubricCriteria).where(eq(rubricCriteria.rubricId, rubricId)).run()

  criteria.forEach((criterion, criterionIndex) => {
    const criterionId = newId()
    db.insert(rubricCriteria)
      .values({
        id: criterionId,
        rubricId,
        standardId: criterion.standardId ?? null,
        name: criterion.name,
        description: criterion.description ?? null,
        sortOrder: criterionIndex,
        createdAt: nowIso()
      })
      .run()

    criterion.levels.forEach((level, levelIndex) => {
      db.insert(rubricLevels)
        .values({
          id: newId(),
          criterionId,
          label: level.label,
          points: level.points,
          description: level.description ?? null,
          sortOrder: levelIndex
        })
        .run()
    })
  })
}

export function createRubric(input: CreateRubricInput): RubricWithCriteria {
  const db = getDb()
  const id = newId()
  const now = nowIso()

  db.transaction(() => {
    db.insert(rubrics)
      .values({
        id,
        name: input.name,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now
      })
      .run()
    writeCriteriaTree(id, input.criteria)
  })

  const created = getRubric(id)
  if (!created) throw new Error(`Rubric ${id} not found after create`)
  return created
}

export function updateRubric(id: string, input: UpdateRubricInput): RubricWithCriteria {
  const db = getDb()

  db.transaction(() => {
    db.update(rubrics)
      .set({ name: input.name, description: input.description ?? null, updatedAt: nowIso() })
      .where(eq(rubrics.id, id))
      .run()
    writeCriteriaTree(id, input.criteria)
  })

  const updated = getRubric(id)
  if (!updated) throw new Error(`Rubric ${id} not found after update`)
  return updated
}

export function deleteRubric(id: string): void {
  getDb().delete(rubrics).where(eq(rubrics.id, id)).run()
}
