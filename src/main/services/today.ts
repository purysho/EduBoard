// The Dashboard's day and month at a glance: today's lessons from the timetable, and
// students worth checking on.
import { and, eq, gte } from 'drizzle-orm'
import { getDb } from '../db/client'
import { attendanceRecords, studentLogEntries } from '../db/schema'
import { listAllScheduleSlots } from '../repositories/classScheduleSlots'
import { listLessonPlansByClass } from '../repositories/lessonPlans'
import { listClasses } from '../repositories/classes'
import { getRosterForClass } from '../repositories/enrollments'
import { getClassGrades, gradeTrendsByStudent } from './reports'
import { watchReasons } from '@shared/watchList'
import type { TodayOverview, WatchListEntry } from '@shared/types'
import { localDateIso } from '@shared/dates'

export { localDateIso }

export function getTodayOverview(now: Date = new Date()): TodayOverview {
  const date = localDateIso(now)
  const lessons = listAllScheduleSlots()
    .filter((s) => s.dayOfWeek === now.getDay())
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((slot) => {
      const taken = !!getDb()
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(and(eq(attendanceRecords.classId, slot.classId), eq(attendanceRecords.date, date)))
        .get()
      const plan = listLessonPlansByClass(slot.classId).find((p) => p.date === date)
      return {
        classId: slot.classId,
        className: slot.className,
        classColor: slot.classColor,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room,
        attendanceTaken: taken,
        lessonPlanTitle: plan?.title ?? null
      }
    })
  const followUpsDue = getDb()
    .select({ id: studentLogEntries.id })
    .from(studentLogEntries)
    .where(
      and(eq(studentLogEntries.followUpNeeded, true), eq(studentLogEntries.followUpDone, false))
    )
    .all().length
  return { date, lessons, followUpsDue }
}

export function getWatchList(now: Date = new Date()): WatchListEntry[] {
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const concerns = new Map<string, number>()
  for (const e of getDb()
    .select({ studentId: studentLogEntries.studentId })
    .from(studentLogEntries)
    .where(and(eq(studentLogEntries.type, 'concern'), gte(studentLogEntries.createdAt, since)))
    .all()) {
    concerns.set(e.studentId, (concerns.get(e.studentId) ?? 0) + 1)
  }
  const entries: WatchListEntry[] = []
  for (const cls of listClasses(false)) {
    const grades = getClassGrades(cls.id)
    const trends = gradeTrendsByStudent(cls.id)
    for (const { student, enrollment } of getRosterForClass(cls.id)) {
      if (enrollment.status !== 'active') continue
      const reasons = watchReasons({
        percent: grades.get(student.id)?.percent ?? null,
        passMark: cls.passMark,
        trend: (trends.get(student.id) ?? []).map((p) => p.percent),
        recentConcerns: concerns.get(student.id) ?? 0
      })
      if (reasons.length) {
        entries.push({
          studentId: student.id,
          studentName: `${student.preferredName?.trim() || student.firstName} ${student.lastName}`,
          classId: cls.id,
          className: cls.name,
          reasons
        })
      }
    }
  }
  return entries.sort((a, b) => b.reasons.length - a.reasons.length)
}
