import { and, eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { attendanceRecords } from '../db/schema'
import { newId, nowIso } from '../db/util'
import { recordAudit } from './auditLog'
import type { AttendanceRecord } from '@shared/types'
import type { MarkAttendanceInput } from '@shared/inputs'
import { tr } from '@shared/i18n'
import { resolveAttendanceCodes } from '@shared/attendanceCodes'
import { getSettings } from './settingsRepo'

export type { MarkAttendanceInput }

/** A code's name as the school calls it, for the audit log. */
function codeLabel(status: string): string {
  return (
    resolveAttendanceCodes(getSettings().attendanceCodes).find((c) => c.id === status)?.label ??
    status
  )
}

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
    // A note left out keeps the old one; null clears it.
    const patch = {
      status: input.status,
      note: input.note === undefined ? existing.note : input.note
    }
    db.update(attendanceRecords).set(patch).where(eq(attendanceRecords.id, existing.id)).run()
    if (patch.status !== existing.status) {
      recordAudit({
        entityType: 'attendance',
        entityId: existing.id,
        action: 'update',
        summary: tr('Attendance on {date} changed to “{status}”', {
          date: input.date,
          status: codeLabel(patch.status)
        }),
        studentId: input.studentId,
        classId: input.classId
      })
    }
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
  recordAudit({
    entityType: 'attendance',
    entityId: row.id,
    action: 'create',
    summary: tr('Attendance on {date} marked “{status}”', {
      date: input.date,
      status: codeLabel(input.status)
    }),
    studentId: input.studentId,
    classId: input.classId
  })
  return row
}

export function markAttendanceBulk(inputs: MarkAttendanceInput[]): void {
  getDb().transaction(() => {
    for (const input of inputs) markAttendance(input)
  })
}
