export interface ClassGraphHandbackSeatAssignment {
  studentId: string
  seatId: string
  row: number
  col: number
  locked: boolean
}

export interface ClassGraphHandbackV1 {
  format: 'classgraph-eduboard-handback'
  version: '1.0'
  project: {
    schemaVersion: '1.0'
    projectId: string
    title: string
    updatedAt: string
  }
  compatibility: {
    targetApplication: 'EduBoard'
    targetContractVersion: '1'
    requiresExplicitClassSelection: true
    studentIdMapping: 'exact-id-only'
    seatCoordinates: 'zero-based-row-col'
  }
  sourceData: {
    studentReferences: { studentId: string; displayName?: string }[]
    sourceFieldValues: {
      path: string
      kind: 'observed' | 'teacher-entered' | 'imported'
      value: unknown
    }[]
  }
  derivedAnalysis: unknown
  approvedPlanning: {
    room: unknown | null
    seed?: string
    seatAssignments: ClassGraphHandbackSeatAssignment[]
    unmappedSeatAssignments: {
      studentId: string
      seatId: string
      locked: boolean
      reason: 'seat-has-no-grid-coordinate'
    }[]
    groups: unknown[]
    rules: unknown[]
    approvedCandidateId?: string
  }
  syntheticPaths: string[]
  derivedPaths: string[]
  provenance: Record<string, unknown>
  extensions?: Record<string, unknown>
}

export interface ClassGraphSeatWrite {
  classId: string
  studentId: string
  row: number
  col: number
}

export class ClassGraphHandbackError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ClassGraphHandbackError'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function invalid(message: string): never {
  throw new ClassGraphHandbackError(message)
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${label} is missing or invalid`)
  return value
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${label} must be an array`)
  return value
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || Number(value) < 0) {
    invalid(`${label} must be a non-negative integer`)
  }
  return Number(value)
}

function parseSeatAssignment(value: unknown, index: number): ClassGraphHandbackSeatAssignment {
  if (!isRecord(value)) invalid(`approvedPlanning.seatAssignments[${index}] is invalid`)
  return {
    studentId: requiredString(
      value.studentId,
      `approvedPlanning.seatAssignments[${index}].studentId`
    ),
    seatId: requiredString(value.seatId, `approvedPlanning.seatAssignments[${index}].seatId`),
    row: nonNegativeInteger(value.row, `approvedPlanning.seatAssignments[${index}].row`),
    col: nonNegativeInteger(value.col, `approvedPlanning.seatAssignments[${index}].col`),
    locked: value.locked === true
  }
}

