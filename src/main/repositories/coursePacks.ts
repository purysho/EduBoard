import { AppError } from '@shared/errorCodes'
import {
  parseCoursePack,
  serializeCoursePack,
  type CoursePack,
  type CurriculumSession,
  type ImportedCoursePack
} from '@shared/coursePack'
import { getSqlite } from '../db/client'
import { newId, nowIso } from '../db/util'
import { getSettings, updateSettings } from './settingsRepo'

export interface CoursePackImportResult {
  pack: ImportedCoursePack
  alreadyImported: boolean
  created: {
    courseGroup: boolean
    terms: number
    standards: number
    rubrics: number
    resources: number
    studentFields: number
    sessions: number
  }
}

function rowToPack(row: Record<string, unknown>): ImportedCoursePack {
  return {
    id: String(row.id),
    packId: String(row.pack_id),
    revision: Number(row.revision),
    name: String(row.name),
    description: row.description === null ? null : String(row.description),
    courseGroupId: String(row.course_group_id),
    importedAt: String(row.imported_at)
  }
}

export function listCoursePacks(): ImportedCoursePack[] {
  return (getSqlite()
    .prepare(
      'SELECT id, pack_id, revision, name, description, course_group_id, imported_at FROM course_packs ORDER BY name'
    )
    .all() as Record<string, unknown>[]).map(rowToPack)
}

export function getCoursePack(id: string): ImportedCoursePack | undefined {
  const row = getSqlite()
    .prepare(
      'SELECT id, pack_id, revision, name, description, course_group_id, imported_at FROM course_packs WHERE id = ?'
    )
    .get(id) as Record<string, unknown> | undefined
  return row ? rowToPack(row) : undefined
}

export function exportCoursePack(id: string): string {
  const row = getSqlite().prepare('SELECT source_json FROM course_packs WHERE id = ?').get(id) as
    | { source_json: string }
    | undefined
  if (!row) throw new AppError('EB-0002', 'Course Pack not found.')
  return row.source_json
}

export function listCurriculumSessions(coursePackId: string): CurriculumSession[] {
  const rows = getSqlite()
    .prepare(
      `SELECT id, course_pack_id, term_key, sequence, title, duration_minutes, optional,
              objectives, framework, materials, activities, homework,
              standard_codes, assessment_keys, resource_keys
       FROM curriculum_sessions
       WHERE course_pack_id = ?
       ORDER BY term_key, sequence`
    )
    .all(coursePackId) as Record<string, unknown>[]

  return rows.map((row) => ({
    id: String(row.id),
    coursePackId: String(row.course_pack_id),
    termKey: String(row.term_key),
    sequence: Number(row.sequence),
    title: String(row.title),
    durationMinutes: row.duration_minutes === null ? null : Number(row.duration_minutes),
    optional: Boolean(row.optional),
    objectives: row.objectives === null ? null : String(row.objectives),
    framework: row.framework === null ? null : String(row.framework),
    materials: row.materials === null ? null : String(row.materials),
    activities: row.activities === null ? null : String(row.activities),
    homework: row.homework === null ? null : String(row.homework),
    standardCodes: JSON.parse(String(row.standard_codes)) as string[],
    assessmentKeys: JSON.parse(String(row.assessment_keys)) as string[],
    resourceKeys: JSON.parse(String(row.resource_keys)) as string[]
  }))
}

