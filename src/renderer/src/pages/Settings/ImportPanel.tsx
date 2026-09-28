import { useState } from 'react'
import { CheckCircle2, FileUp, Upload, XCircle } from 'lucide-react'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Select } from '@renderer/components/ui/Field'
import { useClasses } from '@renderer/lib/queries'
import { useQueryClient } from '@tanstack/react-query'
import type { RosterImportResult } from '@shared/importExportTypes'
import { tr } from '@shared/i18n'

/** Roster import from a spreadsheet. With `fixedClassId` (a class's own roster), the
 * students go straight into that class and there's no class to choose. */
export function ImportPanel({ fixedClassId }: { fixedClassId?: string } = {}): React.JSX.Element {
  const { data: classes } = useClasses()
  const queryClient = useQueryClient()
  const [chosenClassId, setClassId] = useState('')
  const classId = fixedClassId ?? chosenClassId
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
          {tr('Import a roster')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          {tr(
            'Import students from a .xlsx or .csv file with “First Name” and “Last Name” columns, or one “Name” (姓名) column. Student number, grade level, email and guardian details are picked up too if present, including Chinese headings such as 学号 and 家长电话.'
          )}
        </p>
        {!fixedClassId && (
          <FormRow
            label={tr('Also enroll into')}
            hint={tr('Optional — leave blank to just add to your student directory')}
          >
            <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">{tr("Don't enroll")}</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormRow>
        )}
        <Button variant="primary" onClick={handleImport} disabled={importing}>
          <Upload size={15} className="mr-1 inline" aria-hidden />
          {importing ? tr('Importing…') : tr('Choose file & import')}
        </Button>
        {result && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm">
            <p className="flex items-center gap-1.5">
              <CheckCircle2 size={15} className="text-[var(--color-success)]" aria-hidden />
              {tr('Imported {imported}, skipped {skipped}.', {
                imported: result.imported,
                skipped: result.skipped
              })}
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
