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