function assertNoConflicts(pack: CoursePack): void {
  const sqlite = getSqlite()

  for (const standard of pack.standards) {
    const existing = sqlite
      .prepare('SELECT description, subject FROM standards WHERE code = ? COLLATE NOCASE LIMIT 1')
      .get(standard.code) as { description: string; subject: string | null } | undefined
    if (
      existing &&
      (existing.description !== standard.description || (existing.subject ?? null) !== standard.subject)
    ) {
      throw new AppError(
        'EB-2007',
        'Standard "' + standard.code + '" already exists with a different definition.'
      )
    }
  }

  for (const rubric of pack.rubrics) {
    const existing = sqlite
      .prepare('SELECT id FROM rubrics WHERE name = ? COLLATE NOCASE LIMIT 1')
      .get(rubric.name)
    if (existing) {
      throw new AppError(
        'EB-2007',
        'Rubric "' + rubric.name + '" already exists. Rename it or remove the conflict before importing.'
      )
    }
  }

  const currentFields = getSettings().studentFields ?? []
  const byId = new Map(currentFields.map((field) => [field.id, field]))
  for (const field of pack.studentFields) {
    const existing = byId.get(field.id)
    if (
      existing &&
      (existing.label !== field.label ||
        Boolean(existing.onSeatingChart) !== Boolean(field.onSeatingChart))
    ) {
      throw new AppError(
        'EB-2007',
        'Student field "' + field.id + '" already exists with a different definition.'
      )
    }
  }
}

