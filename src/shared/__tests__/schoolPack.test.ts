import { describe, expect, it } from 'vitest'
import { auditSchoolPack, makeSchoolPack, parseSchoolPack, planSchoolPack, sanitizeCss } from '../schoolPack'
import { DEFAULT_APP_SETTINGS, type AppSettings, type Term } from '../types'

const settings = (over: Partial<AppSettings> = {}): AppSettings => ({
  ...DEFAULT_APP_SETTINGS,
  ...over
})
const term = (name: string, schoolYear: string): Term => ({
  id: name,
  name,
  schoolYear,
  startDate: null,
  endDate: null,
  sortOrder: 0,
  createdAt: '',
  updatedAt: ''
})
const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('school pack', () => {
  it('round-trips the school-wide settings and terms', () => {
    const from = settings({
      schoolName: 'Riverside Primary',
      appDisplayName: 'Riverside Teacher Hub',
      schoolLogo: PNG,
      accentColor: '#0f766e',
      defaultPassMark: 50,
      studentFields: [{ id: 'house', label: 'House' }],
      defaultGradeThresholds: {
        A: 90,
        B: 80,
        C: 70,
        D: 60,
        scale: [
          { label: '优秀', min: 90 },
          { label: '良好', min: 75 },
          { label: '合格', min: 60 },
          { label: '待合格', min: 0 }
        ]
      }
    })
    const pack = parseSchoolPack(
      JSON.stringify(makeSchoolPack(from, [term('Term 1', '2026-2027')]))
    )
    const plan = planSchoolPack(pack, settings(), [])
    expect(plan.settings).toMatchObject({
      schoolName: 'Riverside Primary',
      appDisplayName: 'Riverside Teacher Hub',
      schoolLogo: PNG,
      accentColor: '#0f766e',
      defaultPassMark: 50,
      studentFields: [{ id: 'house', label: 'House' }]
    })
    expect(plan.settings.defaultGradeThresholds?.scale?.[3].label).toBe('待合格')
    expect(plan.newTerms).toEqual([
      { name: 'Term 1', schoolYear: '2026-2027', startDate: null, endDate: null }
    ])
    expect(plan.changes.join('\n')).toMatch(/优秀 \/ 良好 \/ 合格 \/ 待合格/)
  })

  it('refuses a file that isn’t a school pack', () => {
    expect(() => parseSchoolPack('{"kind":"something-else","version":1}')).toThrow(/isn’t an/)
    expect(() => parseSchoolPack('not json')).toThrow(/isn’t a school pack/)
  })

  it('drops anything invalid or unsafe instead of trusting it', () => {
    const pack = parseSchoolPack(
      JSON.stringify({
        kind: 'eduboard-school-pack',
        version: 1,
        schoolLogo: 'data:text/html;base64,PHNjcmlwdD4=',
        accentColor: 'red;}body{display:none',
        defaultGradeThresholds: { A: 90, B: 80, C: 70, D: 60, scale: [{ label: 'Only', min: 10 }] },
        logQuickAdds: [{ label: 'x', type: 'admin', text: 'y' }],
        terms: [{ name: 'T', schoolYear: '2026', startDate: 'yesterday', endDate: null }],
        defaultPassMark: -5
      })
    )
    expect(pack).toEqual({ kind: 'eduboard-school-pack', version: 1, createdAt: '' })
  })

  it('adds terms and student fields without removing or duplicating any', () => {
    const pack = parseSchoolPack(
      JSON.stringify({
        kind: 'eduboard-school-pack',
        version: 1,
        studentFields: [
          { id: 'house', label: 'House' },
          { id: 'bus', label: 'Bus route' }
        ],
        terms: [
          { name: 'Term 1', schoolYear: '2026-2027', startDate: null, endDate: null },
          { name: 'Term 2', schoolYear: '2026-2027', startDate: '2027-02-20', endDate: null }
        ]
      })
    )
    const plan = planSchoolPack(
      pack,
      settings({ studentFields: [{ id: 'house', label: 'House (colour)' }] }),
      [term('term 1', '2026-2027')]
    )
    expect(plan.settings.studentFields?.map((f) => f.id)).toEqual(['house', 'bus'])
    expect(plan.settings.studentFields?.[0].label).toBe('House (colour)')
    expect(plan.newTerms.map((t) => t.name)).toEqual(['Term 2'])
  })

  it('audits included policy/configuration and explicitly excludes classroom data', () => {
    const pack = parseSchoolPack(
      JSON.stringify(
        makeSchoolPack(
          settings({
            schoolName: 'Riverside',
            defaultPassMark: 60,
            studentFields: [{ id: 'house', label: 'House' }]
          }),
          [term('Term 1', '2026-2027')]
        )
      )
    )
    const audit = auditSchoolPack(pack)
    expect(audit.included.join('\n')).toMatch(/branding|Grading|terms|student-field/i)
    expect(audit.excluded.join('\n')).toMatch(/rosters|Grades|Homework|Lesson plans|credentials/i)
  })

  it('changes nothing when this computer already matches', () => {
    const s = settings({ schoolName: 'Riverside', accentColor: '#1d4ed8' })
    const plan = planSchoolPack(parseSchoolPack(JSON.stringify(makeSchoolPack(s, []))), s, [])
    expect(plan.changes).toEqual([])
    expect(plan.settings).toEqual({})
  })
})

describe('school stylesheet', () => {
  it('can restyle EduBoard but never fetch anything', () => {
    const css = sanitizeCss(`@import url("https://evil.example/x.css");
      body { background: url(https://tracker.example/p.png) }
      .card { background-image: url('data:image/png;base64,AAAA') }
      :root { --color-bg: #fdf6e3 }
      div { width: expression(alert(1)); behavior: url(x.htc) }
      </style><script>alert(1)</script>`)
    expect(css).not.toMatch(/@import|tracker\.example|evil\.example|expression\(|[^-]behavior:|</i)
    expect(css).toContain("url('data:image/png;base64,AAAA')")
    expect(css).toContain('--color-bg: #fdf6e3')
  })
})
