import { useState } from 'react'
import { CheckCircle2, FileUp, Upload, XCircle } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Select } from '@renderer/components/ui/Field'
import { useClasses } from '@renderer/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import type { RosterImportResult } from '@shared/importExportTypes'

export function ImportPanel(): React.JSX.Element {
  const { data: classes } = useClasses()
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<RosterImportResult | null>(null)

  async function handleImport(): Promise<void> {
    const filePath = await window.api.importExport.pickImportFile()
    if (!filePath) return
    setImporting(true)
    setResult(null)
    try {
      const res = await window.api.importExport.importRoster(filePath, classId || undefined)
      setResult(res)
      await queryClient.invalidateQueries()
    } catch (error) {
      setResult({ imported: 0, skipped: 0, errors: [(error as Error).message] })
    } finally {
      setImporting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <FileUp size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Import a roster
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Import students from a .xlsx or .csv file with &quot;First Name&quot; and &quot;Last
          Name&quot; columns (student number, grade level, email, guardian info are also picked up
          if present).
        </p>
        <FormRow
          label="Also enroll into"
          hint="Optional — leave blank to just add to your student directory"
        >
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Don&apos;t enroll</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormRow>
        <Button variant="primary" onClick={handleImport} disabled={importing}>
          <Upload size={15} className="mr-1 inline" aria-hidden />
          {importing ? 'Importing…' : 'Choose file & import'}
        </Button>
        {result && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-[var(--color-success)]" aria-hidden />
              Imported {result.imported}, skipped {result.skipped}.
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[var(--color-danger)]">
                    <XCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
                    {err}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
