import { AppError } from '@shared/errorCodes'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { lessonResources } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { AiMaterialKind, LessonResource } from '@shared/types'
import type { Flashcard, PracticeQuestion } from '@shared/practiceSets'
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
    flashcards: null,
    practiceQuiz: null,
    ...input,
    // A guide the teacher wrote in themselves needs no checking.
    aiApproved: { studyGuide: !!input.studyGuide }
  }
  getDb().insert(lessonResources).values(row).run()
  return row
}

export function updateLessonResource(id: string, patch: UpdateLessonResourceInput): LessonResource {
  const before = getLessonResource(id)
  // A study guide the teacher changed by hand is one they've read.
  const aiApproved =
    before && patch.studyGuide !== undefined && patch.studyGuide !== before.studyGuide
      ? { ...before.aiApproved, studyGuide: !!patch.studyGuide }
      : undefined
  getDb()
    .update(lessonResources)
    .set({ ...patch, ...(aiApproved ? { aiApproved } : {}), updatedAt: nowIso() })
    .where(eq(lessonResources.id, id))
    .run()
  const updated = getDb().select().from(lessonResources).where(eq(lessonResources.id, id)).get() as
    LessonResource | undefined
  if (!updated) throw new AppError('EB-0002', `Lesson resource ${id} not found after update`)
  return updated
}

export function deleteLessonResource(id: string): void {
  getDb().delete(lessonResources).where(eq(lessonResources.id, id)).run()
}

export function getLessonResource(id: string): LessonResource | undefined {
  return getDb().select().from(lessonResources).where(eq(lessonResources.id, id)).get() as
    LessonResource | undefined
}

/** Saves an AI-drafted study guide. It waits for the teacher's check before students see it. */
export function setLessonResourceStudyGuide(id: string, studyGuide: string | null): void {
  const approval = { ...getLessonResource(id)?.aiApproved, studyGuide: false }
  getDb()
    .update(lessonResources)
    .set({ studyGuide, aiApproved: approval, updatedAt: nowIso() })
    .where(eq(lessonResources.id, id))
    .run()
}

export type PracticeSetKind = 'flashcards' | 'quiz'

/** Saves (or with null, removes) one of a resource's validated practice sets. A new set
 * waits for the teacher's check before students see it. */
export function setLessonResourcePracticeSet(
  id: string,
  kind: PracticeSetKind,
  value: Flashcard[] | PracticeQuestion[] | null
): void {
  const approval = {
    ...getLessonResource(id)?.aiApproved,
    [kind === 'flashcards' ? 'flashcards' : 'practiceQuiz']: false
  }
  getDb()
    .update(lessonResources)
    .set(
      kind === 'flashcards'
        ? { flashcards: value as Flashcard[] | null, aiApproved: approval, updatedAt: nowIso() }
        : {
            practiceQuiz: value as PracticeQuestion[] | null,
            aiApproved: approval,
            updatedAt: nowIso()
          }
    )
    .where(eq(lessonResources.id, id))
    .run()
}

/** Saves practice material authored or directly edited by the teacher. Unlike an AI
 * draft it is immediately approved, because the teacher is the author and has already
 * reviewed the content while entering it. */
export function setLessonResourceManualPracticeSet(
  id: string,
  kind: PracticeSetKind,
  value: Flashcard[] | PracticeQuestion[] | null
): LessonResource {
  const resource = getLessonResource(id)
  if (!resource) throw new AppError('EB-0002', `Lesson resource ${id} not found`)
  const key = kind === 'flashcards' ? 'flashcards' : 'practiceQuiz'
  const approval = { ...resource.aiApproved, [key]: !!value?.length }
  getDb()
    .update(lessonResources)
    .set(
      kind === 'flashcards'
        ? { flashcards: value as Flashcard[] | null, aiApproved: approval, updatedAt: nowIso() }
        : {
            practiceQuiz: value as PracticeQuestion[] | null,
            aiApproved: approval,
            updatedAt: nowIso()
          }
    )
    .where(eq(lessonResources.id, id))
    .run()
  return getLessonResource(id) as LessonResource
}

/** The teacher has checked (or withdrawn) one of the resource's AI drafts. Only
 * something that exists can be approved. */
export function setLessonResourceAiApproval(
  id: string,
  kind: AiMaterialKind,
  approved: boolean
): LessonResource {
  const resource = getLessonResource(id)
  if (!resource) throw new AppError('EB-0002', `Lesson resource ${id} not found`)
  const exists = !!resource[kind]
  getDb()
    .update(lessonResources)
    .set({ aiApproved: { ...resource.aiApproved, [kind]: approved && exists } })
    .where(eq(lessonResources.id, id))
    .run()
  return getLessonResource(id) as LessonResource
}

export function touchLessonResourceIndexedAt(id: string): void {
  getDb()
    .update(lessonResources)
    .set({ indexedAt: nowIso() })
    .where(eq(lessonResources.id, id))
    .run()
}
