import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  CopyPlus,
  FileText,
  NotebookPen,
  Pencil,
  Plus,
  Presentation,
  Sparkles,
  Trash2
} from 'lucide-react'
import type { ClassSection, LessonPlan } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { Input } from '@renderer/components/ui/Field'
import {
  useAssessments,
  useDeleteLessonPlan,
  useDraftLessonPlan,
  useLessonPlans
} from '@renderer/lib/queries'
import { formatDate, ipcErrorMessage, todayIso } from '@renderer/lib/format'
import { LessonPlanFormModal, type LessonPlanDraft } from './LessonPlanFormModal'
import { useQueryClient } from '@tanstack/react-query'
import { addDays, mondayOf } from '@shared/dates'
import { tr, trn } from '@shared/i18n'

const STATUS_TONE = {
  planned: 'primary',
  taught: 'success',
  partly: 'warning',
  skipped: 'neutral'
} as const

const statusLabel = (status: LessonPlan['status']): string =>
  ({
    planned: tr('Planned'),
    taught: tr('Taught'),
    partly: tr('Partly taught: re-teach'),
    skipped: tr('Skipped')
  })[status]

/** Moves the class's still-planned lessons from a date on: later for room to re-teach or a
 * class that was missed, earlier to close the gap a dropped lesson leaves. Taught lessons
 * stay where they happened. */
function MoveLaterControl({
  classId,
  fromDate,
  label
}: {
  classId: string
  fromDate: string
  label: string
}): React.JSX.Element {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState(7)
  const [message, setMessage] = useState<string | null>(null)
  if (message) return <span className="text-xs text-[var(--color-text-muted)]">{message}</span>
  if (!open) {
    return (
      <button
        className="text-xs text-[var(--color-primary)] hover:underline"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
    )
  }
  return (
    <span className="flex items-center gap-1.5 text-xs">
      {tr('Move planned lessons from {date} on', { date: formatDate(fromDate) })}
      <select
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-1"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        <option value={1}>{tr('1 day later')}</option>
        <option value={2}>{tr('2 days later')}</option>
        <option value={7}>{tr('1 week later')}</option>
        <option value={14}>{tr('2 weeks later')}</option>
        {/* After a lesson is dropped (a FLEX session, a merged week): close the gap. */}
        <option value={-7}>{tr('1 week earlier')}</option>
      </select>
      <Button
        size="sm"
        onClick={async () => {
          const n = await window.api.lessonPlans.shiftPlanned(classId, fromDate, days)
          await qc.invalidateQueries({ queryKey: ['classes', classId] })
          setMessage(trn('Moved {n} lesson.', 'Moved {n} lessons.', n))
        }}
      >
        {tr('Move')}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
        {tr('Cancel')}
      </Button>
    </span>
  )
}

