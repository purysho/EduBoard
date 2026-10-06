// The EduBoard side of the ClassGraph round trip. A class goes out as a ClassGraph project, and
// ClassGraph's approved seating comes back as a hand-back file. Reading and matching live in
// @shared/classGraphHandback; this file is the only place that writes, and only after the
// teacher has seen the preview and confirmed it.
import { randomUUID } from 'crypto'
import { readFile, stat } from 'fs/promises'
import { AppError } from '@shared/errorCodes'
import { tr, trn } from '@shared/i18n'
import {
  buildClassGraphExport,
  classGraphDisplayName,
  ClassGraphHandbackError,
  parseClassGraphHandback,
  previewClassGraphSeating,
  type ClassGraphHandbackV1,
  type ClassGraphSeatingPreview
} from '@shared/classGraphHandback'
import { getSqlite } from '../db/client'
import { getClass, updateClass } from '../repositories/classes'
import { getRosterForClass } from '../repositories/enrollments'
import { assignSeat, clearSeatingChart, listSeatAssignments } from '../repositories/seatAssignments'

const MAX_HANDBACK_BYTES = 5 * 1024 * 1024
const MAX_GRID = 30

function classOrThrow(classId: string): NonNullable<ReturnType<typeof getClass>> {
  const cls = getClass(classId)
  if (!cls) throw new AppError('EB-0002', tr('That class no longer exists.'))
  return cls
}

/** The class as a ClassGraph Exchange v1 project: roster names and the seating grid only. */
export function exportClassForClassGraph(classId: string): {
  fileName: string
  project: Record<string, unknown>
} {
  const cls = classOrThrow(classId)
  // Only students currently in the class go to ClassGraph.
  const roster = getRosterForClass(classId).filter((r) => r.enrollment.status === 'active')
  const project = buildClassGraphExport({
    projectId: randomUUID(),
    exportedAt: new Date().toISOString(),
    classSection: cls,
    students: roster.map((r) => r.student),
    seats: listSeatAssignments(classId)
  })
  // Same allow-list as class handover file names: letters, numbers, space and ._-
  const stem =
    cls.name
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} ._-]/gu, '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'class'
  return { fileName: `${stem}.classgraph.json`, project }
}

export async function readClassGraphHandback(filePath: string): Promise<ClassGraphHandbackV1> {
  try {
    if ((await stat(filePath)).size > MAX_HANDBACK_BYTES) {
      throw new ClassGraphHandbackError('The file is larger than a hand-back can be')
    }
    return parseClassGraphHandback(await readFile(filePath, 'utf-8'))
  } catch (error) {
    if (error instanceof AppError) throw error
    const detail = error instanceof ClassGraphHandbackError ? ` (${error.message})` : ''
    throw new AppError(
      'EB-2009',
      tr('That file isn’t a ClassGraph seating hand-back EduBoard can use.') + detail
    )
  }
}

export function previewClassGraphSeatingForClass(
  classId: string,
  handback: ClassGraphHandbackV1
): ClassGraphSeatingPreview {
  const cls = classOrThrow(classId)
  // Everyone on the class's seating chart, the same list the Seating tab shows.
  const roster = getRosterForClass(classId)
  return previewClassGraphSeating(handback, {
    rows: cls.seatingRows,
    cols: cls.seatingCols,
    roster: roster.map((r) => ({ id: r.student.id, name: classGraphDisplayName(r.student) })),
    currentSeatCount: listSeatAssignments(classId).length
  })
}

/** Replaces the class's seating chart with ClassGraph's approved plan, in one transaction. */
export function applyClassGraphSeating(
  classId: string,
  handback: ClassGraphHandbackV1,
  options: { resizeGrid: boolean }
): { seated: number; gridResized: boolean } {
  const cls = classOrThrow(classId)
  const preview = previewClassGraphSeatingForClass(classId, handback)
  if (preview.unknownStudentIds.length > 0) {
    throw new AppError(
      'EB-2010',
      trn(
        '{n} student in the ClassGraph plan isn’t in this class.',
        '{n} students in the ClassGraph plan aren’t in this class.',
        preview.unknownStudentIds.length
      )
    )
  }
  const rows = Math.max(cls.seatingRows, preview.gridNeeded.rows)
  const cols = Math.max(cls.seatingCols, preview.gridNeeded.cols)
  if (!preview.gridFits) {
    if (!options.resizeGrid) {
      throw new AppError(
        'EB-2010',
        tr('The ClassGraph plan needs a {rows} × {cols} grid; this class’s grid is smaller.', {
          rows: preview.gridNeeded.rows,
          cols: preview.gridNeeded.cols
        })
      )
    }
    if (rows > MAX_GRID || cols > MAX_GRID) {
      throw new AppError(
        'EB-2010',
        tr('The ClassGraph plan needs a bigger seating grid than EduBoard supports.')
      )
    }
  }

  getSqlite().transaction(() => {
    if (!preview.gridFits) updateClass(classId, { seatingRows: rows, seatingCols: cols })
    clearSeatingChart(classId)
    for (const seat of preview.seats) assignSeat(classId, seat.studentId, seat.row, seat.col)
  })()
  return { seated: preview.seats.length, gridResized: !preview.gridFits }
}
