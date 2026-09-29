import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseCoursePack } from '../coursePack'

const packPath = join(process.cwd(), 'course-packs', 'just-applied-english-2026-27.coursepack.json')

describe('JUST Applied Academic & Professional English Course Pack', () => {
  it('stays valid against the current Course Pack schema', () => {
    const pack = parseCoursePack(readFileSync(packPath, 'utf8'))

    expect(pack.id).toBe('just-applied-english-2026-27')
    expect(pack.name).toBe('JUST Applied Academic & Professional English 2026–27')
    expect(pack.terms).toHaveLength(2)
    expect(pack.standards).toHaveLength(9)
    expect(pack.rubrics).toHaveLength(5)
    expect(pack.lessons).toHaveLength(34)
    expect(pack.assessments).toHaveLength(10)
    expect(pack.resources).toHaveLength(40)
    expect(pack.studentFields).toHaveLength(9)
  })

  it('preserves the approved 15 + 19 session structure and three FLEX sessions', () => {
    const pack = parseCoursePack(readFileSync(packPath, 'utf8'))
    const t1 = pack.lessons?.filter((lesson) => lesson.termKey === 't1') ?? []
    const t2 = pack.lessons?.filter((lesson) => lesson.termKey === 't2') ?? []
    const flex = t2.filter((lesson) => lesson.title.includes('[FLEX]'))

    expect(t1).toHaveLength(15)
    expect(t2).toHaveLength(19)
    expect(flex.map((lesson) => lesson.key)).toEqual(['t2-13', 't2-15', 't2-16'])
  })

  it('ships a complete teaching-material layer for every planned session', () => {
    const pack = parseCoursePack(readFileSync(packPath, 'utf8'))
    const lessonKeys = new Set(pack.lessons?.map((lesson) => lesson.key) ?? [])
    const kitKeys = new Set(
      (pack.resources ?? [])
        .map((resource) => resource.key)
        .filter((key) => key.startsWith('kit-'))
        .map((key) => key.slice(4))
    )

    expect(kitKeys).toEqual(lessonKeys)
    expect(pack.resources?.map((resource) => resource.key)).toContain('university-activity-bank')

    for (const lesson of pack.lessons ?? []) {
      expect(lesson.resourceKeys).toContain(`kit-${lesson.key}`)
      expect(lesson.resourceKeys).toContain('poa-spine')
      expect(lesson.resourceKeys).toContain('support-core-stretch')
      expect(lesson.resourceKeys).toContain('university-activity-bank')
      expect(lesson.materials).toContain('Linked lesson kit:')
      expect(lesson.homework?.trim().length).toBeGreaterThan(0)

      const stages = lesson.activities?.split('\n').filter(Boolean) ?? []
      expect(stages).toHaveLength(8)
      expect(stages[0]).toMatch(/^Retrieval:/)
      expect(stages[1]).toMatch(/^Output challenge:/)
      expect(stages[7]).toMatch(/^Exit ticket:/)

      const kit = pack.resources?.find((resource) => resource.key === `kit-${lesson.key}`)
      expect(kit?.type).toBe('note')
      expect(kit?.notes).toContain('CORE INPUT / CASE')
      expect(kit?.notes).toContain('STUDENT TASK SHEET')
      expect(kit?.notes).toContain('SUPPORT')
      expect(kit?.notes).toContain('STRETCH')
      expect(kit?.notes).toContain('FEEDBACK / EXIT')
    }
  })

  it('keeps the university curriculum in the pack rather than requiring university-only EduBoard data', () => {
    const pack = parseCoursePack(readFileSync(packPath, 'utf8'))

    expect(pack.subject).toBe('English')
    expect(pack.studentFields?.map((field) => field.id)).toContain('major')
    expect(pack.studentFields?.map((field) => field.id)).toContain('pathway')
    expect(pack.standards?.map((standard) => standard.code)).toEqual([
      'UENG-01',
      'UENG-02',
      'UENG-03',
      'UENG-04',
      'UENG-05',
      'UENG-06',
      'UENG-07',
      'UENG-08',
      'UENG-09'
    ])
  })
})
