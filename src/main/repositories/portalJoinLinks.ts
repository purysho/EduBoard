import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { portalJoinLinks } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { generateCode } from './portalInvites'
import type { PortalJoinLink } from '@shared/types'

// Join links for the Portal (see portal/routes/invites.js for what each kind does there).
// Revoked links are kept, not deleted: publishing them as revoked is what turns them off
// on the Portal.

function activeLinks(classId: string): PortalJoinLink[] {
  return getDb()
    .select()
    .from(portalJoinLinks)
    .where(and(eq(portalJoinLinks.classId, classId), eq(portalJoinLinks.revoked, false)))
    .all() as PortalJoinLink[]
}

/** Every link, revoked ones included, for publishing. */
export function listAllJoinLinks(): PortalJoinLink[] {
  return getDb().select().from(portalJoinLinks).all() as PortalJoinLink[]
}

export function listActiveJoinLinks(classId: string): PortalJoinLink[] {
  return activeLinks(classId)
}

function insertLink(
  classId: string,
  kind: PortalJoinLink['kind'],
  studentId: string | null
): PortalJoinLink {
  const link: PortalJoinLink = {
    id: newId(),
    classId,
    studentId,
    kind,
    code: generateCode(),
    revoked: false,
    createdAt: nowIso()
  }
  getDb().insert(portalJoinLinks).values(link).run()
  return link
}

/** Turns off the class's join link, if it has one. */
export function turnOffClassLink(classId: string): void {
  getDb()
    .update(portalJoinLinks)
    .set({ revoked: true })
    .where(
      and(
        eq(portalJoinLinks.classId, classId),
        eq(portalJoinLinks.kind, 'class_link'),
        eq(portalJoinLinks.revoked, false)
      )
    )
    .run()
}

/** A new join link for the class. Any previous one stops working, so this is also
 * "reset" for a link that was shared too widely. */
export function createClassLink(classId: string): PortalJoinLink {
  turnOffClassLink(classId)
  return insertLink(classId, 'class_link', null)
}

/** The student's personal link, creating it the first time. */
export function getOrCreateStudentLink(classId: string, studentId: string): PortalJoinLink {
  const existing = activeLinks(classId).find(
    (l) => l.kind === 'student' && l.studentId === studentId
  )
  return existing ?? insertLink(classId, 'student', studentId)
}
