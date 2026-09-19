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

/** Saves a rubric's whole criteria/levels tree in one transaction — the builder always
 * submits the complete tree rather than diffing individual rows client-side, since
 * criteria and levels are edited together as a unit. Server-side, though, this reuses
 * ids the caller already had (an existing criterion/level being edited) rather than
 * deleting and recreating everything: rubric_scores references criterion/level ids, so
 * blanket delete-and-recreate would cascade-delete a class's existing rubric grading
 * detail (the computed score in `scores` would survive, but the per-criterion
 * breakdown would silently vanish) every time a teacher just fixed a typo. Only
 * criteria/levels actually removed from the draft are deleted. */
function writeCriteriaTree(rubricId: string, criteria: CreateRubricInput['criteria']): void {
  const db = getDb()

  const existingCriterionIds = new Set(
    (
      db
        .select({ id: rubricCriteria.id })
        .from(rubricCriteria)
        .where(eq(rubricCriteria.rubricId, rubricId))
        .all() as { id: string }[]
    ).map((c) => c.id)
  )
  const keptCriterionIds = new Set(criteria.map((c) => c.id).filter((id): id is string => !!id))
  const removedCriterionIds = [...existingCriterionIds].filter((id) => !keptCriterionIds.has(id))
  if (removedCriterionIds.length) {
    db.delete(rubricCriteria).where(inArray(rubricCriteria.id, removedCriterionIds)).run()
  }

  criteria.forEach((criterion, criterionIndex) => {
    const criterionId = criterion.id ?? newId()
    const isExistingCriterion = criterion.id && existingCriterionIds.has(criterion.id)

    if (isExistingCriterion) {
      db.update(rubricCriteria)
        .set({
          standardId: criterion.standardId ?? null,
          name: criterion.name,
          description: criterion.description ?? null,
          sortOrder: criterionIndex
        })
        .where(eq(rubricCriteria.id, criterionId))
        .run()
    } else {
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
    }

    const existingLevelIds = new Set(
      (
        db
          .select({ id: rubricLevels.id })
          .from(rubricLevels)
          .where(eq(rubricLevels.criterionId, criterionId))
          .all() as { id: string }[]
      ).map((l) => l.id)
    )
    const keptLevelIds = new Set(
      criterion.levels.map((l) => l.id).filter((id): id is string => !!id)
    )
    const removedLevelIds = [...existingLevelIds].filter((id) => !keptLevelIds.has(id))
    if (removedLevelIds.length) {
      db.delete(rubricLevels).where(inArray(rubricLevels.id, removedLevelIds)).run()
    }

    criterion.levels.forEach((level, levelIndex) => {
      const levelId = level.id ?? newId()
      const isExistingLevel = level.id && existingLevelIds.has(level.id)

      if (isExistingLevel) {
        db.update(rubricLevels)
          .set({
            label: level.label,
            points: level.points,
            description: level.description ?? null,
            sortOrder: levelIndex
          })
          .where(eq(rubricLevels.id, levelId))
          .run()
      } else {
        db.insert(rubricLevels)
          .values({
            id: levelId,
            criterionId,
            label: level.label,
            points: level.points,
            description: level.description ?? null,
            sortOrder: levelIndex
          })
          .run()
      }
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
