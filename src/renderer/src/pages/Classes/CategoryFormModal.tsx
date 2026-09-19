import { FormEvent, useState } from 'react'
import type { GradeCategory } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input } from '@renderer/components/ui/Field'
import { useCreateGradeCategory, useUpdateGradeCategory } from '@renderer/lib/queries'

export function CategoryFormModal({
  open,
  onClose,
  classId,
  category,
  nextSortOrder
}: {
  open: boolean
  onClose: () => void
  classId: string
  category?: GradeCategory
  nextSortOrder: number
}): React.JSX.Element {
  const isEdit = !!category
  const createCategory = useCreateGradeCategory(classId)
  const updateCategory = useUpdateGradeCategory(classId)

  const [name, setName] = useState(category?.name ?? '')
  const [weightPercent, setWeightPercent] = useState(category?.weightPercent ?? 0)

  const saving = createCategory.isPending || updateCategory.isPending

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (isEdit) {
      await updateCategory.mutateAsync({
        id: category.id,
        patch: { name: name.trim(), weightPercent: Number(weightPercent) }
      })
    } else {
      await createCategory.mutateAsync({
        classId,
        name: name.trim(),
        weightPercent: Number(weightPercent),
        sortOrder: nextSortOrder
      })
    }
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit category' : 'New grade category'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="category-form" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
        <FormRow label="Name" hint='e.g. "Homework", "Exams", "Speaking"'>
          <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </FormRow>
        <FormRow label="Weight (%)">
          <Input
            type="number"
            min={0}
            max={100}
            value={weightPercent}
            onChange={(e) => setWeightPercent(Number(e.target.value))}
          />
        </FormRow>
      </form>
    </Modal>
  )
}
