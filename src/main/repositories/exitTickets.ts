import { asc, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { exitTicketResponses, exitTickets } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { ExitTicket, ExitTicketResponse } from '@shared/types'
import type { SubmitExitTicketResponseInput, UpsertExitTicketInput } from '@shared/inputs'

export type { UpsertExitTicketInput, SubmitExitTicketResponseInput }

export function getExitTicketByClass(classId: string): ExitTicket | undefined {
  return getDb().select().from(exitTickets).where(eq(exitTickets.classId, classId)).get() as
    ExitTicket | undefined
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
    return { ...existing, title: input.title, questions: input.questions, updatedAt: now }
  }

  const row: ExitTicket = {
    id: newId(),
    classId: input.classId,
    title: input.title,
    questions: input.questions,
    isOpen: false,
    createdAt: now,
    updatedAt: now
  }
  db.insert(exitTickets).values(row).run()
  return row
}

export function setExitTicketOpen(id: string, isOpen: boolean): ExitTicket {
  const db = getDb()
  db.update(exitTickets).set({ isOpen, updatedAt: nowIso() }).where(eq(exitTickets.id, id)).run()
  const updated = getExitTicket(id)
  if (!updated) throw new Error(`Exit ticket ${id} not found after update`)
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
  const row: ExitTicketResponse = {
    id: newId(),
    exitTicketId: input.exitTicketId,
    studentName: input.studentName,
    answers: input.answers,
    submittedAt: nowIso()
  }
  getDb().insert(exitTicketResponses).values(row).run()
  return row
}
