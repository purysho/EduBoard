import { FormEvent, useState } from 'react'
import { CalendarRange, Pencil, Plus } from 'lucide-react'
import type { Term } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { DateSelect, FormRow, Input } from '@renderer/components/ui/Field'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useCreateTerm, useDeleteTerm, useTerms, useUpdateTerm } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

function termDates(term: Term): string {
  if (term.startDate && term.endDate) {
    return `${formatDate(term.startDate)} – ${formatDate(term.endDate)}`
  }
  if (term.startDate) return `from ${formatDate(term.startDate)}`
  if (term.endDate) return `until ${formatDate(term.endDate)}`
  return 'no dates yet'
}

/** Name, school year and dates of one term; used both to add a term and to edit one. */
function TermFields({
  name,
  setName,
  schoolYear,
  setSchoolYear,
  startDate,
  setStartDate,
  endDate,
  setEndDate
}: {
  name: string
  setName: (v: string) => void
  schoolYear: string
  setSchoolYear: (v: string) => void
  startDate: string
  setStartDate: (v: string) => void
  endDate: string
  setEndDate: (v: string) => void
}): React.JSX.Element {
  return (
    <>
      <FormRow label="Name">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Term 1" />
      </FormRow>
      <FormRow label="School year">
        <Input
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
          placeholder="2026-2027"
        />
      </FormRow>
      <FormRow label="Start date">
        <DateSelect value={startDate} onChange={setStartDate} />
      </FormRow>
      <FormRow label="End date">
        <DateSelect value={endDate} onChange={setEndDate} />
      </FormRow>
    </>
  )
}

function EditTermForm({ term, onDone }: { term: Term; onDone: () => void }): React.JSX.Element {
  const updateTerm = useUpdateTerm()
  const [name, setName] = useState(term.name)
  const [schoolYear, setSchoolYear] = useState(term.schoolYear)
  const [startDate, setStartDate] = useState(term.startDate ?? '')
  const [endDate, setEndDate] = useState(term.endDate ?? '')

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) return
    await updateTerm.mutateAsync({
      id: term.id,
      patch: {
        name: name.trim(),
        schoolYear: schoolYear.trim(),
        startDate: startDate || null,
        endDate: endDate || null
      }
    })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 py-3">
      <TermFields
        {...{
          name,
          setName,
          schoolYear,
          setSchoolYear,
          startDate,
          setStartDate,
          endDate,
          setEndDate
        }}
      />
      <div className="col-span-2 flex gap-2">
        <Button variant="primary" size="sm" type="submit" disabled={updateTerm.isPending}>
          Save
        </Button>
        <Button variant="ghost" size="sm" type="button" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function TermsPanel(): React.JSX.Element {
  const { data: terms } = useTerms()
  const createTerm = useCreateTerm()
  const deleteTerm = useDeleteTerm()

  const [name, setName] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Term | null>(null)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!name.trim()) return
    await createTerm.mutateAsync({
      name: name.trim(),
      schoolYear: schoolYear.trim(),
      startDate: startDate || null,
      endDate: endDate || null,
      sortOrder: terms?.length ?? 0
    })
    setName('')
    setSchoolYear('')
    setStartDate('')
    setEndDate('')
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarRange size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Terms
        </h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          Dates are optional and can be changed any time with Edit.
        </p>
      </CardHeader>
      <CardBody className="space-y-4">
        {!!terms?.length && (
          <ul className="divide-y divide-[var(--color-border)]">
            {terms.map((term) =>
              editingId === term.id ? (
                <li key={term.id}>
                  <EditTermForm term={term} onDone={() => setEditingId(null)} />
                </li>
              ) : (
                <li key={term.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    {term.name}
                    {term.schoolYear && (
                      <span className="text-[var(--color-text-muted)]"> · {term.schoolYear}</span>
                    )}
                    <span className="text-[var(--color-text-muted)]"> · {termDates(term)}</span>
                  </span>
                  <span className="flex shrink-0 gap-3">
                    <button
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      onClick={() => setEditingId(term.id)}
                    >
                      <Pencil size={11} className="mr-1 inline" aria-hidden />
                      Edit
                    </button>
                    <button
                      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      onClick={() => setDeleting(term)}
                    >
                      Delete
                    </button>
                  </span>
                </li>
              )
            )}
          </ul>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <TermFields
            {...{
              name,
              setName,
              schoolYear,
              setSchoolYear,
              startDate,
              setStartDate,
              endDate,
              setEndDate
            }}
          />
          <div className="col-span-2">
            <Button variant="secondary" type="submit" disabled={createTerm.isPending}>
              <Plus size={14} className="mr-1 inline" aria-hidden />
              Add term
            </Button>
          </div>
        </form>
      </CardBody>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this term'}?`}
        message="Classes in this term are kept, with no term set. To change the dates instead, use Edit."
        confirmLabel="Delete term"
        danger
        onConfirm={() => {
          if (deleting) deleteTerm.mutate(deleting.id)
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </Card>
  )
}
