import { FormEvent, useState } from 'react'
import type { Assessment, LessonPlan, LessonPlanStatus } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { DateSelect, FormRow, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { useCreateLessonPlan, useUpdateLessonPlan } from '@renderer/lib/queries'
import { todayIso } from '@renderer/lib/format'

const STATUS_OPTIONS: { value: LessonPlanStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'taught', label: 'Taught' },
  { value: 'skipped', label: 'Skipped' }
]

/** What an AI draft prefills a new (never an existing) plan's fields with — the teacher
 * still reviews and edits every field before saving, same as typing it by hand. */
export interface LessonPlanDraft {
  title: string
  objectives: string
  materials: string
  activities: string
  homework: string
}

export function LessonPlanFormModal({
  open,
  onClose,
  classId,
  assessments,
  plan,
  initialDraft
}: {
  open: boolean
  onClose: () => void
  classId: string
  assessments: Assessment[]
  plan?: LessonPlan
  initialDraft?: LessonPlanDraft
}): React.JSX.Element {
  const isEdit = !!plan
  const createPlan = useCreateLessonPlan(classId)
  const updatePlan = useUpdateLessonPlan(classId)

  const [date, setDate] = useState(plan?.date ?? todayIso())
  const [title, setTitle] = useState(plan?.title ?? initialDraft?.title ?? '')
  const [objectives, setObjectives] = useState(plan?.objectives ?? initialDraft?.objectives ?? '')
  const [materials, setMaterials] = useState(plan?.materials ?? initialDraft?.materials ?? '')
  const [activities, setActivities] = useState(plan?.activities ?? initialDraft?.activities ?? '')
  const [homework, setHomework] = useState(plan?.homework ?? initialDraft?.homework ?? '')
  const [linkedAssessmentId, setLinkedAssessmentId] = useState(plan?.linkedAssessmentId ?? '')
  const [status, setStatus] = useState<LessonPlanStatus>(plan?.status ?? 'planned')

  const saving = createPlan.isPending || updatePlan.isPending

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const payload = {
      classId,
      date,
      weekLabel: plan?.weekLabel ?? null,
      title: title.trim(),
      objectives: objectives.trim() || null,
      framework: plan?.framework ?? null,
      materials: materials.trim() || null,
      activities: activities.trim() || null,
      homework: homework.trim() || null,
      linkedAssessmentId: linkedAssessmentId || null,
      standards: plan?.standards ?? null,
      status
    }

    if (isEdit) {
      await updatePlan.mutateAsync({ id: plan.id, patch: payload })
    } else {
      await createPlan.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit lesson plan' : 'New lesson plan'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="lesson-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="lesson-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <FormRow label="Date">
          <DateSelect value={date} onChange={setDate} required />
        </FormRow>
        <FormRow label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as LessonPlanStatus)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <div className="col-span-2">
          <FormRow label="Title / theme">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </FormRow>
        </div>
        <div className="col-span-2">
          <FormRow label="Objectives">
            <Textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} />
          </FormRow>
        </div>
        <FormRow label="Materials">
          <Textarea value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </FormRow>
        <FormRow label="Activities / task">
          <Textarea value={activities} onChange={(e) => setActivities(e.target.value)} />
        </FormRow>
        <FormRow label="Homework">
          <Textarea value={homework} onChange={(e) => setHomework(e.target.value)} />
        </FormRow>
        <FormRow label="Linked assessment" hint="Optional — the evidence this lesson builds toward">
          <Select
            value={linkedAssessmentId}
            onChange={(e) => setLinkedAssessmentId(e.target.value)}
          >
            <option value="">None</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormRow>
      </form>
    </Modal>
  )
}
