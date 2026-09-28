import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, TriangleAlert } from 'lucide-react'
import type { Assessment, ClassRosterRow, GradeCategory, Score } from '@shared/types'
import {
  buildScoreImportPlan,
  guessScoreColumns,
  guessStudentColumns,
  type ScoreColumnChoice,
  type ScoreSheet,
  type StudentColumns
} from '@shared/scoreImport'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Input, Select } from '@renderer/components/ui/Field'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr, trn } from '@shared/i18n'

interface Props {
  open: boolean
  onClose: () => void
  classId: string
  roster: ClassRosterRow[]
  assessments: Assessment[]
  categories: GradeCategory[]
  scores: Score[]
}

type StudentMode = StudentColumns['kind']

/** Gradebook → Import scores: pick a spreadsheet, check which columns are students and
 * which are scores, see exactly what will change, then import. Nothing is written until
 * the teacher clicks Import. */
export function ScoreImportModal({
  open,
  onClose,
  classId,
  roster,
  assessments,
  categories,
  scores
}: Props): React.JSX.Element {
  const qc = useQueryClient()
  const [filePath, setFilePath] = useState<string | null>(null)
  const [sheet, setSheet] = useState<ScoreSheet | null>(null)
  const [students, setStudents] = useState<StudentColumns | null>(null)
  const [choices, setChoices] = useState<ScoreColumnChoice[]>([])
  const [categoryId, setCategoryId] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const importRoster = useMemo(
    () =>
      roster
        .filter((r) => r.enrollment.status === 'active')
        .map((r) => ({
          id: r.student.id,
          firstName: r.student.firstName,
          lastName: r.student.lastName,
          studentNumber: r.student.studentNumber
        })),
    [roster]
  )
  const studentName = useMemo(
    () =>
      new Map(roster.map((r) => [r.student.id, `${r.student.firstName} ${r.student.lastName}`])),
    [roster]
  )
  const assessmentName = new Map(assessments.map((a) => [a.id, a.name]))

  function reset(): void {
    setFilePath(null)
    setSheet(null)
    setStudents(null)
    setChoices([])
    setError(null)
    setDone(null)
  }

  async function load(path: string, sheetIndex = 0): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const read = await window.api.scoreImport.read(path, sheetIndex)
      const cols = guessStudentColumns(read.headers, read.rows) ?? {
        kind: 'name' as const,
        column: 0
      }
      setFilePath(path)
      setSheet(read)
      setStudents(cols)
      setChoices(guessScoreColumns(read, cols, assessments))
    } catch (err) {
      setError(ipcErrorMessage(err, tr('That file couldn’t be read.')))
    } finally {
      setBusy(false)
    }
  }

  async function pick(): Promise<void> {
    const path = await window.api.importExport.pickImportFile()
    if (path) await load(path)
  }

  function changeStudents(next: StudentColumns): void {
    setStudents(next)
    if (sheet) setChoices(guessScoreColumns(sheet, next, assessments))
  }

  function setStudentMode(mode: StudentMode): void {
    if (!sheet || !students) return
    const first = students.kind === 'split' ? students.first : students.column
    const guessed = guessStudentColumns(sheet.headers, sheet.rows, mode)
    const next: StudentColumns = guessed
      ? guessed
      : mode === 'split'
        ? { kind: 'split', first, last: Math.min(first + 1, sheet.headers.length - 1) }
        : { kind: mode, column: first }
    changeStudents(next)
  }

  const plan = useMemo(
    () =>
      sheet && students
        ? buildScoreImportPlan(sheet, students, choices, importRoster, scores)
        : null,
    [sheet, students, choices, importRoster, scores]
  )
  const replacing = plan?.writes.filter((w) => w.previous !== null) ?? []
  const newCount = choices.filter((c) => c.include && c.target === 'new').length
  const badNew = choices.some(
    (c) => c.include && c.target === 'new' && (!c.newName.trim() || !(c.maxScore > 0))
  )

  async function runImport(): Promise<void> {
    if (!plan) return
    setBusy(true)
    setError(null)
    try {
      const result = await window.api.scoreImport.apply({
        classId,
        newAssessments: choices
          .filter((c) => c.include && c.target === 'new')
          .map((c) => ({
            key: `new:${c.column}`,
            name: c.newName,
            maxScore: c.maxScore,
            categoryId: categoryId || null,
            date: new Date().toISOString().slice(0, 10)
          })),
        writes: plan.writes.map(({ target, studentId, pointsEarned, excused }) => ({
          target,
          studentId,
          pointsEarned,
          excused
        }))
      })
      await qc.invalidateQueries({ queryKey: ['classes', classId] })
      await qc.invalidateQueries({ queryKey: ['dashboardStats'] })
      setDone(
        trn('{n} score imported.', '{n} scores imported.', result.scoresWritten) +
          (result.assessmentsCreated
            ? ' ' +
              trn(
                '{n} new assessment added.',
                '{n} new assessments added.',
                result.assessmentsCreated
              )
            : '')
      )
    } catch (err) {
      setError(ipcErrorMessage(err, tr('The scores couldn’t be imported.')))
    } finally {
      setBusy(false)
    }
  }

  function close(): void {
    reset()
    onClose()
  }

  const header = (i: number): string => sheet?.headers[i] ?? ''
  const split = students?.kind === 'split' ? students : null
  const columnSelect = (
    value: number,
    onChange: (n: number) => void,
    label: string
  ): React.JSX.Element => (
    <Select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-auto"
    >
      {sheet?.headers.map((h, i) => (
        <option key={i} value={i}>
          {h}
        </option>
      ))}
    </Select>
  )
  const updateChoice = (column: number, patch: Partial<ScoreColumnChoice>): void =>
    setChoices((all) => all.map((c) => (c.column === column ? { ...c, ...patch } : c)))

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title={tr('Import scores from a spreadsheet')}
      footer={
        done ? (
          <Button variant="primary" onClick={close}>
            {tr('Done')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              {tr('Cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={busy || !plan || !plan.writes.length || badNew}
              onClick={() => void runImport()}
            >
              {busy && sheet
                ? tr('Importing…')
                : trn('Import {n} score', 'Import {n} scores', plan?.writes.length ?? 0)}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm">
        {done ? (
          <p
            role="status"
            className="rounded-md bg-[var(--color-success-soft)] px-3 py-2 text-[var(--color-text)]"
          >
            {done}
          </p>
        ) : !sheet ? (
          <div className="space-y-3">
            <p className="text-[var(--color-text-muted)]">
              {tr(
                'For scores from an exam system or a colleague’s spreadsheet (.xlsx or .csv). Row 1 should have headings, with one row per student: a name or student number column, and a column for each test. You’ll see exactly what changes before anything is saved.'
              )}
            </p>
            <Button variant="primary" onClick={() => void pick()} disabled={busy}>
              <FileSpreadsheet size={15} className="mr-1 inline" aria-hidden />
              {busy ? tr('Reading…') : tr('Choose a spreadsheet')}
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="truncate">{filePath?.split(/[/\\]/).pop()}</span>
              {sheet.sheetNames.length > 1 && (
                <Select
                  aria-label={tr('Sheet')}
                  className="w-auto"
                  value={sheet.sheetIndex}
                  onChange={(e) => void load(filePath!, Number(e.target.value))}
                >
                  {sheet.sheetNames.map((n, i) => (
                    <option key={i} value={i}>
                      {n}
                    </option>
                  ))}
                </Select>
              )}
              <span>
                {trn('{n} row', '{n} rows', sheet.rows.length)}
                {sheet.truncated ? ` · ${tr('only the first 2,000 are read')}` : ''}
              </span>
              <Button variant="ghost" size="sm" onClick={() => void pick()}>
                {tr('Choose another file')}
              </Button>
            </div>

            <section className="space-y-2">
              <h3 className="font-medium">{tr('1. Where are the students?')}</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  aria-label={tr('Students are matched by')}
                  className="w-auto"
                  value={students!.kind}
                  onChange={(e) => setStudentMode(e.target.value as StudentMode)}
                >
                  <option value="number">{tr('Student number column')}</option>
                  <option value="name">{tr('Name column')}</option>
                  <option value="split">{tr('First name and last name columns')}</option>
                </Select>
                {students!.kind === 'split' ? (
                  <>
                    {columnSelect(
                      students!.first,
                      (n) => changeStudents({ kind: 'split', first: n, last: split!.last }),
                      tr('First name column')
                    )}
                    {columnSelect(
                      students!.last,
                      (n) => changeStudents({ kind: 'split', first: split!.first, last: n }),
                      tr('Last name column')
                    )}
                  </>
                ) : (
                  columnSelect(
                    students!.column,
                    (n) => changeStudents({ kind: students!.kind as 'number' | 'name', column: n }),
                    tr('Student column')
                  )
                )}
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-medium">{tr('2. Which columns are scores?')}</h3>
              {!choices.length ? (
                <p className="text-[var(--color-text-muted)]">
                  {tr('No column of scores was found. Check the student column above.')}
                </p>
              ) : (
                <table className="w-full text-left">
                  <thead className="text-xs text-[var(--color-text-muted)]">
                    <tr>
                      <th className="py-1 pr-2">{tr('Column')}</th>
                      <th className="py-1 pr-2">{tr('Goes into')}</th>
                      <th className="py-1">{tr('Out of')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {choices.map((c) => (
                      <tr key={c.column} className="align-top">
                        <td className="py-1 pr-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={c.include}
                              onChange={(e) =>
                                updateChoice(c.column, { include: e.target.checked })
                              }
                            />
                            {header(c.column)}
                          </label>
                        </td>
                        <td className="py-1 pr-2">
                          <div className="flex flex-wrap gap-2">
                            <Select
                              aria-label={tr('Goes into')}
                              className="w-auto"
                              disabled={!c.include}
                              value={c.target}
                              onChange={(e) => {
                                const target = e.target.value
                                const a = assessments.find((x) => x.id === target)
                                updateChoice(c.column, {
                                  target,
                                  maxScore: a ? a.maxScore : c.maxScore
                                })
                              }}
                            >
                              <option value="new">{tr('A new assessment')}</option>
                              {assessments.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </Select>
                            {c.target === 'new' && (
                              <Input
                                aria-label={tr('New assessment name')}
                                className="w-48"
                                disabled={!c.include}
                                value={c.newName}
                                onChange={(e) =>
                                  updateChoice(c.column, { newName: e.target.value })
                                }
                              />
                            )}
                          </div>
                        </td>
                        <td className="py-1">
                          <Input
                            aria-label={tr('Out of')}
                            type="number"
                            min={1}
                            className="w-20"
                            disabled={!c.include || c.target !== 'new'}
                            value={c.maxScore}
                            onChange={(e) =>
                              updateChoice(c.column, { maxScore: Number(e.target.value) })
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {newCount > 0 && categories.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  {tr('New assessments go in the category')}
                  <Select
                    className="w-auto"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">{tr('No category')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
            </section>

            {plan && (
              <section className="space-y-2">
                <h3 className="font-medium">{tr('3. Check what will change')}</h3>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    {tr('{matched} of {rows} rows matched to students in this class.', {
                      matched: sheet.rows.length - plan.unmatched.length - plan.duplicates.length,
                      rows: sheet.rows.length
                    })}
                  </li>
                  <li>
                    {trn('{n} score to save', '{n} scores to save', plan.writes.length)}
                    {replacing.length > 0 &&
                      ` · ${trn('{n} replaces a score already there', '{n} replace scores already there', replacing.length)}`}
                  </li>
                </ul>
                {(plan.unmatched.length > 0 ||
                  plan.duplicates.length > 0 ||
                  plan.skipped.length > 0 ||
                  replacing.length > 0) && (
                  <div className="max-h-56 space-y-2 overflow-auto rounded-md border border-[var(--color-border)] p-3 text-xs">
                    {plan.unmatched.length > 0 && (
                      <p>
                        <TriangleAlert
                          size={12}
                          className="mr-1 inline text-[var(--color-warning)]"
                          aria-hidden
                        />
                        <strong>{tr('Not matched (left out):')}</strong>{' '}
                        {plan.unmatched
                          .map((u) => tr('row {row} “{label}”', { row: u.row, label: u.label }))
                          .join(', ')}
                      </p>
                    )}
                    {plan.duplicates.length > 0 && (
                      <p>
                        <strong>{tr('Same student twice (only the first row is used):')}</strong>{' '}
                        {plan.duplicates
                          .map((u) => tr('row {row} “{label}”', { row: u.row, label: u.label }))
                          .join(', ')}
                      </p>
                    )}
                    {plan.skipped.length > 0 && (
                      <p>
                        <strong>{tr('Left out:')}</strong>{' '}
                        {plan.skipped
                          .map((s) =>
                            tr('row {row}, {column}: “{value}” ({why})', {
                              row: s.row,
                              column: s.column,
                              value: s.value,
                              why:
                                s.reason === 'over-max'
                                  ? tr('more than the maximum')
                                  : s.reason === 'negative'
                                    ? tr('below zero')
                                    : tr('not a score')
                            })
                          )
                          .join('; ')}
                      </p>
                    )}
                    {replacing.length > 0 && (
                      <p>
                        <strong>{tr('Replaces:')}</strong>{' '}
                        {replacing
                          .map(
                            (w) =>
                              `${studentName.get(w.studentId) ?? ''}, ${assessmentName.get(w.target) ?? ''}: ${
                                w.previous === 'excused' ? tr('excused') : w.previous
                              } → ${w.excused ? tr('excused') : w.pointsEarned}`
                          )
                          .join('; ')}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-[var(--color-text-muted)]">
                  {tr(
                    'Each score keeps its history, as if typed in the gradebook. “EX” or 免考 marks a student excused; a percentage like 85% becomes points out of the maximum.'
                  )}
                </p>
              </section>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
