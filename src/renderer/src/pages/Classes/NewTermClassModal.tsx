import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ClassSection } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { useClassRoster, useDuplicateClassForNewTerm, useTerms } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'

/**
 * Starts the next term of a class: same setup, a term of the teacher's choice and,
 * by default, the same students. Those students keep their Portal logins, since they
 * are the same student records; the new class simply appears for them after the next
 * publish.
 */
export function NewTermClassModal({
  open,
  onClose,
  classSection
}: {
  open: boolean
  onClose: () => void
  classSection: ClassSection
}): React.JSX.Element {
  const navigate = useNavigate()
  const { data: terms } = useTerms()
  const { data: roster } = useClassRoster(classSection.id)
  const duplicate = useDuplicateClassForNewTerm()
  const activeCount = (roster ?? []).filter((r) => r.enrollment.status === 'active').length

  // The term after this class's one, when there is one, is the likely pick.
  const termIndex = (terms ?? []).findIndex((t) => t.id === classSection.termId)
  const suggestedTerm = termIndex >= 0 ? terms?.[termIndex + 1]?.id : undefined

  const [name, setName] = useState(classSection.name)
  const [termId, setTermId] = useState<string | undefined>(undefined)
  const [copyStudents, setCopyStudents] = useState(true)
  const chosenTerm = termId ?? suggestedTerm ?? ''

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    const created = await duplicate.mutateAsync({
      id: classSection.id,
      input: { name: name.trim() || classSection.name, termId: chosenTerm || null, copyStudents }
    })
    onClose()
    navigate(`/classes/${created.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start the next term"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="new-term-class"
            disabled={duplicate.isPending}
          >
            {duplicate.isPending ? 'Creating…' : 'Create class'}
          </Button>
        </>
      }
    >
      <form id="new-term-class" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Makes a new class with this one&apos;s grading scale, categories and course group. Grades,
          attendance and homework stay with {classSection.name}.
        </p>
        <FormRow label="Class name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormRow>
        <FormRow
          label="Term"
          hint={
            terms?.length
              ? undefined
              : 'No terms yet. Add them in Settings → Terms, or set one on the new class later.'
          }
        >
          <Select value={chosenTerm} onChange={(e) => setTermId(e.target.value)}>
            <option value="">No term</option>
            {(terms ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.schoolYear ? ` · ${t.schoolYear}` : ''}
              </option>
            ))}
          </Select>
        </FormRow>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={copyStudents}
            onChange={(e) => setCopyStudents(e.target.checked)}
            disabled={activeCount === 0}
          />
          <span>
            Bring the students across ({activeCount})
            <span className="block text-xs text-[var(--color-text-muted)]">
              They keep their Portal logins: the new class shows up for them after you publish, with
              no new invite or sign-up.
            </span>
          </span>
        </label>
        {duplicate.isError && (
          <p className="text-sm text-[var(--color-danger)]">
            {ipcErrorMessage(duplicate.error, 'Couldn’t create the class.')}
          </p>
        )}
      </form>
    </Modal>
  )
}
