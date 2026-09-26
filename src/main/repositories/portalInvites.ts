import { randomBytes } from 'crypto'
import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { portalInviteBatches, portalInvites } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { PortalInvite, PortalInviteBatchWithInvites } from '@shared/types'
import type { CreatePortalInviteBatchInput } from '@shared/inputs'

export type { CreatePortalInviteBatchInput }

// Excludes visually-ambiguous characters (0/O, 1/I/L) so a handwritten or misread strip
// doesn't turn into a wrong-but-plausible code — this is the fallback typed path for a
// shared device; the everyday path is scan-the-QR / tap-the-bookmark, no typing at all.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** A random, non-guessable invite code, grouped for readability (e.g. "K7M2-PR9X").
 * 12 characters from a 32-symbol alphabet is ~60 bits of entropy — not brute-forceable,
 * and irrelevant to memorize since the QR/bookmark is the intended everyday path. */
export function generateCode(): string {
  const bytes = randomBytes(12)
  let raw = ''
  for (const byte of bytes) raw += CODE_ALPHABET[byte % CODE_ALPHABET.length]
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

export function createInviteBatch(
  input: CreatePortalInviteBatchInput
): PortalInviteBatchWithInvites {
  const db = getDb()
  const now = nowIso()
  const batchId = newId()

  db.insert(portalInviteBatches)
    .values({
      id: batchId,
      classId: input.classId,
      count: input.count,
      createdAt: now,
      printedAt: null
    })
    .run()

  const invites: PortalInvite[] = Array.from({ length: input.count }, () => ({
    id: newId(),
    batchId,
    classId: input.classId,
    code: generateCode(),
    revoked: false,
    claimedAt: null,
    createdAt: now
  }))
  for (const invite of invites) {
    db.insert(portalInvites).values(invite).run()
  }

  return {
    id: batchId,
    classId: input.classId,
    count: input.count,
    createdAt: now,
    printedAt: null,
    invites
  }
}

type BatchRow = {
  id: string
  classId: string
  count: number
  createdAt: string
  printedAt: string | null
}

export function listInviteBatchesByClass(classId: string): PortalInviteBatchWithInvites[] {
  const db = getDb()
  const batches = db
    .select()
    .from(portalInviteBatches)
    .where(eq(portalInviteBatches.classId, classId))
    .all() as BatchRow[]

  return batches.map((batch) => ({
    ...batch,
    invites: db
      .select()
      .from(portalInvites)
      .where(eq(portalInvites.batchId, batch.id))
      .all() as PortalInvite[]
  }))
}

export function getInviteBatch(batchId: string): PortalInviteBatchWithInvites | null {
  const db = getDb()
  const batch = db
    .select()
    .from(portalInviteBatches)
    .where(eq(portalInviteBatches.id, batchId))
    .get() as BatchRow | undefined
  if (!batch) return null

  const invites = db
    .select()
    .from(portalInvites)
    .where(eq(portalInvites.batchId, batchId))
    .all() as PortalInvite[]
  return { ...batch, invites }
}

export function revokeInvite(inviteId: string): void {
  getDb().update(portalInvites).set({ revoked: true }).where(eq(portalInvites.id, inviteId)).run()
}

/** Marked once printBatch actually completes the save (not just generates a PDF that
 * might have been cancelled at the file dialog) — see ipc/register.ts. */
export function markInviteBatchPrinted(batchId: string): void {
  getDb()
    .update(portalInviteBatches)
    .set({ printedAt: nowIso() })
    .where(eq(portalInviteBatches.id, batchId))
    .run()
}
