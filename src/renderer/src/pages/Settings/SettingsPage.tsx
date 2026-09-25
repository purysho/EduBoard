import { FormEvent, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import type { AiConnectionConfig, AiConnectionTestResult, AppSettings } from '@shared/types'
import { portalUrlProblem } from '@shared/portalUrl'
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
  zhipu: 'Zhipu (GLM)',
  anthropic: 'Anthropic',
  custom: 'API'
}

/** Sends one tiny request with what's in the form right now, saved or not. The result
 * is cleared whenever the provider, key or model changes, so a stale "Works" never
 * sits next to a different key. */
function TestAiButton({ config }: { config: AiConnectionConfig }): React.JSX.Element {
  const signature = JSON.stringify(config)
  const [result, setResult] = useState<{ for: string; value: AiConnectionTestResult } | null>(null)
  const [testing, setTesting] = useState(false)
  const shown = result?.for === signature ? result.value : null

  async function run(): Promise<void> {
    setTesting(true)
    try {
      setResult({ for: signature, value: await window.api.ai.testConnection(config) })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="col-span-2 -mt-1 flex flex-wrap items-center gap-3">
      <Button type="button" variant="secondary" onClick={run} disabled={testing}>
        {testing ? 'Testing…' : 'Test connection'}
      </Button>
      {shown?.ok === true && (
        <span role="status" className="text-xs text-[var(--color-success)]">
          Works. {shown.model} replied.
        </span>
      )}
      {shown?.ok === false && (
        <span role="alert" className="text-xs text-[var(--color-danger)]">
          {shown.error}
        </span>
      )}
    </div>
  )
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
  const portalUrlError = portalUrlProblem(form.portalUrl)

  return (
    <div>
      <PageHeader
        title="Settings"
        description="App-wide defaults, terms, import, and backups."
        actions={
          settings?.onboardingDismissed ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => updateSettings.mutate({ onboardingDismissed: false })}
            >
              Show getting-started checklist
            </Button>
          ) : null
        }
      />

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
                  <option value="zhipu">Zhipu (GLM) — free tier</option>
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
              <TestAiButton
                config={{
                  provider: form.aiProvider,
                  apiKey: form.aiApiKey,
                  customBaseUrl: form.aiCustomBaseUrl,
                  customModel: form.aiCustomModel
                }}
              />
              <FormRow label="Portal URL" hint="Where your deployed Portal server lives">
                <Input
                  value={form.portalUrl}
                  onChange={(e) => setForm({ ...form, portalUrl: e.target.value })}
                  placeholder="https://portal.example.com"
                  aria-invalid={portalUrlError ? true : undefined}
                />
                {portalUrlError && (
                  <p className="mt-1 text-xs text-[var(--color-danger)]">{portalUrlError}</p>
                )}
              </FormRow>
              <FormRow
                label="Portal sync secret"
                hint="The SYNC_SECRET you set on the Portal, or the secret your school's Portal admin gave you"
              >
                <Input
                  type="password"
                  value={form.portalSyncSecret}
                  onChange={(e) => setForm({ ...form, portalSyncSecret: e.target.value })}
                />
              </FormRow>
              <div className="col-span-2 mt-2 border-t border-[var(--color-border)] pt-4">
                <h3 className="mb-1 text-sm font-semibold">Student AI (Portal)</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  One shared key every student can use for AI features on the Portal — chatting
                  about their materials, study help. Never sent to students&apos; browsers; the
                  Portal server calls the provider on their behalf. Zhipu&apos;s GLM-4-Flash is free
                  (sign up at open.bigmodel.cn), so it&apos;s the default. The test below runs from
                  this computer; the Portal server makes the same call.
                </p>
              </div>
              <FormRow label="Student AI provider">
                <Select
                  value={form.portalAiProvider}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      portalAiProvider: e.target.value as AppSettings['portalAiProvider']
                    })
                  }
                >
                  <option value="zhipu">Zhipu (GLM) — free tier</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="qwen">Qwen (Alibaba)</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">Custom (OpenAI-compatible)</option>
                </Select>
              </FormRow>
              {form.portalAiProvider === 'custom' && (
                <>
                  <FormRow label="Custom base URL">
                    <Input
                      value={form.portalAiCustomBaseUrl}
                      onChange={(e) => setForm({ ...form, portalAiCustomBaseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                    />
                  </FormRow>
                  <FormRow label="Custom model name">
                    <Input
                      value={form.portalAiCustomModel}
                      onChange={(e) => setForm({ ...form, portalAiCustomModel: e.target.value })}
                      placeholder="e.g. glm-4-flash-250414"
                    />
                  </FormRow>
                </>
              )}
              <FormRow
                label={`${PROVIDER_LABEL[form.portalAiProvider]} key (students)`}
                hint="Optional — leave blank to keep the Portal's AI features turned off for students."
              >
                <Input
                  type="password"
                  value={form.portalAiApiKey}
                  onChange={(e) => setForm({ ...form, portalAiApiKey: e.target.value })}
                  placeholder="sk-…"
                />
              </FormRow>
              <TestAiButton
                config={{
                  provider: form.portalAiProvider,
                  apiKey: form.portalAiApiKey,
                  customBaseUrl: form.portalAiCustomBaseUrl,
                  customModel: form.portalAiCustomModel
                }}
              />
              <div className="col-span-2 mt-2 border-t border-[var(--color-border)] pt-4">
                <h3 className="mb-1 text-sm font-semibold">Weekly parent digest email</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Sends a weekly grades/attendance/homework/Class Story summary to any family who
                  adds their email on the Portal. Sent from the Portal server itself, every Monday
                  morning — a Gmail address with an{' '}
                  <a
                    className="text-[var(--color-primary)] underline"
                    href="https://support.google.com/accounts/answer/185833"
                    onClick={(e) => {
                      e.preventDefault()
                      window.api.lessonResources.openExternal(
                        'https://support.google.com/accounts/answer/185833'
                      )
                    }}
                  >
                    app password
                  </a>{' '}
                  works fine for this.
                </p>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.digestEnabled}
                  onChange={(e) => setForm({ ...form, digestEnabled: e.target.checked })}
                />
                Enable weekly digest emails
              </label>
              {form.digestEnabled && (
                <>
                  <FormRow label="SMTP host">
                    <Input
                      value={form.digestSmtpHost}
                      onChange={(e) => setForm({ ...form, digestSmtpHost: e.target.value })}
                      placeholder="smtp.gmail.com"
                    />
                  </FormRow>
                  <FormRow label="SMTP port">
                    <Input
                      type="number"
                      value={form.digestSmtpPort}
                      onChange={(e) => setForm({ ...form, digestSmtpPort: Number(e.target.value) })}
                    />
                  </FormRow>
                  <FormRow label="SMTP username">
                    <Input
                      value={form.digestSmtpUser}
                      onChange={(e) => setForm({ ...form, digestSmtpUser: e.target.value })}
                      placeholder="you@gmail.com"
                    />
                  </FormRow>
                  <FormRow label="SMTP password">
                    <Input
                      type="password"
                      value={form.digestSmtpPass}
                      onChange={(e) => setForm({ ...form, digestSmtpPass: e.target.value })}
                    />
                  </FormRow>
                  <FormRow label="From email">
                    <Input
                      type="email"
                      value={form.digestFromEmail}
                      onChange={(e) => setForm({ ...form, digestFromEmail: e.target.value })}
                      placeholder="you@gmail.com"
                    />
                  </FormRow>
                  <FormRow label="From name" hint="Optional">
                    <Input
                      value={form.digestFromName}
                      onChange={(e) => setForm({ ...form, digestFromName: e.target.value })}
                      placeholder="Ms. Smith"
                    />
                  </FormRow>
                </>
              )}
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
