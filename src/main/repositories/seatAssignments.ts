import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { seatAssignments } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { SeatAssignment } from '@shared/types'

export function listSeatAssignments(classId: string): SeatAssignment[] {
  return getDb()
    .select()
    .from(seatAssignments)
    .where(eq(seatAssignments.classId, classId))
    .all() as SeatAssignment[]
}

/** Places a student in a seat. If another student already occupies that seat, the two
 * swap places (rather than leaving the first student seatless) — the natural behavior
 * for dragging one student onto another in a seating chart. */
export function assignSeat(classId: string, studentId: string, row: number, col: number): void {
  const db = getDb()
  const all = listSeatAssignments(classId)
  const mover = all.find((s) => s.studentId === studentId)
  const occupant = all.find((s) => s.row === row && s.col === col && s.studentId !== studentId)
  const now = nowIso()

  if (occupant && mover) {
    db.update(seatAssignments)
      .set({ row: mover.row, col: mover.col, updatedAt: now })
      .where(eq(seatAssignments.id, occupant.id))
      .run()
  } else if (occupant) {
    db.delete(seatAssignments).where(eq(seatAssignments.id, occupant.id)).run()
  }

  if (mover) {
    db.update(seatAssignments)
      .set({ row, col, updatedAt: now })
      .where(eq(seatAssignments.id, mover.id))
      .run()
  } else {
    db.insert(seatAssignments)
      .values({ id: newId(), classId, studentId, row, col, updatedAt: now })
      .run()
  }
}

export function unassignSeat(classId: string, studentId: string): void {
  getDb()
    .delete(seatAssignments)
    .where(and(eq(seatAssignments.classId, classId), eq(seatAssignments.studentId, studentId)))
    .run()
}

export function clearSeatingChart(classId: string): void {
  getDb().delete(seatAssignments).where(eq(seatAssignments.classId, classId)).run()
}
