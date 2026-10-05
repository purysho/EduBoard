import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { classHelperRules } from '../db/schema'
import { nowIso } from '../db/util'
import {
  cleanStudyHelperRules,
  isEmptyStudyHelperRules,
  type StudyHelperRules
} from '@shared/studyHelperRules'

/** The class's Study Helper rules; all empty when the teacher hasn't set any. */
export function getClassHelperRules(classId: string): StudyHelperRules {
  const row = getDb()
    .select()
    .from(classHelperRules)
    .where(eq(classHelperRules.classId, classId))
    .get()
  return cleanStudyHelperRules(row?.rules)
}

/** Saves the rules (cleaned); empty rules remove the row. */
export function setClassHelperRules(classId: string, input: unknown): StudyHelperRules {
  const rules = cleanStudyHelperRules(input)
  const db = getDb()
  if (isEmptyStudyHelperRules(rules)) {
    db.delete(classHelperRules).where(eq(classHelperRules.classId, classId)).run()
    return rules
  }
  const updatedAt = nowIso()
  db.insert(classHelperRules)
    .values({ classId, rules, updatedAt })
    .onConflictDoUpdate({ target: classHelperRules.classId, set: { rules, updatedAt } })
    .run()
  return rules
}

/** Every class's rules that are set, by class id: what a publish sends. */
export function listClassHelperRules(): Map<string, StudyHelperRules> {
  return new Map(
    getDb()
      .select()
      .from(classHelperRules)
      .all()
      .map((row) => [row.classId, cleanStudyHelperRules(row.rules)])
  )
}
