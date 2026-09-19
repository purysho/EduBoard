import { FormEvent, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { TermsPanel } from './TermsPanel'
import { ImportPanel } from './ImportPanel'
import { BackupPanel } from './BackupPanel'

export function SettingsPage(): React.JSX.Element {
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()

  // `form` must seed from `settings` right away when settings are already cached at
  // mount (e.g. AppShell's own useSettings() call already resolved it), not just on a
  // later change — otherwise this page can mount with data available but never copy it
  // into local state. Re-synced during render (not an effect) if settings changes later.
  const [form, setForm] = useState<AppSettings | null>(settings ?? null)
  const [lastSeenSettings, setLastSeenSettings] = useState(settings)
  if (settings && settings !== lastSeenSettings) {
    setLastSeenSettings(settings)
    setForm(settings)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (form) await updateSettings.mutateAsync(form)
  }

  if (isLoading || !form) return <Spinner />

  return (
    <div>
      <PageHeader title="Settings" description="App-wide defaults, terms, import, and backups." />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <SlidersHorizontal size={15} className="text-[var(--color-text-muted)]" aria-hidden />
              General
            </h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
              <FormRow label="Your name">
                <Input
                  value={form.teacherName}
                  onChange={(e) => setForm({ ...form, teacherName: e.target.value })}
                />
              </FormRow>
              <FormRow label="School / organization">
                <Input
                  value={form.schoolName}
                  onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                />
              </FormRow>
              <FormRow label="Theme">
                <Select
                  value={form.theme}
                  onChange={(e) =>
                    setForm({ ...form, theme: e.target.value as AppSettings['theme'] })
                  }
                >
                  <option value="system">Match system</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </Select>
              </FormRow>
              <FormRow label="Default pass mark (%)" hint="Used when you create a new class">
                <Input
                  type="number"
                  value={form.defaultPassMark}
                  onChange={(e) => setForm({ ...form, defaultPassMark: Number(e.target.value) })}
                />
              </FormRow>
              <div className="col-span-2">
                <Button variant="primary" type="submit" disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <TermsPanel />
        <ImportPanel />
        <BackupPanel />
      </div>
    </div>
  )
}
