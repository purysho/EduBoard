import { AppError } from '@shared/errorCodes'
import { and, asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { exitTicketResponses, exitTickets } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { ExitTicket, ExitTicketResponse } from '@shared/types'
import type { SubmitExitTicketResponseInput, UpsertExitTicketInput } from '@shared/inputs'

export type { UpsertExitTicketInput, SubmitExitTicketResponseInput }

/** Open and not past its closing time. */
export function isAcceptingResponses(ticket: ExitTicket, now: Date = new Date()): boolean {
  return ticket.isOpen && (!ticket.closesAt || new Date(ticket.closesAt) > now)
}

/** A session past its closing time is closed here, the first time anyone looks, so the
 * teacher's screen and the students' page agree without a timer running. */
function closeIfExpired(ticket: ExitTicket | undefined): ExitTicket | undefined {
  if (!ticket || !ticket.isOpen || isAcceptingResponses(ticket)) return ticket
  getDb()
    .update(exitTickets)
    .set({ isOpen: false, closesAt: null, updatedAt: nowIso() })
    .where(eq(exitTickets.id, ticket.id))
    .run()
  return { ...ticket, isOpen: false, closesAt: null }
}

export function getExitTicketByClass(classId: string): ExitTicket | undefined {
  return closeIfExpired(
    getDb().select().from(exitTickets).where(eq(exitTickets.classId, classId)).get() as
      ExitTicket | undefined
  )
}

export function getExitTicket(id: string): ExitTicket | undefined {
  return getDb().select().from(exitTickets).where(eq(exitTickets.id, id)).get() as
    ExitTicket | undefined
}

/** Creates or replaces the one exit ticket a class has (question set + title) — always
 * saved as a whole, like a rubric. Opening/closing the session is separate (setOpen). */
export function upsertExitTicket(input: UpsertExitTicketInput): ExitTicket {
  const db = getDb()
  const existing = getExitTicketByClass(input.classId)
  const now = nowIso()

  if (existing) {
    db.update(exitTickets)
      .set({ title: input.title, questions: input.questions, updatedAt: now })
      .where(eq(exitTickets.id, existing.id))
      .run()
    return getExitTicket(existing.id) as ExitTicket
  }

  const row: ExitTicket = {
    id: newId(),
    classId: input.classId,
    title: input.title,
    questions: input.questions,
    isOpen: false,
    closesAt: null,
    createdAt: now,
    updatedAt: now
  }
  db.insert(exitTickets).values(row).run()
  return row
}

/** Opens or closes a session. `autoCloseMinutes` makes an opened session close itself
 * that many minutes from now; null or 0 leaves it open until the teacher closes it. */
export function setExitTicketOpen(
  id: string,
  isOpen: boolean,
  autoCloseMinutes: number | null = null
): ExitTicket {
  const db = getDb()
  const closesAt =
    isOpen && autoCloseMinutes && autoCloseMinutes > 0
      ? new Date(Date.now() + autoCloseMinutes * 60_000).toISOString()
      : null
  db.update(exitTickets)
    .set({ isOpen, closesAt, updatedAt: nowIso() })
    .where(eq(exitTickets.id, id))
    .run()
  const updated = getExitTicket(id)
  if (!updated) throw new AppError('EB-0002', `Exit ticket ${id} not found after update`)
  return updated
}

export function listExitTicketResponses(exitTicketId: string): ExitTicketResponse[] {
  return getDb()
    .select()
    .from(exitTicketResponses)
    .where(eq(exitTicketResponses.exitTicketId, exitTicketId))
    .orderBy(asc(exitTicketResponses.submittedAt))
    .all() as ExitTicketResponse[]
}

export function clearExitTicketResponses(exitTicketId: string): void {
  getDb()
    .delete(exitTicketResponses)
    .where(eq(exitTicketResponses.exitTicketId, exitTicketId))
    .run()
}

/** Called from the local HTTP server (see services/exitTicketServer.ts), not the
 * renderer — a student's device posts directly to the server, which writes here. */
export function submitExitTicketResponse(input: SubmitExitTicketResponseInput): ExitTicketResponse {
  const db = getDb()
  const row: ExitTicketResponse = {
    id: newId(),
    exitTicketId: input.exitTicketId,
    studentName: input.studentName,
    studentId: input.studentId ?? null,
    answers: input.answers,
    submittedAt: nowIso()
  }
  db.transaction((tx) => {
    // One answer per student: a resubmission (a changed mind, or someone else sending
    // under their name) replaces the earlier one rather than piling up beside it.
    if (row.studentId) {
      tx.delete(exitTicketResponses)
        .where(
          and(
            eq(exitTicketResponses.exitTicketId, row.exitTicketId),
            eq(exitTicketResponses.studentId, row.studentId)
          )
        )
        .run()
    }
    tx.insert(exitTicketResponses).values(row).run()
  })
  return row
}
