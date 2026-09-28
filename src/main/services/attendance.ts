import type { AttendanceStatus } from '@shared/types'

export interface AttendanceRecordLike {
  status: string
}

export interface AttendanceCounts {
  present: number
  late: number
  absent: number
  excused: number
  rate: number | null
}

/**
 * Present and late both count as "attended". Excused (and any date with no record at
 * all) is left out of the denominator entirely, so a student's rate reflects only the
 * days they were expected to show up.
 */
export function computeAttendanceCounts(
  records: AttendanceRecordLike[],
  /** How each record's code counts; the school's own codes map to one of the four. */
  countsAs: (status: string) => AttendanceStatus = (s) => s as AttendanceStatus
): AttendanceCounts {
  return countAttendanceTallies(
    records.map((r) => ({ status: r.status, n: 1 })),
    countsAs
  )
}

/** The same counts from tallies: `n` records with each code (see
 * tallyAttendanceByClass), so a year's register needn't be read record by record. */
export function countAttendanceTallies(
  tallies: { status: string; n: number }[],
  countsAs: (status: string) => AttendanceStatus = (s) => s as AttendanceStatus
): AttendanceCounts {
  let present = 0
  let late = 0
  let absent = 0
  let excused = 0

  for (const { status, n } of tallies) {
    const kind = countsAs(status)
    if (kind === 'present') present += n
    else if (kind === 'late') late += n
    else if (kind === 'absent') absent += n
    else if (kind === 'excused') excused += n
  }

  const countedTotal = present + late + absent
  const rate = countedTotal > 0 ? (present + late) / countedTotal : null

  return { present, late, absent, excused, rate }
}