export function LessonPlannerTab(): React.JSX.Element {
  const qc = useQueryClient()
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: plans, isLoading } = useLessonPlans(classSection.id)
  const { data: assessments } = useAssessments(classSection.id)
  const deletePlan = useDeleteLessonPlan(classSection.id)

  const [showAdd, setShowAdd] = useState(false)
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LessonPlan | null>(null)
  const [aiDraft, setAiDraft] = useState<LessonPlanDraft | undefined>(undefined)
  const [showAiTopic, setShowAiTopic] = useState(false)
  const [topic, setTopic] = useState('')
  const draftPlan = useDraftLessonPlan()

  async function handleDraft(): Promise<void> {
    if (!topic.trim()) return
    const drafted = await draftPlan.mutateAsync({
      className: classSection.name,
      subject: classSection.subject,
      gradeLevel: classSection.gradeLevel,
      topic: topic.trim()
    })
    setAiDraft(drafted)
    setShowAiTopic(false)
    setTopic('')
    setShowAdd(true)
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex items-start justify-end gap-2">
        {showAiTopic && (
          <div className="flex items-center gap-2">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={tr('Topic, e.g. fractions to decimals')}
              className="w-64"
              autoFocus
            />
            <Button
              variant="secondary"
              onClick={handleDraft}
              disabled={!topic.trim() || draftPlan.isPending}
            >
              {draftPlan.isPending ? tr('Drafting…') : tr('Go')}
            </Button>
          </div>
        )}
        <Button
          variant="secondary"
          onClick={async () => {
            const thisMonday = mondayOf(todayIso())
            const n = await window.api.lessonPlans.copyWeek(
              classSection.id,
              addDays(thisMonday, -7),
              thisMonday
            )
            setCopyMessage(
              n
                ? trn(
                    'Copied {n} plan from last week to this week.',
                    'Copied {n} plans from last week to this week.',
                    n
                  )
                : tr('Nothing to copy: no new plans last week.')
            )
            await qc.invalidateQueries({ queryKey: ['classes', classSection.id] })
          }}
          title={tr("Copy last week's plans to the same days this week")}
        >
          <CopyPlus size={15} className="mr-1 inline" aria-hidden />
          {tr('Copy last week')}
        </Button>
        <Button variant="secondary" onClick={() => setShowAiTopic((v) => !v)}>
          <Sparkles size={15} className="mr-1 inline" aria-hidden />
          {tr('Draft with AI')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            setAiDraft(undefined)
            setShowAdd(true)
          }}
        >
          <Plus size={15} className="mr-1 inline" aria-hidden />
          {tr('Lesson plan')}
        </Button>
      </div>
      {copyMessage && <p className="mb-4 text-sm text-[var(--color-text-muted)]">{copyMessage}</p>}
      {draftPlan.isError && (
        <p className="mb-4 text-sm text-[var(--color-danger)]">
          {ipcErrorMessage(draftPlan.error, tr('Could not draft a lesson plan.'))}
        </p>
      )}

      {!plans?.length ? (
        <EmptyState
          icon={NotebookPen}
          title={tr('No lesson plans yet')}
          description={tr("Sketch out what you'll teach and when.")}
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              {tr('Lesson plan')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Card key={plan.id}>
              <CardBody className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">
                      {formatDate(plan.date)}
                    </span>
                    <Badge tone={STATUS_TONE[plan.status]}>{statusLabel(plan.status)}</Badge>
                    {(plan.support || plan.stretch) && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {[plan.support && tr('Support'), plan.stretch && tr('Stretch')]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">{plan.title}</h3>
                  {plan.objectives && (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{plan.objectives}</p>
                  )}
                  {plan.status === 'partly' && (
                    <p className="mt-1 text-xs text-[var(--color-warning)]">
                      {tr('Re-teach this before moving on.')}{' '}
                      <MoveLaterControl
                        classId={classSection.id}
                        fromDate={addDays(plan.date, 1)}
                        label={tr('Make room: move later lessons back')}
                      />
                    </p>
                  )}
                  {plan.status === 'planned' && plan.date >= todayIso() && (
                    <div className="mt-1">
                      <MoveLaterControl
                        classId={classSection.id}
                        fromDate={plan.date}
                        label={tr('Move this and later lessons…')}
                      />
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditingPlan(plan)}>
                    <Pencil size={13} className="mr-1 inline" aria-hidden />
                    {tr('Edit')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={tr('Save as a Word document')}
                    onClick={() =>
                      void window.api.office.word({ kind: 'lessonPlan', planId: plan.id })
                    }
                  >
                    <FileText size={13} className="mr-1 inline" aria-hidden />
                    {tr('Word')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    title={tr('A starter slide deck from this plan, for PowerPoint or WPS')}
                    onClick={() => void window.api.office.slides(plan.id)}
                  >
                    <Presentation size={13} className="mr-1 inline" aria-hidden />
                    {tr('Slides')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPendingDelete(plan)}>
                    <Trash2 size={13} className="mr-1 inline" aria-hidden />
                    {tr('Delete')}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <LessonPlanFormModal
        // Remounts whenever a fresh AI draft lands (its fields are only ever read once,
        // into useState, on mount) so a second draft doesn't keep showing the first's text.
        key={aiDraft ? `draft:${aiDraft.title}:${aiDraft.objectives}` : 'blank'}
        open={showAdd}
        onClose={() => {
          setShowAdd(false)
          setAiDraft(undefined)
        }}
        classId={classSection.id}
        assessments={assessments ?? []}
        initialDraft={aiDraft}
        noHomework={classSection.noHomework}
      />
      {editingPlan && (
        <LessonPlanFormModal
          open
          onClose={() => setEditingPlan(null)}
          classId={classSection.id}
          assessments={assessments ?? []}
          plan={editingPlan}
          noHomework={classSection.noHomework}
        />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title={tr('Delete lesson plan')}
        message={tr('Delete "{title}"?', { title: pendingDelete?.title })}
        confirmLabel={tr('Delete')}
        danger
        onConfirm={async () => {
          if (pendingDelete) await deletePlan.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
