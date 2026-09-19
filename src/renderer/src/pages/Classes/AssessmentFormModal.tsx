import { FormEvent, useState } from 'react'
import type { Assessment, GradeCategory } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { useCreateAssessment, useUpdateAssessment } from '@renderer/lib/queries'
import { todayIso } from '@renderer/lib/format'

export function AssessmentFormModal({
  open,
  onClose,
  classId,
  categories,
  assessment
}: {
  open: boolean
  onClose: () => void
  classId: string
  categories: GradeCategory[]
  assessment?: Assessment
}): React.JSX.Element {
  const isEdit = !!assessment
  const createAssessment = useCreateAssessment(classId)
  const updateAssessment = useUpdateAssessment(classId)

  const [name, setName] = useState(assessment?.name ?? '')
  const [categoryId, setCategoryId] = useState(assessment?.categoryId ?? '')
  const [assessmentDate, setAssessmentDate] = useState(assessment?.assessmentDate ?? todayIso())
  const [maxScore, setMaxScore] = useState(assessment?.maxScore ?? 100)
  const [isFinal, setIsFinal] = useState(assessment?.isFinal ?? false)

  const saving = createAssessment.isPending || updateAssessment.isPending

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const payload = {
      classId,
      categoryId: categoryId || null,
      name: name.trim(),
      description: assessment?.description ?? null,
      assessmentDate: assessmentDate || null,
      maxScore: Number(maxScore) || 100,
      isFinal
    }

    if (isEdit) {
      await updateAssessment.mutateAsync({ id: assessment.id, patch: payload })
    } else {
      await createAssessment.mutateAsync(payload)
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit assessment' : 'New assessment'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="assessment-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="assessment-form" onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Name" hint='e.g. "Unit 3 Quiz", "Midterm Exam"'>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </FormRow>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormRow>
          <FormRow label="Max score">
            <Input
              type="number"
              min={1}
              value={maxScore}
              onChange={(e) => setMaxScore(Number(e.target.value))}
            />
          </FormRow>
          <FormRow label="Date">
            <Input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
            />
          </FormRow>
          <FormRow label="Final?">
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFinal}
                onChange={(e) => setIsFinal(e.target.checked)}
              />
              Counts as a final/summative assessment
            </label>
          </FormRow>
        </div>
      </form>
    </Modal>
  )
}
