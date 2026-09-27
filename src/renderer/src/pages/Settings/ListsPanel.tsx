import { useState } from 'react'
import { ListChecks, Plus, X } from 'lucide-react'
import {
  defaultLogQuickAdds,
  STUDENT_LOG_TYPES,
  type LogQuickAdd,
  type StudentField,
  type StudentLogType
} from '@shared/types'
import {
  COMMENT_CATEGORIES,
  defaultCommentBank,
  type BankComment,
  type CommentCategory
} from '@shared/commentBank'
import {
  BUILT_IN_STATUSES,
  attendanceCodeProblem,
  newAttendanceCodeId,
  resolveAttendanceCodes,
  type AttendanceCode
} from '@shared/attendanceCodes'
import type { AttendanceStatus } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import {
  RENAMEABLE_WORDS,
  tr,
  uiLanguage,
  type RenameableWord,
  type Terminology
} from '@shared/i18n'

const TYPE_LABELS: Record<StudentLogType, string> = {
  note: tr('Note'),
  positive: tr('Positive'),
  concern: tr('Concern'),
  contact: tr('Parent contact')
}

const inputClass =
  'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm'

/** Settings → Your lists: the log's one-tap buttons and extra student fields. */
export function ListsPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [quick, setQuick] = useState<LogQuickAdd[] | null>(null)
  const [fields, setFields] = useState<StudentField[] | null>(null)
  const [bank, setBank] = useState<BankComment[] | null>(null)
  const [codes, setCodes] = useState<AttendanceCode[] | null>(null)
  const [words, setWords] = useState<Terminology | null>(null)
  if (!settings) return null
  // Built-ins first (blank label/letter means the usual one), then the school's own.
  const savedCodes = settings.attendanceCodes ?? []
  const c = codes ?? [
    ...BUILT_IN_STATUSES.map(
      (s) => savedCodes.find((x) => x.id === s) ?? { id: s, label: '', letter: '', countsAs: s }
    ),
    ...savedCodes.filter((x) => !(BUILT_IN_STATUSES as readonly string[]).includes(x.id))
  ]
  const defaults = resolveAttendanceCodes([])
  const w = words ?? settings.terminology ?? {}
  const lang = uiLanguage()
  const codeProblem = attendanceCodeProblem(c)
  const q = quick ?? settings.logQuickAdds
  const f = fields ?? settings.studentFields
  const b = bank ?? settings.commentBank
  const dirty =
    quick !== null || fields !== null || bank !== null || codes !== null || words !== null
  const valid =
    q.every((x) => x.label.trim() && x.text.trim()) &&
    f.every((x) => x.label.trim()) &&
    b.every((x) => x.text.trim()) &&
    !codeProblem

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Your lists')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-5 text-sm">
        <section>
          <h3 className="font-medium">{tr('Quick-add buttons on a student’s log')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr('One tap adds the entry. Parent-contact entries appear under Communications.')}
          </p>
          <div className="space-y-1.5">
            {q.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  aria-label={tr('Button label')}
                  className={`${inputClass} w-44`}
                  value={item.label}
                  placeholder={tr('Button label')}
                  onChange={(e) =>
                    setQuick(q.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <select
                  aria-label={tr('Kind of entry')}
                  className={inputClass}
                  value={item.type}
                  onChange={(e) =>
                    setQuick(
                      q.map((x, j) =>
                        j === i ? { ...x, type: e.target.value as StudentLogType } : x
                      )
                    )
                  }
                >
                  {STUDENT_LOG_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={tr('Text it adds')}
                  className={`${inputClass} flex-1`}
                  value={item.text}
                  placeholder={tr('Text it adds')}
                  onChange={(e) =>
                    setQuick(q.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                />
                <button
                  aria-label={`Remove ${item.label || 'button'}`}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => setQuick(q.filter((_, j) => j !== i))}
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <button
              className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
              onClick={() => setQuick([...q, { label: '', type: 'note', text: '' }])}
            >
              <Plus size={12} aria-hidden />
              {tr('Add a button')}
            </button>
            <button
              className="text-[var(--color-text-muted)] hover:underline"
              onClick={() => setQuick(defaultLogQuickAdds())}
            >
              {tr('Restore EduBoard’s')}
            </button>
          </div>
        </section>

        <section>
          <h3 className="font-medium">{tr('Extra student fields')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Things to record about every student, such as house, allergies or support plan. They appear on the student form and page, and a roster import fills them from columns with the same name. They stay on this computer (never sent to the Portal).'
            )}
          </p>
          <div className="space-y-1.5">
            {f.map((field, i) => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  aria-label={tr('Field name')}
                  className={`${inputClass} w-64`}
                  value={field.label}
                  placeholder={tr('e.g. House')}
                  onChange={(e) =>
                    setFields(f.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                  }
                />
                <button
                  aria-label={`Remove ${field.label || 'field'}`}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => setFields(f.filter((_, j) => j !== i))}
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <button
            className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
            onClick={() => setFields([...f, { id: crypto.randomUUID(), label: '' }])}
          >
            <Plus size={12} aria-hidden />
            {tr('Add a field')}
          </button>
          {settings.studentFields.some((old) => !f.find((x) => x.id === old.id)) && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {tr(
                'A removed field is hidden; what was recorded in it is kept, and comes back if you add it again from a school pack.'
              )}
            </p>
          )}
        </section>

        <section>
          <h3 className="font-medium">{tr('Report comment bank')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Sentences you add to report card comments in one click. {name}, {class}, {grade} and {percent} are filled in for each student.'
            )}
          </p>
          <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
            {b.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  aria-label={tr('Category')}
                  className={inputClass}
                  value={c.category}
                  onChange={(e) =>
                    setBank(
                      b.map((x, j) =>
                        j === i ? { ...x, category: e.target.value as CommentCategory } : x
                      )
                    )
                  }
                >
                  {COMMENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {tr(cat)}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={tr('Comment')}
                  className={`${inputClass} flex-1`}
                  value={c.text}
                  onChange={(e) =>
                    setBank(b.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
                  }
                />
                <button
                  aria-label={tr('Remove comment')}
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => setBank(b.filter((_, j) => j !== i))}
                >
                  <X size={13} aria-hidden />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-3 text-xs">
            <button
              className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
              onClick={() => setBank([...b, { category: 'General', text: '' }])}
            >
              <Plus size={12} aria-hidden />
              {tr('Add a comment')}
            </button>
            <button
              className="text-[var(--color-text-muted)] hover:underline"
              onClick={() => setBank(defaultCommentBank())}
            >
              {tr('Restore EduBoard’s')}
            </button>
          </div>
        </section>

        <section>
          <h3 className="font-medium">{tr('Attendance codes')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr(
              'Rename the four codes, or add your own (Sick, Field trip, School event…). Each counts as one of the four, so attendance rates stay right. A code you stop using is hidden, not deleted, so days already marked with it keep counting the same way.'
            )}
          </p>
          <div className="space-y-1.5">
            {c.map((code, i) => {
              const builtIn = (BUILT_IN_STATUSES as readonly string[]).includes(code.id)
              const usual = defaults.find((d) => d.id === code.id)
              const set = (patch: Partial<AttendanceCode>): void =>
                setCodes(c.map((x, j) => (j === i ? { ...x, ...patch } : x)))
              return (
                <div
                  key={code.id}
                  className={`flex items-center gap-2 ${code.hidden ? 'opacity-50' : ''}`}
                >
                  <input
                    aria-label={tr('Code name')}
                    className={`${inputClass} w-44`}
                    value={code.label}
                    placeholder={usual?.label ?? tr('e.g. Sick')}
                    onChange={(e) => set({ label: e.target.value })}
                  />
                  <input
                    aria-label={tr('Short form')}
                    className={`${inputClass} w-14 text-center`}
                    value={code.letter}
                    placeholder={usual?.letter ?? ''}
                    maxLength={2}
                    onChange={(e) => set({ letter: e.target.value })}
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">{tr('counts as')}</span>
                  <select
                    aria-label={tr('Counts as')}
                    className={inputClass}
                    value={code.countsAs}
                    disabled={builtIn}
                    onChange={(e) => set({ countsAs: e.target.value as AttendanceStatus })}
                  >
                    {BUILT_IN_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {defaults.find((d) => d.id === st)?.label}
                      </option>
                    ))}
                  </select>
                  {!builtIn && (
                    <button
                      className="text-xs text-[var(--color-text-muted)] hover:underline"
                      onClick={() => set({ hidden: !code.hidden })}
                    >
                      {code.hidden ? tr('Use again') : tr('Stop using')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <button
            className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
            onClick={() =>
              setCodes([
                ...c,
                { id: newAttendanceCodeId(), label: '', letter: '', countsAs: 'excused' }
              ])
            }
          >
            <Plus size={12} aria-hidden />
            {tr('Add a code')}
          </button>
          {codes !== null && codeProblem && (
            <p className="mt-1 text-xs text-[var(--color-danger)]">{codeProblem}</p>
          )}
        </section>

        <section>
          <h3 className="font-medium">{tr('Words EduBoard uses')}</h3>
          <p className="mb-2 text-xs text-[var(--color-text-muted)]">
            {tr(
              'If your school says “section” instead of “class”, or “test” instead of “assessment”, type your words and EduBoard uses them everywhere. Leave a box empty to keep the usual word. This changes the words for the language EduBoard is in now.'
            )}
          </p>
          <div className="space-y-1.5">
            {(Object.keys(RENAMEABLE_WORDS) as RenameableWord[]).map((key) => {
              const usual = RENAMEABLE_WORDS[key]
              return lang === 'zh' ? (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 text-xs text-[var(--color-text-muted)]">{usual.zh}</span>
                  <input
                    aria-label={tr('Your word for “{word}”', { word: usual.zh })}
                    className={`${inputClass} w-44`}
                    placeholder={usual.zh}
                    value={w.zh?.[key] ?? ''}
                    onChange={(e) => setWords({ ...w, zh: { ...w.zh, [key]: e.target.value } })}
                  />
                </div>
              ) : (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-24 text-xs text-[var(--color-text-muted)]">
                    {usual.en[0]} / {usual.en[1]}
                  </span>
                  <input
                    aria-label={tr('Your word for “{word}”', { word: usual.en[0] })}
                    className={`${inputClass} w-36`}
                    placeholder={usual.en[0]}
                    value={w.en?.[key]?.one ?? ''}
                    onChange={(e) =>
                      setWords({
                        ...w,
                        en: {
                          ...w.en,
                          [key]: { one: e.target.value, other: w.en?.[key]?.other ?? '' }
                        }
                      })
                    }
                  />
                  <input
                    aria-label={tr('Plural of your word for “{word}”', { word: usual.en[0] })}
                    className={`${inputClass} w-36`}
                    placeholder={usual.en[1]}
                    value={w.en?.[key]?.other ?? ''}
                    onChange={(e) =>
                      setWords({
                        ...w,
                        en: {
                          ...w.en,
                          [key]: { one: w.en?.[key]?.one ?? '', other: e.target.value }
                        }
                      })
                    }
                  />
                </div>
              )
            })}
          </div>
        </section>

        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={!dirty || !valid || update.isPending}
            onClick={async () => {
              await update.mutateAsync({
                logQuickAdds: q.map((x) => ({ ...x, label: x.label.trim(), text: x.text.trim() })),
                studentFields: f.map((x) => ({ ...x, label: x.label.trim() })),
                commentBank: b.map((x) => ({ ...x, text: x.text.trim() })),
                attendanceCodes: c.map((x) => ({
                  ...x,
                  label: x.label.trim(),
                  letter: x.letter.trim()
                })),
                ...(words !== null ? { terminology: words } : {})
              })
              setCodes(null)
              // Labels are worked out when a screen's code loads, so new words need a reload.
              if (words !== null) location.reload()
              setQuick(null)
              setFields(null)
              setBank(null)
            }}
          >
            {tr('Save lists')}
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuick(null)
                setFields(null)
                setBank(null)
                setCodes(null)
                setWords(null)
              }}
            >
              {tr('Undo changes')}
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
