// The lists a school makes its own: each is its own card with its own Save, so a change
// is saved next to where it was made (Settings → Class lists, and the comment bank under
// Grading & reports).
import { useRef, useState } from 'react'
import {
  BookmarkPlus,
  CalendarCheck,
  Languages,
  ListChecks,
  MessageSquareQuote,
  Plus,
  Star,
  UserRound,
  X
} from 'lucide-react'
import {
  defaultLogQuickAdds,
  STUDENT_LOG_TYPES,
  type AppSettings,
  type AttendanceStatus,
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
import { commentSets } from '@shared/templates'
import {
  BUILT_IN_STATUSES,
  attendanceCodeProblem,
  newAttendanceCodeId,
  resolveAttendanceCodes,
  type AttendanceCode
} from '@shared/attendanceCodes'
import {
  applyPointCategorySet,
  editablePointCategories,
  newPointCategoryId,
  pointCategoryProblem,
  pointCategorySets,
  usualPointCategoryName,
  type PointCategory
} from '@shared/pointCategories'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import {
  RENAMEABLE_WORDS,
  tr,
  trn,
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

/** A card for one list: title, explanation, the editor, and Save / Undo changes, which
 * only appear once something has changed. */
function ListCard({
  icon: Icon,
  title,
  description,
  dirty,
  problem,
  saving,
  onSave,
  onUndo,
  children
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  title: string
  description: string
  dirty: boolean
  problem?: string | null
  saving?: boolean
  onSave?: () => void
  onUndo?: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        {children}
        {dirty && problem && <p className="text-xs text-[var(--color-danger)]">{problem}</p>}
        {dirty && onSave && (
          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <Button variant="primary" size="sm" disabled={!!problem || saving} onClick={onSave}>
              {tr('Save')}
            </Button>
            <Button variant="ghost" size="sm" onClick={onUndo}>
              {tr('Undo changes')}
            </Button>
            <span className="text-xs text-[var(--color-text-muted)]">{tr('Not saved yet.')}</span>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

/** A draft of one setting: null until the teacher changes something. */
function useDraft<K extends keyof AppSettings>(
  key: K
): {
  settings: AppSettings | undefined
  draft: AppSettings[K] | null
  setDraft: (v: AppSettings[K] | null) => void
  save: (value: AppSettings[K]) => Promise<void>
  saving: boolean
} {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [draft, setDraft] = useState<AppSettings[K] | null>(null)
  return {
    settings,
    draft,
    setDraft,
    saving: update.isPending,
    save: async (value) => {
      await update.mutateAsync({ [key]: value } as Partial<AppSettings>)
      setDraft(null)
    }
  }
}

const removeButton = (label: string, onClick: () => void): React.JSX.Element => (
  <button
    aria-label={label}
    className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
    onClick={onClick}
  >
    <X size={13} aria-hidden />
  </button>
)

export function QuickAddsCard(): React.JSX.Element | null {
  const { settings, draft, setDraft, save, saving } = useDraft('logQuickAdds')
  if (!settings) return null
  const q: LogQuickAdd[] = draft ?? settings.logQuickAdds
  const set = (v: LogQuickAdd[]): void => setDraft(v)
  return (
    <ListCard
      icon={ListChecks}
      title={tr('Quick-add buttons on a student’s log')}
      description={tr(
        'One tap adds the entry. Parent-contact entries appear under Communications.'
      )}
      dirty={draft !== null}
      problem={
        q.every((x) => x.label.trim() && x.text.trim())
          ? null
          : tr('Every button needs a label and the text it adds.')
      }
      saving={saving}
      onSave={() => save(q.map((x) => ({ ...x, label: x.label.trim(), text: x.text.trim() })))}
      onUndo={() => setDraft(null)}
    >
      <div className="space-y-1.5">
        {q.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              aria-label={tr('Button label')}
              className={`${inputClass} w-44`}
              value={item.label}
              placeholder={tr('Button label')}
              onChange={(e) =>
                set(q.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
            <select
              aria-label={tr('Kind of entry')}
              className={inputClass}
              value={item.type}
              onChange={(e) =>
                set(
                  q.map((x, j) => (j === i ? { ...x, type: e.target.value as StudentLogType } : x))
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
              onChange={(e) => set(q.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            />
            {removeButton(tr('Remove {name}', { name: item.label || tr('button') }), () =>
              set(q.filter((_, j) => j !== i))
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 text-xs">
        <button
          className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
          onClick={() => set([...q, { label: '', type: 'note', text: '' }])}
        >
          <Plus size={12} aria-hidden />
          {tr('Add a button')}
        </button>
        <button
          className="text-[var(--color-text-muted)] hover:underline"
          onClick={() => set(defaultLogQuickAdds())}
        >
          {tr('Restore the original list')}
        </button>
      </div>
    </ListCard>
  )
}

export function StudentFieldsCard(): React.JSX.Element | null {
  const { settings, draft, setDraft, save, saving } = useDraft('studentFields')
  if (!settings) return null
  const f: StudentField[] = draft ?? settings.studentFields
  return (
    <ListCard
      icon={UserRound}
      title={tr('Extra student fields')}
      description={tr(
        'Things to record about every student, such as house, allergies or support plan. They appear on the student form and page, and a roster import fills them from columns with the same name. They stay on this computer (never sent to the Portal).'
      )}
      dirty={draft !== null}
      problem={f.every((x) => x.label.trim()) ? null : tr('Every field needs a name.')}
      saving={saving}
      onSave={() => save(f.map((x) => ({ ...x, label: x.label.trim() })))}
      onUndo={() => setDraft(null)}
    >
      <div className="space-y-1.5">
        {f.map((field, i) => (
          <div key={field.id} className="flex items-center gap-2">
            <input
              aria-label={tr('Field name')}
              className={`${inputClass} w-64`}
              value={field.label}
              placeholder={tr('e.g. House')}
              onChange={(e) =>
                setDraft(f.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
            />
            <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={field.onSeatingChart === true}
                onChange={(e) =>
                  setDraft(
                    f.map((x, j) => (j === i ? { ...x, onSeatingChart: e.target.checked } : x))
                  )
                }
              />
              {tr('Show on the seating chart')}
            </label>
            {removeButton(tr('Remove {name}', { name: field.label || tr('field') }), () =>
              setDraft(f.filter((_, j) => j !== i))
            )}
          </div>
        ))}
      </div>
      <button
        className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
        onClick={() => setDraft([...f, { id: crypto.randomUUID(), label: '' }])}
      >
        <Plus size={12} aria-hidden />
        {tr('Add a field')}
      </button>
      {settings.studentFields.some((old) => !f.find((x) => x.id === old.id)) && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr(
            'A removed field is hidden; what was recorded in it is kept, and comes back if you add it again from a school pack.'
          )}
        </p>
      )}
    </ListCard>
  )
}

export function CommentBankCard(): React.JSX.Element | null {
  const { settings, draft, setDraft, save, saving } = useDraft('commentBank')
  const listRef = useRef<HTMLDivElement>(null)
  const [added, setAdded] = useState<string | null>(null)
  if (!settings) return null
  const b: BankComment[] = draft ?? settings.commentBank
  const edit = (v: BankComment[]): void => {
    setDraft(v)
    setAdded(null)
  }
  return (
    <ListCard
      icon={MessageSquareQuote}
      title={tr('Report comment bank')}
      description={tr(
        'Sentences you add to report card comments in one click. {name}, {class}, {grade} and {percent} are filled in for each student.'
      )}
      dirty={draft !== null}
      problem={b.every((x) => x.text.trim()) ? null : tr('A comment can’t be empty.')}
      saving={saving}
      onSave={async () => {
        await save(b.map((x) => ({ ...x, text: x.text.trim() })))
        setAdded(null)
      }}
      onUndo={() => {
        setDraft(null)
        setAdded(null)
      }}
    >
      <div ref={listRef} className="max-h-72 space-y-1.5 overflow-auto pr-1">
        {b.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <select
              aria-label={tr('Category')}
              className={inputClass}
              value={c.category}
              onChange={(e) =>
                edit(
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
                edit(b.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
            />
            {removeButton(tr('Remove comment'), () => edit(b.filter((_, j) => j !== i)))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
          onClick={() => edit([...b, { category: 'General', text: '' }])}
        >
          <Plus size={12} aria-hidden />
          {tr('Add a comment')}
        </button>
        <button
          className="text-[var(--color-text-muted)] hover:underline"
          onClick={() => edit(defaultCommentBank())}
        >
          {tr('Restore the original list')}
        </button>
        <label className="flex items-center gap-1.5">
          <span className="text-[var(--color-text-muted)]">{tr('Add a ready-made set:')}</span>
          <select
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-xs"
            value=""
            onChange={(e) => {
              const set = commentSets().find((x) => x.id === e.target.value)
              if (!set) return
              const have = new Set(b.map((x) => x.text))
              const fresh = set.comments.filter((x) => !have.has(x.text))
              if (fresh.length) {
                setDraft([...b, ...fresh])
                // Show them: they go at the end of the list.
                requestAnimationFrame(() =>
                  listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
                )
              }
              setAdded(
                fresh.length
                  ? trn(
                      '{n} sentence added from “{set}”, at the end of the list. Save to keep it.',
                      '{n} sentences added from “{set}”, at the end of the list. Save to keep them.',
                      fresh.length,
                      { set: set.name }
                    )
                  : tr('Every sentence in “{set}” is already in your bank.', { set: set.name })
              )
            }}
          >
            <option value="">{tr('Choose…')}</option>
            {commentSets().map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {added && (
        <p
          role="status"
          className="rounded-md bg-[var(--color-success-soft)] px-2.5 py-1.5 text-xs text-[var(--color-text)]"
        >
          {added}
        </p>
      )}
    </ListCard>
  )
}

export function SavedTemplatesCard(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  if (!settings) return null
  const saved = settings.savedTemplates ?? []
  return (
    <ListCard
      icon={BookmarkPlus}
      title={tr('Your templates')}
      description={tr(
        'Saved with “Save as template” on a parent letter, Class Story post or lesson plan.'
      )}
      dirty={false}
    >
      {saved.length === 0 ? (
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr('None yet. Use “Save as template” when writing a letter, post or lesson plan.')}
        </p>
      ) : (
        <ul className="space-y-1">
          {saved.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <span className="w-28 text-xs text-[var(--color-text-muted)]">
                {t.kind === 'letter'
                  ? tr('Parent letter')
                  : t.kind === 'story'
                    ? tr('Class Story')
                    : tr('Lesson plan')}
              </span>
              <span className="flex-1">{t.name}</span>
              {removeButton(tr('Delete template {name}', { name: t.name }), () =>
                update.mutate({ savedTemplates: saved.filter((x) => x.id !== t.id) })
              )}
            </li>
          ))}
        </ul>
      )}
    </ListCard>
  )
}

export function AttendanceCodesCard(): React.JSX.Element | null {
  const { settings, draft, setDraft, save, saving } = useDraft('attendanceCodes')
  if (!settings) return null
  // Built-ins first (blank label/letter means the usual one), then the school's own.
  const savedCodes = settings.attendanceCodes ?? []
  const c: AttendanceCode[] = draft ?? [
    ...BUILT_IN_STATUSES.map(
      (s) => savedCodes.find((x) => x.id === s) ?? { id: s, label: '', letter: '', countsAs: s }
    ),
    ...savedCodes.filter((x) => !(BUILT_IN_STATUSES as readonly string[]).includes(x.id))
  ]
  const defaults = resolveAttendanceCodes([])
  return (
    <ListCard
      icon={CalendarCheck}
      title={tr('Attendance codes')}
      description={tr(
        'Rename the four codes, or add your own (Sick, Field trip, School event…). Each counts as one of the four, so attendance rates stay right. A code you stop using is hidden, not deleted, so days already marked with it keep counting the same way.'
      )}
      dirty={draft !== null}
      problem={attendanceCodeProblem(c)}
      saving={saving}
      onSave={() => save(c.map((x) => ({ ...x, label: x.label.trim(), letter: x.letter.trim() })))}
      onUndo={() => setDraft(null)}
    >
      <div className="space-y-1.5">
        {c.map((code, i) => {
          const builtIn = (BUILT_IN_STATUSES as readonly string[]).includes(code.id)
          const usual = defaults.find((d) => d.id === code.id)
          const set = (patch: Partial<AttendanceCode>): void =>
            setDraft(c.map((x, j) => (j === i ? { ...x, ...patch } : x)))
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
        className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
        onClick={() =>
          setDraft([
            ...c,
            { id: newAttendanceCodeId(), label: '', letter: '', countsAs: 'excused' }
          ])
        }
      >
        <Plus size={12} aria-hidden />
        {tr('Add a code')}
      </button>
    </ListCard>
  )
}

export function PointCategoriesCard(): React.JSX.Element | null {
  const { settings, draft, setDraft, save, saving } = useDraft('pointCategories')
  if (!settings) return null
  const pc: PointCategory[] = draft ?? editablePointCategories(settings.pointCategories)
  return (
    <ListCard
      icon={Star}
      title={tr('What class points are for')}
      description={tr(
        'The buttons above the names in the Classroom tab. Report cards show each student’s points per category, and the family digest can show the past week’s. A category you stop using is hidden, not deleted, so points already given keep their name.'
      )}
      dirty={draft !== null}
      problem={pointCategoryProblem(pc)}
      saving={saving}
      onSave={() => save(pc.map((x) => ({ ...x, name: x.name.trim() })))}
      onUndo={() => setDraft(null)}
    >
      <div className="space-y-1.5">
        {pc.map((cat, i) => {
          const set = (patch: Partial<PointCategory>): void =>
            setDraft(pc.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div
              key={cat.id}
              className={`flex items-center gap-2 ${cat.hidden ? 'opacity-50' : ''}`}
            >
              <input
                aria-label={tr('Category name')}
                className={`${inputClass} w-64`}
                value={cat.name}
                placeholder={usualPointCategoryName(cat.id) ?? tr('e.g. Effort')}
                maxLength={40}
                onChange={(e) => set({ name: e.target.value })}
              />
              <button
                className="text-xs text-[var(--color-text-muted)] hover:underline"
                onClick={() => set({ hidden: !cat.hidden })}
              >
                {cat.hidden ? tr('Use again') : tr('Stop using')}
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <button
          className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
          onClick={() => setDraft([...pc, { id: newPointCategoryId(), name: '' }])}
        >
          <Plus size={12} aria-hidden />
          {tr('Add a category')}
        </button>
        <label className="flex items-center gap-1.5">
          <span className="text-[var(--color-text-muted)]">{tr('Use a ready-made set:')}</span>
          <select
            className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 py-0.5 text-xs"
            value=""
            onChange={(e) => {
              const set = pointCategorySets().find((x) => x.id === e.target.value)
              if (set) setDraft(applyPointCategorySet(pc, set))
            }}
          >
            <option value="">{tr('Choose…')}</option>
            {pointCategorySets().map((set) => (
              <option key={set.id} value={set.id}>
                {set.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </ListCard>
  )
}

export function TerminologyCard(): React.JSX.Element | null {
  const { settings, draft, setDraft, save, saving } = useDraft('terminology')
  if (!settings) return null
  const w: Terminology = draft ?? settings.terminology ?? {}
  const lang = uiLanguage()
  return (
    <ListCard
      icon={Languages}
      title={tr('Words EduBoard uses')}
      description={tr(
        'If your school says “section” instead of “class”, or “test” instead of “assessment”, type your words and EduBoard uses them everywhere. Leave a box empty to keep the usual word. This changes the words for the language EduBoard is in now.'
      )}
      dirty={draft !== null}
      saving={saving}
      onSave={async () => {
        await save(w)
        // Labels are worked out when a screen's code loads, so new words need a reload.
        location.reload()
      }}
      onUndo={() => setDraft(null)}
    >
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
                onChange={(e) => setDraft({ ...w, zh: { ...w.zh, [key]: e.target.value } })}
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
                  setDraft({
                    ...w,
                    en: { ...w.en, [key]: { one: e.target.value, other: w.en?.[key]?.other ?? '' } }
                  })
                }
              />
              <input
                aria-label={tr('Plural of your word for “{word}”', { word: usual.en[0] })}
                className={`${inputClass} w-36`}
                placeholder={usual.en[1]}
                value={w.en?.[key]?.other ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...w,
                    en: { ...w.en, [key]: { one: w.en?.[key]?.one ?? '', other: e.target.value } }
                  })
                }
              />
            </div>
          )
        })}
      </div>
    </ListCard>
  )
}