export function parseClassGraphHandback(json: string): ClassGraphHandbackV1 {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    invalid('The file is not valid JSON')
  }

  if (!isRecord(raw)) invalid('The hand-back file must be a JSON object')
  if (raw.format !== 'classgraph-eduboard-handback' || raw.version !== '1.0') {
    invalid('The file is not a supported ClassGraph → EduBoard hand-back')
  }

  const project = raw.project
  const compatibility = raw.compatibility
  const sourceData = raw.sourceData
  const planning = raw.approvedPlanning

  if (!isRecord(project) || project.schemaVersion !== '1.0') invalid('project is invalid')
  if (!isRecord(compatibility)) invalid('compatibility is invalid')
  if (
    compatibility.targetApplication !== 'EduBoard' ||
    compatibility.targetContractVersion !== '1' ||
    compatibility.requiresExplicitClassSelection !== true ||
    compatibility.studentIdMapping !== 'exact-id-only' ||
    compatibility.seatCoordinates !== 'zero-based-row-col'
  ) {
    invalid('compatibility contract is not supported by this EduBoard adapter')
  }
  if (!isRecord(sourceData)) invalid('sourceData is invalid')
  if (!isRecord(planning)) invalid('approvedPlanning is invalid')

  const syntheticPaths = requiredArray(raw.syntheticPaths, 'syntheticPaths').map((value, index) =>
    requiredString(value, `syntheticPaths[${index}]`)
  )
  const derivedPaths = requiredArray(raw.derivedPaths, 'derivedPaths').map((value, index) =>
    requiredString(value, `derivedPaths[${index}]`)
  )
  const unsafePaths = new Set([...syntheticPaths, ...derivedPaths])

  const studentReferences = requiredArray(
    sourceData.studentReferences,
    'sourceData.studentReferences'
  ).map((value, index) => {
    if (!isRecord(value)) invalid(`sourceData.studentReferences[${index}] is invalid`)
    const studentId = requiredString(
      value.studentId,
      `sourceData.studentReferences[${index}].studentId`
    )
    if (value.displayName !== undefined && typeof value.displayName !== 'string') {
      invalid(`sourceData.studentReferences[${index}].displayName is invalid`)
    }
    return {
      studentId,
      ...(typeof value.displayName === 'string' ? { displayName: value.displayName } : {})
    }
  })

  const sourceFieldValues = requiredArray(
    sourceData.sourceFieldValues,
    'sourceData.sourceFieldValues'
  ).map((value, index) => {
    if (!isRecord(value)) invalid(`sourceData.sourceFieldValues[${index}] is invalid`)
    const path = requiredString(value.path, `sourceData.sourceFieldValues[${index}].path`)
    if (unsafePaths.has(path)) {
      invalid(`sourceData.sourceFieldValues[${index}] points to derived or synthetic data`)
    }
    if (path.startsWith('/planning') || path.startsWith('/room')) {
      invalid(`sourceData.sourceFieldValues[${index}] contains planning data`)
    }
    if (!['observed', 'teacher-entered', 'imported'].includes(String(value.kind))) {
      invalid(`sourceData.sourceFieldValues[${index}].kind is not source-safe`)
    }
    return {
      path,
      kind: value.kind as 'observed' | 'teacher-entered' | 'imported',
      value: value.value
    }
  })

  const seatAssignments = requiredArray(
    planning.seatAssignments,
    'approvedPlanning.seatAssignments'
  ).map(parseSeatAssignment)

  const seenStudents = new Set<string>()
  const seenSeats = new Set<string>()
  for (const assignment of seatAssignments) {
    if (seenStudents.has(assignment.studentId)) invalid('A student has more than one approved seat')
    const position = `${assignment.row}:${assignment.col}`
    if (seenSeats.has(position)) invalid('Two students occupy the same approved seat')
    seenStudents.add(assignment.studentId)
    seenSeats.add(position)
  }

  const unmappedSeatAssignments = requiredArray(
    planning.unmappedSeatAssignments,
    'approvedPlanning.unmappedSeatAssignments'
  ).map((value, index) => {
    if (!isRecord(value)) {
      invalid(`approvedPlanning.unmappedSeatAssignments[${index}] is invalid`)
    }
    if (value.reason !== 'seat-has-no-grid-coordinate') {
      invalid(`approvedPlanning.unmappedSeatAssignments[${index}].reason is invalid`)
    }
    return {
      studentId: requiredString(
        value.studentId,
        `approvedPlanning.unmappedSeatAssignments[${index}].studentId`
      ),
      seatId: requiredString(
        value.seatId,
        `approvedPlanning.unmappedSeatAssignments[${index}].seatId`
      ),
      locked: value.locked === true,
      reason: 'seat-has-no-grid-coordinate' as const
    }
  })

  if (!isRecord(raw.provenance)) invalid('provenance is invalid')
  if (raw.extensions !== undefined && !isRecord(raw.extensions)) invalid('extensions is invalid')

  return {
    format: 'classgraph-eduboard-handback',
    version: '1.0',
    project: {
      schemaVersion: '1.0',
      projectId: requiredString(project.projectId, 'project.projectId'),
      title: typeof project.title === 'string' ? project.title : '',
      updatedAt: requiredString(project.updatedAt, 'project.updatedAt')
    },
    compatibility: {
      targetApplication: 'EduBoard',
      targetContractVersion: '1',
      requiresExplicitClassSelection: true,
      studentIdMapping: 'exact-id-only',
      seatCoordinates: 'zero-based-row-col'
    },
    sourceData: { studentReferences, sourceFieldValues },
    derivedAnalysis: raw.derivedAnalysis,
    approvedPlanning: {
      room: planning.room ?? null,
      ...(typeof planning.seed === 'string' ? { seed: planning.seed } : {}),
      seatAssignments,
      unmappedSeatAssignments,
      groups: requiredArray(planning.groups, 'approvedPlanning.groups'),
      rules: requiredArray(planning.rules, 'approvedPlanning.rules'),
      ...(typeof planning.approvedCandidateId === 'string'
        ? { approvedCandidateId: planning.approvedCandidateId }
        : {})
    },
    syntheticPaths,
    derivedPaths,
    provenance: raw.provenance,
    ...(raw.extensions ? { extensions: raw.extensions } : {})
  }
}

export function planClassGraphSeatWrites(
  handback: ClassGraphHandbackV1,
  classId: string,
  knownStudentIds: Iterable<string>
): ClassGraphSeatWrite[] {
  if (!classId.trim()) invalid('A target EduBoard class must be selected explicitly')
  const known = new Set(knownStudentIds)

  return handback.approvedPlanning.seatAssignments.map((assignment) => {
    if (!known.has(assignment.studentId)) {
      invalid(
        `Student ${assignment.studentId} is not a known EduBoard student; exact ID mapping is required`
      )
    }
    return {
      classId,
      studentId: assignment.studentId,
      row: assignment.row,
      col: assignment.col
    }
  })
}

// --- EduBoard → ClassGraph -------------------------------------------------------------------
// A class goes to ClassGraph as an Exchange v1 project. Student IDs are EduBoard's own, so a
// hand-back can be matched to the same students exactly. Only the roster names and the seating
// grid leave EduBoard; grades, attendance, notes and custom fields don't.

const CJK_NAME = /[㐀-鿿豈-﫿]/

/** Same rule as the renderer's studentFullName: Chinese names family name first. */
export function classGraphDisplayName(student: { firstName: string; lastName: string }): string {
  if (CJK_NAME.test(student.firstName) && CJK_NAME.test(student.lastName)) {
    return `${student.lastName}${student.firstName}`
  }
  return `${student.firstName} ${student.lastName}`.trim()
}