export function importCoursePack(json: string): CoursePackImportResult {
  const pack = parseCoursePack(json)
  const sqlite = getSqlite()

  const already = sqlite
    .prepare(
      'SELECT id, pack_id, revision, name, description, course_group_id, imported_at FROM course_packs WHERE pack_id = ?'
    )
    .get(pack.packId) as Record<string, unknown> | undefined

  if (already) {
    const imported = rowToPack(already)
    if (imported.revision === pack.revision) {
      return {
        pack: imported,
        alreadyImported: true,
        created: {
          courseGroup: false,
          terms: 0,
          standards: 0,
          rubrics: 0,
          resources: 0,
          studentFields: 0,
          sessions: 0
        }
      }
    }
    throw new AppError(
      'EB-2007',
      'Course Pack "' +
        pack.packId +
        '" is already installed at revision ' +
        imported.revision +
        '. Remove it before importing a different revision.'
    )
  }

  assertNoConflicts(pack)

  const created = {
    courseGroup: false,
    terms: 0,
    standards: 0,
    rubrics: 0,
    resources: 0,
    studentFields: 0,
    sessions: 0
  }

  const transaction = sqlite.transaction((): ImportedCoursePack => {
    const now = nowIso()

    let courseGroup = sqlite
      .prepare('SELECT id FROM course_groups WHERE name = ? COLLATE NOCASE LIMIT 1')
      .get(pack.courseGroupName) as { id: string } | undefined
    if (!courseGroup) {
      courseGroup = { id: newId() }
      sqlite
        .prepare('INSERT INTO course_groups (id, name, created_at) VALUES (?, ?, ?)')
        .run(courseGroup.id, pack.courseGroupName, now)
      created.courseGroup = true
    }

    const packDbId = newId()
    sqlite
      .prepare(
        `INSERT INTO course_packs
          (id, pack_id, revision, name, description, course_group_id, source_json, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        packDbId,
        pack.packId,
        pack.revision,
        pack.name,
        pack.description,
        courseGroup.id,
        serializeCoursePack(pack),
        now
      )

    for (const term of pack.terms) {
      let existingTerm = sqlite
        .prepare(
          'SELECT id FROM terms WHERE name = ? COLLATE NOCASE AND school_year = ? COLLATE NOCASE LIMIT 1'
        )
        .get(term.name, term.schoolYear) as { id: string } | undefined
      if (!existingTerm) {
        existingTerm = { id: newId() }
        sqlite
          .prepare(
            `INSERT INTO terms
              (id, name, school_year, start_date, end_date, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            existingTerm.id,
            term.name,
            term.schoolYear,
            term.startDate,
            term.endDate,
            term.sortOrder,
            now,
            now
          )
        created.terms++
      }
      sqlite
        .prepare(
          'INSERT INTO course_pack_terms (id, course_pack_id, term_key, term_id, sort_order) VALUES (?, ?, ?, ?, ?)'
        )
        .run(newId(), packDbId, term.key, existingTerm.id, term.sortOrder)
    }

    const standardIds = new Map<string, string>()
    for (const standard of pack.standards) {
      let existing = sqlite
        .prepare('SELECT id FROM standards WHERE code = ? COLLATE NOCASE LIMIT 1')
        .get(standard.code) as { id: string } | undefined
      if (!existing) {
        existing = { id: newId() }
        sqlite
          .prepare(
            'INSERT INTO standards (id, code, description, subject, created_at) VALUES (?, ?, ?, ?, ?)'
          )
          .run(existing.id, standard.code, standard.description, standard.subject, now)
        created.standards++
      }
      standardIds.set(standard.code, existing.id)
    }

    for (const rubric of pack.rubrics) {
      const rubricId = newId()
      sqlite
        .prepare(
          'INSERT INTO rubrics (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(rubricId, rubric.name, rubric.description, now, now)
      created.rubrics++

      rubric.criteria.forEach((criterion, criterionIndex) => {
        const criterionId = newId()
        sqlite
          .prepare(
            `INSERT INTO rubric_criteria
              (id, rubric_id, standard_id, name, description, sort_order, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            criterionId,
            rubricId,
            criterion.standardCode ? (standardIds.get(criterion.standardCode) ?? null) : null,
            criterion.name,
            criterion.description,
            criterionIndex,
            now
          )
        criterion.levels.forEach((level, levelIndex) => {
          sqlite
            .prepare(
              `INSERT INTO rubric_levels
                (id, criterion_id, label, points, description, sort_order)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .run(newId(), criterionId, level.label, level.points, level.description, levelIndex)
        })
      })
    }

    for (const resource of pack.resources) {
      sqlite
        .prepare(
          `INSERT INTO lesson_resources
            (id, title, type, url, file_path, notes, tags, standard_id, created_at, updated_at,
             indexed_at, class_id, share_with_students, study_guide, flashcards, practice_quiz)
           VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, NULL, NULL)`
        )
        .run(
          newId(),
          resource.title,
          resource.type,
          resource.url,
          resource.notes,
          JSON.stringify(resource.tags),
          resource.standardCode ? (standardIds.get(resource.standardCode) ?? null) : null,
          now,
          now
        )
      created.resources++
    }

    const settings = getSettings()
    const existingFieldIds = new Set((settings.studentFields ?? []).map((field) => field.id))
    const newFields = pack.studentFields.filter((field) => !existingFieldIds.has(field.id))
    if (newFields.length) {
      updateSettings({ studentFields: [...(settings.studentFields ?? []), ...newFields] })
      created.studentFields = newFields.length
    }

    for (const session of pack.sessions) {
      sqlite
        .prepare(
          `INSERT INTO curriculum_sessions
            (id, course_pack_id, session_key, term_key, sequence, title, duration_minutes,
             optional, objectives, framework, materials, activities, homework,
             standard_codes, assessment_keys, resource_keys)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          newId(),
          packDbId,
          session.key,
          session.termKey,
          session.sequence,
          session.title,
          session.durationMinutes,
          session.optional ? 1 : 0,
          session.objectives,
          session.framework,
          session.materials,
          session.activities,
          session.homework,
          JSON.stringify(session.standardCodes),
          JSON.stringify(session.assessmentKeys),
          JSON.stringify(session.resourceKeys)
        )
      created.sessions++
    }

    return {
      id: packDbId,
      packId: pack.packId,
      revision: pack.revision,
      name: pack.name,
      description: pack.description,
      courseGroupId: courseGroup.id,
      importedAt: now
    }
  })

  return { pack: transaction(), alreadyImported: false, created }
}

export function removeCoursePack(id: string): void {
  // Removing the curriculum layer intentionally leaves library standards/rubrics/resources
  // alone: a teacher may already have reused them elsewhere. A future cleanup tool can
  // identify unreferenced imported library items safely.
  getSqlite().prepare('DELETE FROM course_packs WHERE id = ?').run(id)
}
