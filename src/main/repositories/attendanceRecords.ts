import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { attendanceRecords } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { AttendanceRecord } from '@shared/types'
import type { MarkAttendanceInput } from '@shared/inputs'

export type { MarkAttendanceInput }

export function listAttendanceByClass(classId: string): AttendanceRecord[] {
  return getDb()
    .select()
    .from(attendanceRecords)
    .where(eq(attendanceRecords.classId, classId))
    .all() as AttendanceRecord[]
}

export function listAttendanceByStudentAndClass(
  studentId: string,
  classId: string
): AttendanceRecord[] {
  return getDb()
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.classId, classId), eq(attendanceRecords.studentId, studentId)))
    .all() as AttendanceRecord[]
}

/** Insert-or-update a single day's attendance cell (class x student x date is unique). */
export function markAttendance(input: MarkAttendanceInput): AttendanceRecord {
  const db = getDb()
  const existing = db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.classId, input.classId),
        eq(attendanceRecords.studentId, input.studentId),
        eq(attendanceRecords.date, input.date)
      )
    )
    .get() as AttendanceRecord | undefined

  if (existing) {
    const patch = { status: input.status, note: input.note ?? existing.note }
    db.update(attendanceRecords).set(patch).where(eq(attendanceRecords.id, existing.id)).run()
    return { ...existing, ...patch }
  }

  const row: AttendanceRecord = {
    id: newId(),
    classId: input.classId,
    studentId: input.studentId,
    date: input.date,
    status: input.status,
    note: input.note ?? null,
    createdAt: nowIso()
  }
  db.insert(attendanceRecords).values(row).run()
  return row
}

export function markAttendanceBulk(inputs: MarkAttendanceInput[]): void {
  getDb().transaction(() => {
    for (const input of inputs) markAttendance(input)
  })
}
