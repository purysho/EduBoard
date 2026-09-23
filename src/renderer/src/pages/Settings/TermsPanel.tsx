import { FormEvent, useState } from 'react'
import { CalendarRange, Plus } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { DateSelect, FormRow, Input } from '@renderer/components/ui/Field'
import { useCreateTerm, useDeleteTerm, useTerms } from '@renderer/lib/queries'

export function TermsPanel(): React.JSX.Element {
  const { data: terms } = useTerms()
  const createTerm = useCreateTerm()
  const deleteTerm = useDeleteTerm()

  const [name, setName] = useState('')
  const [schoolYear, setSchoolYear] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

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
      </CardHeader>
      <CardBody className="space-y-4">
        {!!terms?.length && (
          <ul className="divide-y divide-[var(--color-border)]">
            {terms.map((term) => (
              <li key={term.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {term.name}{' '}
                  <span className="text-[var(--color-text-muted)]">· {term.schoolYear}</span>
                </span>
                <button
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => deleteTerm.mutate(term.id)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleSubmit} className="grid grid-cols-4 gap-3">
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
          <div className="col-span-4">
            <Button variant="secondary" type="submit" disabled={createTerm.isPending}>
              <Plus size={14} className="mr-1 inline" aria-hidden />
              Add term
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
