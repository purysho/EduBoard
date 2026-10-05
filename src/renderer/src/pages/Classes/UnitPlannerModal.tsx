import { useState } from 'react'
import type { ClassSection } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { DateSelect, FormRow, Input, Select } from '@renderer/components/ui/Field'
import { useCreateUnitLessons, useDraftUnitPlan } from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage, todayIso } from '@renderer/lib/format'
import {
  objectivesWithCheck,
  unitLessonContext,
  UNIT_MAX_LESSONS,
  UNIT_MIN_LESSONS,
  type DraftedUnitPlan,
  type UnitLessonToCreate
} from '@shared/unitPlan'
import { tr, trn } from '@shared/i18n'

const COUNTS = Array.from(
  { length: UNIT_MAX_LESSONS - UNIT_MIN_LESSONS + 1 },
  (_, i) => i + UNIT_MIN_LESSONS
)

/** Plan a unit with AI: what students need first, then a sequence of lessons with a
 * check each. The teacher reads and edits it, and the lessons go on the class's next
 * free teaching days, as outlines or each drafted in full from the unit. */
export function UnitPlannerModal({
  open,
  onClose,
  classSection,
  onAdded
}: {
  open: boolean
  onClose: () => void
  classSection: ClassSection
  onAdded: (message: string) => void
}): React.JSX.Element {
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(6)
  const [startDate, setStartDate] = useState(todayIso())
  const [unit, setUnit] = useState<DraftedUnitPlan | null>(null)
  const [dates, setDates] = useState<string[]>([])
  const [draftFull, setDraftFull] = useState(true)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const draftUnit = useDraftUnitPlan()
  const createUnit = useCreateUnitLessons(classSection.id)
  const busy = draftUnit.isPending || createUnit.isPending || progress !== null

  function close(): void {
    if (progress !== null) return
    setUnit(null)
    setError(null)
    onClose()
  }

  async function plan(): Promise<void> {
    setError(null)
    try {
      const drafted = await draftUnit.mutateAsync({
        classId: classSection.id,
        className: classSection.name,
        subject: classSection.subject,
        gradeLevel: classSection.gradeLevel,
        topic: topic.trim(),
        lessonCount: count
      })
      setDates(
        await window.api.lessonPlans.teachingDates(
          classSection.id,
          startDate,
          drafted.lessons.length
        )
      )
      setUnit(drafted)
    } catch (err) {
      setError(ipcErrorMessage(err, tr('The AI draft failed. Try again.')))
    }
  }

  async function add(): Promise<void> {
    if (!unit) return
    setError(null)
    try {
      const lessons: UnitLessonToCreate[] = []
      for (const [i, lesson] of unit.lessons.entries()) {
        const outline = { title: lesson.title, objectives: objectivesWithCheck(lesson) }
        if (!draftFull) {
          lessons.push(outline)
          continue
        }
        setProgress(tr('Drafting lesson {n} of {total}…', { n: i + 1, total: unit.lessons.length }))
        const full = await window.api.ai.draftLessonPlan({
          classId: classSection.id,
          className: classSection.name,
          subject: classSection.subject,
          gradeLevel: classSection.gradeLevel,
          topic: lesson.title,
          unitContext: unitLessonContext(unit, i)
        })
        lessons.push({ ...full, ...outline })
      }
      setProgress(null)
      const created = await createUnit.mutateAsync({
        classId: classSection.id,
        unitTitle: unit.title,
        startDate,
        lessons
      })
      onAdded(
        trn('Added {n} lesson from {date}.', 'Added {n} lessons from {date}.', created.length, {
          date: created[0] ? formatDate(created[0].date) : ''
        })
      )
      setUnit(null)
      setTopic('')
      onClose()
    } catch (err) {
      setProgress(null)
      setError(ipcErrorMessage(err, tr('The AI draft failed. Try again.')))
    }
  }

  const editLesson = (i: number, title: string): void =>
    setUnit((u) =>
      u ? { ...u, lessons: u.lessons.map((l, j) => (j === i ? { ...l, title } : l)) } : u
    )

  return (
    <Modal
      open={open}
      onClose={close}
      title={tr('Plan a unit with AI')}
      wide
      footer={
        unit ? (
          <>
            <Button variant="secondary" onClick={() => setUnit(null)} disabled={busy}>
              {tr('Back')}
            </Button>
            <Button
              variant="primary"
              onClick={add}
              disabled={busy || unit.lessons.some((l) => !l.title.trim())}
            >
              {progress ?? trn('Add {n} lesson', 'Add {n} lessons', unit.lessons.length)}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              {tr('Cancel')}
            </Button>
            <Button variant="primary" onClick={plan} disabled={!topic.trim() || busy}>
              {draftUnit.isPending ? tr('Planning…') : tr('Plan the unit')}
            </Button>
          </>
        )
      }
    >
      {!unit ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <FormRow label={tr('What is the unit about?')}>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={tr('e.g. Talking about university life')}
                autoFocus
              />
            </FormRow>
          </div>
          <FormRow label={tr('Number of lessons')}>
            <Select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow
            label={tr('First lesson on or after')}
            hint={tr("Lessons go on this class's timetable days that have no lesson yet.")}
          >
            <DateSelect value={startDate} onChange={(d) => setStartDate(d || todayIso())} />
          </FormRow>
          <p className="col-span-2 text-sm text-[var(--color-text-muted)]">
            {tr(
              "The AI first works out what students need to know already, then plans the lessons in order, each ending with a quick check. It uses this class's teaching profile and recent record (counts only, no student names)."
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <FormRow label={tr('Unit title')}>
            <Input
              value={unit.title}
              onChange={(e) => setUnit({ ...unit, title: e.target.value })}
            />
          </FormRow>
          {unit.prerequisites.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">{tr('Students need first')}</h3>
              <ul className="list-disc pl-5 text-sm">
                {unit.prerequisites.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <ol className="space-y-3">
            {unit.lessons.map((lesson, i) => (
              <li
                key={i}
                className="rounded-md border border-[var(--color-border)] p-3"
                data-testid="unit-lesson"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="w-28 shrink-0 text-xs text-[var(--color-text-muted)]">
                    {i + 1}. {dates[i] ? formatDate(dates[i]) : ''}
                  </span>
                  <Input
                    value={lesson.title}
                    onChange={(e) => editLesson(i, e.target.value)}
                    aria-label={tr('Lesson {n} title', { n: i + 1 })}
                  />
                </div>
                {lesson.objectives && <p className="text-sm">{lesson.objectives}</p>}
                {lesson.check && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {tr('Check: {check}', { check: lesson.check })}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={draftFull}
              onChange={(e) => setDraftFull(e.target.checked)}
              disabled={busy}
            />
            <span>
              {tr(
                'Also draft each lesson in full: materials, timed activities, a floor and a stretch version of the main task, homework. Takes a minute or two.'
              )}
            </span>
          </label>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-[var(--color-danger)]">{error}</p>}
    </Modal>
  )
}
