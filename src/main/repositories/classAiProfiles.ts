import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { classAiProfiles } from '../db/schema'
import { nowIso } from '../db/util'
import {
  cleanClassAiProfile,
  isEmptyClassAiProfile,
  type ClassAiProfile
} from '@shared/classAiProfile'

/** The class's teaching profile; every field empty when the teacher hasn't written one. */
export function getClassAiProfile(classId: string): ClassAiProfile {
  const row = getDb()
    .select()
    .from(classAiProfiles)
    .where(eq(classAiProfiles.classId, classId))
    .get()
  return cleanClassAiProfile(row?.profile)
}

/** Saves the profile (cleaned); an all-empty profile removes the row. */
export function setClassAiProfile(classId: string, input: unknown): ClassAiProfile {
  const profile = cleanClassAiProfile(input)
  const db = getDb()
  if (isEmptyClassAiProfile(profile)) {
    db.delete(classAiProfiles).where(eq(classAiProfiles.classId, classId)).run()
    return profile
  }
  const updatedAt = nowIso()
  db.insert(classAiProfiles)
    .values({ classId, profile, updatedAt })
    .onConflictDoUpdate({ target: classAiProfiles.classId, set: { profile, updatedAt } })
    .run()
  return profile
}
