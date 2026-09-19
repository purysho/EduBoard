import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ClassSection, LessonPlan } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useAssessments, useDeleteLessonPlan, useLessonPlans } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { LessonPlanFormModal } from './LessonPlanFormModal'

const STATUS_TONE = {
  planned: 'primary',
  taught: 'success',
  skipped: 'neutral'
} as const

export function LessonPlannerTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: plans, isLoading } = useLessonPlans(classSection.id)
  const { data: assessments } = useAssessments(classSection.id)
  const deletePlan = useDeleteLessonPlan(classSection.id)

  const [showAdd, setShowAdd] = useState(false)
  const [editingPlan, setEditingPlan] = useState<LessonPlan | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LessonPlan | null>(null)

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} className="mr-1 inline" aria-hidden />
          Lesson plan
        </Button>
      </div>

      {!plans?.length ? (
        <EmptyState
          icon={NotebookPen}
          title="No lesson plans yet"
          description="Sketch out what you'll teach and when."
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              Lesson plan
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
                    <Badge tone={STATUS_TONE[plan.status]}>{plan.status}</Badge>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold">{plan.title}</h3>
                  {plan.objectives && (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{plan.objectives}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditingPlan(plan)}>
                    <Pencil size={13} className="mr-1 inline" aria-hidden />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPendingDelete(plan)}>
                    <Trash2 size={13} className="mr-1 inline" aria-hidden />
                    Delete
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <LessonPlanFormModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        classId={classSection.id}
        assessments={assessments ?? []}
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
        title="Delete lesson plan"
        message={`Delete "${pendingDelete?.title}"?`}
        confirmLabel="Delete"
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
