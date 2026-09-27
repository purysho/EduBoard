import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { CopyPlus, NotebookPen, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
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
  skipped: 'neutral'
} as const

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
                    <Badge tone={STATUS_TONE[plan.status]}>{tr(plan.status)}</Badge>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">{plan.title}</h3>
                  {plan.objectives && (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{plan.objectives}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditingPlan(plan)}>
                    <Pencil size={13} className="mr-1 inline" aria-hidden />
                    {tr('Edit')}
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
      />
      {editingPlan && (
        <LessonPlanFormModal
          open
          onClose={() => setEditingPlan(null)}
          classId={classSection.id}
          assessments={assessments ?? []}
          plan={editingPlan}
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
