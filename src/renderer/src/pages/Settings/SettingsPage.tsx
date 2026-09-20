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
import { PortalPanel } from './PortalPanel'

const PROVIDER_LABEL: Record<AppSettings['aiProvider'], string> = {
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  anthropic: 'Anthropic',
  custom: 'API'
}

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
              <FormRow
                label="AI provider"
                hint="DeepSeek/Qwen work without a VPN in mainland China. Custom accepts any OpenAI-compatible endpoint."
              >
                <Select
                  value={form.aiProvider}
                  onChange={(e) =>
                    setForm({ ...form, aiProvider: e.target.value as AppSettings['aiProvider'] })
                  }
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">Qwen (Alibaba)</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom (OpenAI-compatible)</option>
                </Select>
              </FormRow>
              {form.aiProvider === 'custom' && (
                <>
                  <FormRow
                    label="Custom base URL"
                    hint="e.g. http://localhost:11434/v1 for a local Ollama server"
                  >
                    <Input
                      value={form.aiCustomBaseUrl}
                      onChange={(e) => setForm({ ...form, aiCustomBaseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                    />
                  </FormRow>
                  <FormRow label="Custom model name">
                    <Input
                      value={form.aiCustomModel}
                      onChange={(e) => setForm({ ...form, aiCustomModel: e.target.value })}
                      placeholder="e.g. llama3.1"
                    />
                  </FormRow>
                </>
              )}
              <FormRow
                label={`${PROVIDER_LABEL[form.aiProvider]} key`}
                hint={
                  form.aiProvider === 'custom'
                    ? 'Optional — leave blank for a server that needs no key, like local Ollama.'
                    : 'Optional — enables AI-drafted lesson plans and report comments. Your key is sent only to that provider, never anywhere else.'
                }
              >
                <Input
                  type="password"
                  value={form.aiApiKey}
                  onChange={(e) => setForm({ ...form, aiApiKey: e.target.value })}
                  placeholder={form.aiProvider === 'anthropic' ? 'sk-ant-…' : 'sk-…'}
                />
              </FormRow>
              <FormRow label="Portal URL" hint="Where your deployed Portal server lives">
                <Input
                  value={form.portalUrl}
                  onChange={(e) => setForm({ ...form, portalUrl: e.target.value })}
                  placeholder="https://portal.example.com"
                />
              </FormRow>
              <FormRow
                label="Portal sync secret"
                hint="Must match SYNC_SECRET on the Portal server"
              >
                <Input
                  type="password"
                  value={form.portalSyncSecret}
                  onChange={(e) => setForm({ ...form, portalSyncSecret: e.target.value })}
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
        <PortalPanel />
      </div>
    </div>
  )
}
