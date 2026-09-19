import { FormEvent, useState } from 'react'
import { BookMarked, Plus } from 'lucide-react'
import type { Standard } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input } from '@renderer/components/ui/Field'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useCreateStandard,
  useDeleteStandard,
  useStandards,
  useUpdateStandard
} from '@renderer/lib/queries'

export function StandardsPanel(): React.JSX.Element {
  const { data: standards } = useStandards()
  const createStandard = useCreateStandard()
  const updateStandard = useUpdateStandard()
  const deleteStandard = useDeleteStandard()

  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [subject, setSubject] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Standard | null>(null)

  function startEdit(standard: Standard): void {
    setEditingId(standard.id)
    setCode(standard.code)
    setDescription(standard.description)
    setSubject(standard.subject ?? '')
  }

  function resetForm(): void {
    setEditingId(null)
    setCode('')
    setDescription('')
    setSubject('')
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!code.trim() || !description.trim()) return
    const payload = {
      code: code.trim(),
      description: description.trim(),
      subject: subject.trim() || null
    }
    if (editingId) {
      await updateStandard.mutateAsync({ id: editingId, patch: payload })
    } else {
      await createStandard.mutateAsync(payload)
    }
    resetForm()
  }

  const saving = createStandard.isPending || updateStandard.isPending

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <BookMarked size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Standards
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Your own list of standards (Common Core, state, or anything you define) — tag them onto
          rubric criteria to track coverage.
        </p>

        {!!standards?.length && (
          <ul className="divide-y divide-[var(--color-border)]">
            {standards.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{s.code}</span>{' '}
                  <span className="text-[var(--color-text-muted)]">{s.description}</span>
                  {s.subject && (
                    <span className="ml-1.5 rounded-full bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
                      {s.subject}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                    onClick={() => startEdit(s)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                    onClick={() => setPendingDelete(s)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-6 gap-3">
          <div className="col-span-2">
            <FormRow label="Code">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="CCSS.W.5.1"
              />
            </FormRow>
          </div>
          <div className="col-span-3">
            <FormRow label="Description">
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Write opinion pieces on topics..."
              />
            </FormRow>
          </div>
          <div className="col-span-1">
            <FormRow label="Subject">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="ELA"
              />
            </FormRow>
          </div>
          <div className="col-span-6 flex gap-2">
            <Button variant="secondary" type="submit" disabled={saving}>
              <Plus size={14} className="mr-1 inline" aria-hidden />
              {editingId ? 'Save changes' : 'Add standard'}
            </Button>
            {editingId && (
              <Button variant="ghost" type="button" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardBody>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete standard"
        message={`Delete "${pendingDelete?.code}"? Rubric criteria tagged with it will keep their text but lose the link.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (pendingDelete) await deleteStandard.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </Card>
  )
}