/** ClassGraph's grid seat IDs (src/room.ts in ClassGraph): 1-based in the ID, 0-based fields. */
export function classGraphSeatId(row: number, col: number): string {
  return `seat-r${row + 1}-c${col + 1}`
}

export interface ClassGraphExportInput {
  projectId: string
  exportedAt: string
  classSection: {
    id: string
    name: string
    subject: string | null
    gradeLevel: string | null
    seatingRows: number
    seatingCols: number
  }
  students: { id: string; firstName: string; lastName: string }[]
  seats: { studentId: string; row: number; col: number }[]
}

export function buildClassGraphExport(input: ClassGraphExportInput): Record<string, unknown> {
  const { classSection } = input
  const rows = Math.max(1, classSection.seatingRows)
  const cols = Math.max(1, classSection.seatingCols)
  const imported = { kind: 'imported', source: 'eduboard' }
  const enrolled = new Set(input.students.map((student) => student.id))
  const provenance: Record<string, unknown> = { '/room': imported }

  const students = input.students.map((student, index) => {
    provenance[`/students/${index}/id`] = imported
    provenance[`/students/${index}/displayName`] = imported
    return { id: student.id, displayName: classGraphDisplayName(student), metrics: {} }
  })

  const seats: { id: string; row: number; column: number; enabled: boolean }[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      seats.push({ id: classGraphSeatId(row, col), row, column: col, enabled: true })
    }
  }

  const assignments = input.seats
    .filter((seat) => enrolled.has(seat.studentId) && seat.row < rows && seat.col < cols)
    .map((seat) => ({
      studentId: seat.studentId,
      seatId: classGraphSeatId(seat.row, seat.col),
      locked: false
    }))
  if (assignments.length > 0) provenance['/planning/assignments'] = imported

  return {
    schemaVersion: '1.0',
    projectId: input.projectId,
    title: classSection.name,
    createdAt: input.exportedAt,
    updatedAt: input.exportedAt,
    classInfo: {
      classId: classSection.id,
      ...(classSection.subject ? { subject: classSection.subject } : {}),
      ...(classSection.gradeLevel ? { gradeOrLevel: classSection.gradeLevel } : {})
    },
    metricDefinitions: [],
    students,
    room: { layout: 'grid', rows, columns: cols, front: 'top', seats },
    planning: { assignments, rules: [], groups: [] },
    provenance,
    extensions: {
      eduboard: { classId: classSection.id, exportedAt: input.exportedAt }
    }
  }
}

// --- ClassGraph → EduBoard preview -------------------------------------------------------------

export interface ClassGraphSeatingPreview {
  projectTitle: string
  projectUpdatedAt: string
  /** Seats that will be written, in reading order. */
  seats: { studentId: string; name: string; row: number; col: number }[]
  /** Students ClassGraph seated who aren't in this class. Any of these blocks the import. */
  unknownStudentIds: string[]
  /** ClassGraph seats with no grid position (custom rooms); they can't be placed. */
  unmappedSeatCount: number
  /** Grid size the plan needs, and whether the class's current grid already has room. */
  gridNeeded: { rows: number; cols: number }
  gridFits: boolean
  /** Students in this class the plan doesn't seat; they'll be unseated. */
  unseatedAfter: number
  /** Seats currently filled in this class; the import replaces them all. */
  currentSeatCount: number
}

export function previewClassGraphSeating(
  handback: ClassGraphHandbackV1,
  target: {
    rows: number
    cols: number
    roster: { id: string; name: string }[]
    currentSeatCount: number
  }
): ClassGraphSeatingPreview {
  const names = new Map(target.roster.map((student) => [student.id, student.name]))
  const assignments = [...handback.approvedPlanning.seatAssignments].sort(
    (a, b) => a.row - b.row || a.col - b.col
  )
  const seats = assignments
    .filter((assignment) => names.has(assignment.studentId))
    .map((assignment) => ({
      studentId: assignment.studentId,
      name: names.get(assignment.studentId) ?? assignment.studentId,
      row: assignment.row,
      col: assignment.col
    }))
  const gridNeeded = {
    rows: assignments.reduce((max, a) => Math.max(max, a.row + 1), 0),
    cols: assignments.reduce((max, a) => Math.max(max, a.col + 1), 0)
  }
  const seated = new Set(seats.map((seat) => seat.studentId))
  return {
    projectTitle: handback.project.title,
    projectUpdatedAt: handback.project.updatedAt,
    seats,
    unknownStudentIds: assignments
      .filter((assignment) => !names.has(assignment.studentId))
      .map((assignment) => assignment.studentId),
    unmappedSeatCount: handback.approvedPlanning.unmappedSeatAssignments.length,
    gridNeeded,
    gridFits: gridNeeded.rows <= target.rows && gridNeeded.cols <= target.cols,
    unseatedAfter: target.roster.filter((student) => !seated.has(student.id)).length,
    currentSeatCount: target.currentSeatCount
  }
}
