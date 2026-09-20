import { eq } from 'drizzle-orm'
import { getDb } from '../db/client'
import { classScheduleSlots, classes } from '../db/schema'
import { newId, nowIso } from '../db/util'
import type { ClassScheduleSlot, ClassScheduleSlotWithClass } from '@shared/types'
import type { CreateClassScheduleSlotInput, UpdateClassScheduleSlotInput } from '@shared/inputs'

export type { CreateClassScheduleSlotInput, UpdateClassScheduleSlotInput }

export function listScheduleSlotsByClass(classId: string): ClassScheduleSlot[] {
  return getDb()
    .select()
    .from(classScheduleSlots)
    .where(eq(classScheduleSlots.classId, classId))
    .all() as ClassScheduleSlot[]
}

/** Every slot across every (non-archived) class, with the class's name/color joined in
 * — what the Timetable page's weekly grid renders directly, without a per-slot lookup. */
export function listAllScheduleSlots(): ClassScheduleSlotWithClass[] {
  return getDb()
    .select({
      id: classScheduleSlots.id,
      classId: classScheduleSlots.classId,
      dayOfWeek: classScheduleSlots.dayOfWeek,
      startTime: classScheduleSlots.startTime,
      endTime: classScheduleSlots.endTime,
      room: classScheduleSlots.room,
      createdAt: classScheduleSlots.createdAt,
      className: classes.name,
      classColor: classes.color
    })
    .from(classScheduleSlots)
    .innerJoin(classes, eq(classScheduleSlots.classId, classes.id))
    .where(eq(classes.archived, false))
    .all() as ClassScheduleSlotWithClass[]
}

export function createScheduleSlot(input: CreateClassScheduleSlotInput): ClassScheduleSlot {
  const row: ClassScheduleSlot = { id: newId(), createdAt: nowIso(), ...input }
  getDb().insert(classScheduleSlots).values(row).run()
  return row
}

export function updateScheduleSlot(
  id: string,
  patch: UpdateClassScheduleSlotInput
): ClassScheduleSlot {
  getDb().update(classScheduleSlots).set(patch).where(eq(classScheduleSlots.id, id)).run()
  return getDb()
    .select()
    .from(classScheduleSlots)
    .where(eq(classScheduleSlots.id, id))
    .get() as ClassScheduleSlot
}

export function deleteScheduleSlot(id: string): void {
  getDb().delete(classScheduleSlots).where(eq(classScheduleSlots.id, id)).run()
}
