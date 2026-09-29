import { FormEvent, useState } from 'react'
import type { Assessment, LessonPlan, LessonPlanStatus } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { DateSelect, FormRow, Input, Select, Textarea } from '@renderer/components/ui/Field'
import {
  useCreateLessonPlan,
  useLessonPlanResourceIds,
  useLessonResources,
  useSetLessonPlanResources,
  useUpdateLessonPlan
} from '@renderer/lib/queries'
import { todayIso } from '@renderer/lib/format'
import { tr } from '@shared/i18n'
import { TemplatePicker } from '@renderer/components/TemplatePicker'
import { lessonTemplates } from '@shared/templates'

const STATUS_OPTIONS: { value: LessonPlanStatus; label: string }[] = [
  { value: 'planned', label: tr('Planned') },
  { value: 'taught', label: tr('Taught') },
  { value: 'skipped', label: tr('Skipped') }
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
  const setResources = useSetLessonPlanResources()
  const { data: resources } = useLessonResources()
  const { data: savedResourceIds, isLoading: resourceIdsLoading } = useLessonPlanResourceIds(plan?.id)

  const [date, setDate] = useState(plan?.date ?? todayIso())
  const [title, setTitle] = useState(plan?.title ?? initialDraft?.title ?? '')
  const [objectives, setObjectives] = useState(plan?.objectives ?? initialDraft?.objectives ?? '')
  const [materials, setMaterials] = useState(plan?.materials ?? initialDraft?.materials ?? '')
  const [activities, setActivities] = useState(plan?.activities ?? initialDraft?.activities ?? '')
  const [homework, setHomework] = useState(plan?.homework ?? initialDraft?.homework ?? '')
  const [linkedAssessmentId, setLinkedAssessmentId] = useState(plan?.linkedAssessmentId ?? '')
  const [status, setStatus] = useState<LessonPlanStatus>(plan?.status ?? 'planned')
  const [resourceIdsOverride, setResourceIdsOverride] = useState<string[] | null>(null)
  const resourceIds = resourceIdsOverride ?? savedResourceIds ?? []

  const saving =
    createPlan.isPending ||
    updatePlan.isPending ||
    setResources.isPending ||
    (isEdit && resourceIdsLoading)

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

    const saved = isEdit
      ? await updatePlan.mutateAsync({ id: plan.id, patch: payload })
      : await createPlan.mutateAsync(payload)
    await setResources.mutateAsync({ lessonPlanId: saved.id, resourceIds })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? tr('Edit lesson plan') : tr('New lesson plan')}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr('Cancel')}
          </Button>
          <Button variant="primary" type="submit" form="lesson-form" disabled={saving}>
            {saving ? tr('Saving…') : tr('Save')}
          </Button>
        </>
      }
    >
      <form id="lesson-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <TemplatePicker
            kind="lesson"
            builtIns={lessonTemplates()}
            onPick={(choice) => {
              const fields =
                'saved' in choice
                  ? choice.saved.lesson
                  : lessonTemplates().find((t) => t.id === choice.builtInId)
              if (!fields) return
              const filled = [objectives, materials, activities, homework].some((f) => f.trim())
              if (filled && !window.confirm(tr('Replace what’s written with the template?'))) return
              setObjectives(fields.objectives)
              setMaterials(fields.materials)
              setActivities(fields.activities)
              setHomework(fields.homework)
            }}
            current={() =>
              [objectives, materials, activities, homework].some((f) => f.trim())
                ? { lesson: { objectives, materials, activities, homework } }
                : null
            }
          />
        </div>
        <FormRow label={tr('Date')}>
          <DateSelect value={date} onChange={setDate} required />
        </FormRow>
        <FormRow label={tr('Status')}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as LessonPlanStatus)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormRow>
        <div className="col-span-2">
          <FormRow label={tr('Title / theme')}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </FormRow>
        </div>
        <div className="col-span-2">
          <FormRow label={tr('Objectives')}>
            <Textarea value={objectives} onChange={(e) => setObjectives(e.target.value)} />
          </FormRow>
        </div>
        <FormRow label={tr('Materials')}>
          <Textarea value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </FormRow>
        <FormRow label={tr('Activities / task')}>
          <Textarea value={activities} onChange={(e) => setActivities(e.target.value)} />
        </FormRow>
        <FormRow label={tr('Homework')}>
          <Textarea value={homework} onChange={(e) => setHomework(e.target.value)} />
        </FormRow>
        <FormRow
          label={tr('Linked assessment')}
          hint={tr('Optional — the evidence this lesson builds toward')}
        >
          <Select
            value={linkedAssessmentId}
            onChange={(e) => setLinkedAssessmentId(e.target.value)}
          >
            <option value="">{tr('None')}</option>
            {assessments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <div className="col-span-2">
          <FormRow
            label={tr('Linked resources')}
            hint={tr('Optional — materials from your Resources library used in this lesson')}
          >
            {!resources?.length ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                {tr('No resources in the library yet.')}
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--color-border)] p-2">
                {resources.map((resource) => {
                  const checked = resourceIds.includes(resource.id)
                  return (
                    <label
                      key={resource.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[var(--color-surface-muted)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setResourceIdsOverride((current) =>
                            event.target.checked
                              ? [...(current ?? resourceIds), resource.id]
                              : (current ?? resourceIds).filter((id) => id !== resource.id)
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{resource.title}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {resource.type === 'link'
                          ? tr('Link')
                          : resource.type === 'file'
                            ? tr('File')
                            : tr('Note')}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </FormRow>
        </div>
      </form>
    </Modal>
  )
}
