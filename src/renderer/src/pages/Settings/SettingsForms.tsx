// The settings that used to share one long form, each now its own card with its own
// Save: you, AI for you, AI for students, the Portal connection, and the family digest.
import { useState } from 'react'
import { Bot, ClipboardCheck, GraduationCap, Link2, Mail, UserRound } from 'lucide-react'
import {
  DEFAULT_APP_SETTINGS,
  type AiConnectionConfig,
  type AiConnectionTestResult,
  type AppSettings
} from '@shared/types'
import { normalizePortalUrl, portalUrlProblem } from '@shared/portalUrl'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { tr } from '@shared/i18n'
import { trNodes } from '@renderer/lib/trNodes'

const PROVIDER_LABEL: Record<AppSettings['aiProvider'], string> = {
  deepseek: 'DeepSeek',
  qwen: tr('Qwen'),
  zhipu: tr('Zhipu (GLM)'),
  anthropic: 'Anthropic',
  custom: tr('API')
}

/** A form over some settings: a draft once anything changes, saved with the card's
 * own Save button. */
function useSettingsForm<K extends keyof AppSettings>(
  keys: readonly K[]
): {
  form: Pick<AppSettings, K> | null
  set: (patch: Partial<Pick<AppSettings, K>>) => void
  dirty: boolean
  reset: () => void
  save: (transform?: (f: Pick<AppSettings, K>) => Partial<AppSettings>) => Promise<void>
  saving: boolean
} {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const [draft, setDraft] = useState<Pick<AppSettings, K> | null>(null)
  const saved = settings
    ? (Object.fromEntries(keys.map((k) => [k, settings[k]])) as Pick<AppSettings, K>)
    : null
  const form = draft ?? saved
  return {
    form,
    set: (patch) => form && setDraft({ ...form, ...patch }),
    dirty: draft !== null,
    reset: () => setDraft(null),
    saving: update.isPending,
    save: async (transform) => {
      if (!form) return
      await update.mutateAsync(transform ? transform(form) : form)
      setDraft(null)
    }
  }
}

function FormCard({
  icon: Icon,
  title,
  description,
  dirty,
  saving,
  canSave = true,
  onSave,
  onUndo,
  children
}: {
  icon: React.ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>
  title: string
  description?: React.ReactNode
  dirty: boolean
  saving: boolean
  canSave?: boolean
  onSave: () => void
  onUndo: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Icon size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>
        )}
      </CardHeader>
      <CardBody>
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave()
          }}
        >
          {children}
          <div className="col-span-2 flex items-center gap-2">
            <Button
              variant="primary"
              type="submit"
              size="sm"
              disabled={!dirty || !canSave || saving}
            >
              {saving ? tr('Saving…') : tr('Save')}
            </Button>
            {dirty && (
              <>
                <Button variant="ghost" size="sm" type="button" onClick={onUndo}>
                  {tr('Undo changes')}
                </Button>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {tr('Not saved yet.')}
                </span>
              </>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  )
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
      <Button type="button" variant="secondary" size="sm" onClick={run} disabled={testing}>
        {testing ? tr('Testing…') : tr('Test connection')}
      </Button>
      {shown?.ok === true && (
        <span role="status" className="text-xs text-[var(--color-success)]">
          {tr('Works. {model} replied.', { model: shown.model })}
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

export function ProfileCard(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const update = useUpdateSettings()
  const f = useSettingsForm(['teacherName', 'schoolName', 'teacherEmail', 'theme'] as const)
  if (!f.form || !settings) return null
  return (
    <FormCard
      icon={UserRound}
      title={tr('You and your school')}
      dirty={f.dirty}
      saving={f.saving}
      onSave={() => f.save()}
      onUndo={f.reset}
    >
      <FormRow label={tr('Your name')}>
        <Input
          value={f.form.teacherName}
          onChange={(e) => f.set({ teacherName: e.target.value })}
        />
      </FormRow>
      <FormRow label={tr('School / organization')}>
        <Input value={f.form.schoolName} onChange={(e) => f.set({ schoolName: e.target.value })} />
      </FormRow>
      <FormRow
        label={tr('Your email address')}
        hint={tr('Where “Email it to me” sends your own weekly summary (Dashboard → Your week).')}
      >
        <Input
          type="email"
          value={f.form.teacherEmail ?? ''}
          onChange={(e) => f.set({ teacherEmail: e.target.value })}
          placeholder="you@school.edu"
        />
      </FormRow>
      <FormRow label={tr('Theme')}>
        <Select
          value={f.form.theme}
          onChange={(e) => f.set({ theme: e.target.value as AppSettings['theme'] })}
        >
          <option value="system">{tr('Match system')}</option>
          <option value="light">{tr('Light')}</option>
          <option value="dark">{tr('Dark')}</option>
        </Select>
      </FormRow>
      <FormRow label={tr('Language')} hint={tr('Changes straight away.')}>
        <Select
          value={settings.uiLanguage ?? ''}
          onChange={async (e) => {
            await update.mutateAsync({ uiLanguage: e.target.value as AppSettings['uiLanguage'] })
            // Labels are worked out when a screen's code loads, so reload.
            location.reload()
          }}
        >
          <option value="">{tr('Match this computer')}</option>
          <option value="en">{tr('English')}</option>
          <option value="zh">中文（简体）</option>
        </Select>
      </FormRow>
    </FormCard>
  )
}

export function TeacherAiCard(): React.JSX.Element | null {
  const f = useSettingsForm(['aiProvider', 'aiApiKey', 'aiCustomBaseUrl', 'aiCustomModel'] as const)
  if (!f.form) return null
  const form = f.form
  return (
    <FormCard
      icon={Bot}
      title={tr('AI for you')}
      description={tr(
        'Optional. Suggests report-comment phrases, newsletter wording, lesson-plan drafts and feedback, always for you to check. Needs internet. Your key is sent only to that provider.'
      )}
      dirty={f.dirty}
      saving={f.saving}
      onSave={() => f.save()}
      onUndo={f.reset}
    >
      <FormRow
        label={tr('AI provider')}
        hint={tr(
          'DeepSeek/Qwen work without a VPN in mainland China. Custom accepts any OpenAI-compatible endpoint.'
        )}
      >
        <Select
          value={form.aiProvider}
          onChange={(e) => f.set({ aiProvider: e.target.value as AppSettings['aiProvider'] })}
        >
          <option value="deepseek">{tr('DeepSeek')}</option>
          <option value="qwen">{tr('Qwen (Alibaba)')}</option>
          <option value="zhipu">{tr('Zhipu (GLM) — free tier')}</option>
          <option value="anthropic">{tr('Anthropic')}</option>
          <option value="custom">{tr('Custom (OpenAI-compatible)')}</option>
        </Select>
      </FormRow>
      <FormRow
        label={tr('{provider} key', { provider: PROVIDER_LABEL[form.aiProvider] })}
        hint={
          form.aiProvider === 'custom'
            ? tr('Optional — leave blank for a server that needs no key, like local Ollama.')
            : undefined
        }
      >
        <Input
          type="password"
          value={form.aiApiKey}
          onChange={(e) => f.set({ aiApiKey: e.target.value })}
          placeholder={form.aiProvider === 'anthropic' ? tr('sk-ant-…') : tr('sk-…')}
        />
      </FormRow>
      {form.aiProvider === 'custom' && (
        <>
          <FormRow
            label={tr('Custom base URL')}
            hint={tr('e.g. http://localhost:11434/v1 for a local Ollama server')}
          >
            <Input
              value={form.aiCustomBaseUrl}
              onChange={(e) => f.set({ aiCustomBaseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
            />
          </FormRow>
          <FormRow label={tr('Custom model name')}>
            <Input
              value={form.aiCustomModel}
              onChange={(e) => f.set({ aiCustomModel: e.target.value })}
              placeholder={tr('e.g. llama3.1')}
            />
          </FormRow>
        </>
      )}
      <TestAiButton
        config={{
          provider: form.aiProvider,
          apiKey: form.aiApiKey,
          customBaseUrl: form.aiCustomBaseUrl,
          customModel: form.aiCustomModel
        }}
      />
    </FormCard>
  )
}

export function StudentAiCard(): React.JSX.Element | null {
  const f = useSettingsForm([
    'portalAiProvider',
    'portalAiApiKey',
    'portalAiCustomBaseUrl',
    'portalAiCustomModel'
  ] as const)
  if (!f.form) return null
  const form = f.form
  return (
    <FormCard
      icon={GraduationCap}
      title={tr('Student AI (Portal)')}
      description={tr(
        "One shared key every student can use for AI features on the Portal — chatting about their materials, study help. Never sent to students' browsers; the Portal server calls the provider on their behalf. Zhipu's GLM-4-Flash is free (sign up at open.bigmodel.cn), so it's the default. The test below runs from this computer; the Portal server makes the same call."
      )}
      dirty={f.dirty}
      saving={f.saving}
      onSave={() => f.save()}
      onUndo={f.reset}
    >
      <FormRow label={tr('Student AI provider')}>
        <Select
          value={form.portalAiProvider}
          onChange={(e) =>
            f.set({ portalAiProvider: e.target.value as AppSettings['portalAiProvider'] })
          }
        >
          <option value="zhipu">{tr('Zhipu (GLM) — free tier')}</option>
          <option value="deepseek">{tr('DeepSeek')}</option>
          <option value="qwen">{tr('Qwen (Alibaba)')}</option>
          <option value="anthropic">{tr('Anthropic')}</option>
          <option value="custom">{tr('Custom (OpenAI-compatible)')}</option>
        </Select>
      </FormRow>
      <FormRow
        label={tr('{provider} key (students)', { provider: PROVIDER_LABEL[form.portalAiProvider] })}
        hint={tr(
          "Optional — leave blank to keep the Portal's AI features turned off for students."
        )}
      >
        <Input
          type="password"
          value={form.portalAiApiKey}
          onChange={(e) => f.set({ portalAiApiKey: e.target.value })}
          placeholder={tr('sk-…')}
        />
      </FormRow>
      {form.portalAiProvider === 'custom' && (
        <>
          <FormRow label={tr('Custom base URL')}>
            <Input
              value={form.portalAiCustomBaseUrl}
              onChange={(e) => f.set({ portalAiCustomBaseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
            />
          </FormRow>
          <FormRow label={tr('Custom model name')}>
            <Input
              value={form.portalAiCustomModel}
              onChange={(e) => f.set({ portalAiCustomModel: e.target.value })}
              placeholder={tr('e.g. glm-4-flash-250414')}
            />
          </FormRow>
        </>
      )}
      <TestAiButton
        config={{
          provider: form.portalAiProvider,
          apiKey: form.portalAiApiKey,
          customBaseUrl: form.portalAiCustomBaseUrl,
          customModel: form.portalAiCustomModel
        }}
      />
    </FormCard>
  )
}

export function PortalConnectionCard(): React.JSX.Element | null {
  const f = useSettingsForm(['portalUrl', 'portalSyncSecret'] as const)
  if (!f.form) return null
  const form = f.form
  const urlError = portalUrlProblem(form.portalUrl)
  return (
    <FormCard
      icon={Link2}
      title={tr('Connect to your Portal')}
      description={tr(
        'The Portal is the website where students and families sign in. Paste its address and sync secret here, then use “Publish to portal” below.'
      )}
      dirty={f.dirty}
      saving={f.saving}
      canSave={!urlError}
      onSave={() => f.save((x) => ({ ...x, portalUrl: normalizePortalUrl(x.portalUrl) }))}
      onUndo={f.reset}
    >
      <FormRow label={tr('Portal URL')} hint={tr('Where your deployed Portal server lives')}>
        <Input
          value={form.portalUrl}
          onChange={(e) => f.set({ portalUrl: e.target.value })}
          placeholder="https://portal.example.com"
          aria-invalid={urlError ? true : undefined}
        />
        {urlError && <p className="mt-1 text-xs text-[var(--color-danger)]">{urlError}</p>}
        {!urlError &&
          form.portalUrl.trim() &&
          normalizePortalUrl(form.portalUrl) !== form.portalUrl.trim() && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {tr('Will connect to {normalizePortalUrl}', {
                normalizePortalUrl: normalizePortalUrl(form.portalUrl)
              })}
            </p>
          )}
      </FormRow>
      <FormRow
        label={tr('Portal sync secret')}
        hint={tr(
          "The SYNC_SECRET you set on the Portal, or the secret your school's Portal admin gave you"
        )}
      >
        <Input
          type="password"
          value={form.portalSyncSecret}
          onChange={(e) => f.set({ portalSyncSecret: e.target.value })}
        />
      </FormRow>
    </FormCard>
  )
}

export function DigestCard(): React.JSX.Element | null {
  const f = useSettingsForm([
    'digestEnabled',
    'digestSmtpHost',
    'digestSmtpPort',
    'digestSmtpUser',
    'digestSmtpPass',
    'digestFromEmail',
    'digestFromName',
    'digestOptions'
  ] as const)
  if (!f.form) return null
  const form = f.form
  return (
    <FormCard
      icon={Mail}
      title={tr('Weekly parent digest email')}
      description={trNodes(
        'Sends a weekly grades/attendance/homework/Class Story summary to any family who adds their email on the Portal. Sent from the Portal server itself, every Monday morning — a Gmail address with an {appPassword} works fine for this.',
        {
          appPassword: (
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
              {tr('app password')}
            </a>
          )
        }
      )}
      dirty={f.dirty}
      saving={f.saving}
      onSave={() => f.save()}
      onUndo={f.reset}
    >
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.digestEnabled}
          onChange={(e) => f.set({ digestEnabled: e.target.checked })}
        />
        {tr('Enable weekly digest emails')}
      </label>
      {form.digestEnabled && (
        <>
          <FormRow label={tr('SMTP host')}>
            <Input
              value={form.digestSmtpHost}
              onChange={(e) => f.set({ digestSmtpHost: e.target.value })}
              placeholder="smtp.gmail.com"
            />
          </FormRow>
          <FormRow label={tr('SMTP port')}>
            <Input
              type="number"
              value={form.digestSmtpPort}
              onChange={(e) => f.set({ digestSmtpPort: Number(e.target.value) })}
            />
          </FormRow>
          <FormRow label={tr('SMTP username')}>
            <Input
              value={form.digestSmtpUser}
              onChange={(e) => f.set({ digestSmtpUser: e.target.value })}
              placeholder="you@gmail.com"
            />
          </FormRow>
          <FormRow label={tr('SMTP password')}>
            <Input
              type="password"
              value={form.digestSmtpPass}
              onChange={(e) => f.set({ digestSmtpPass: e.target.value })}
            />
          </FormRow>
          <FormRow label={tr('From email')}>
            <Input
              type="email"
              value={form.digestFromEmail}
              onChange={(e) => f.set({ digestFromEmail: e.target.value })}
              placeholder="you@gmail.com"
            />
          </FormRow>
          <FormRow label={tr('From name')} hint={tr('Optional')}>
            <Input
              value={form.digestFromName}
              onChange={(e) => f.set({ digestFromName: e.target.value })}
              placeholder={tr('Ms. Smith')}
            />
          </FormRow>
          <fieldset className="col-span-2">
            <legend className="mb-1 text-sm font-medium">
              {tr('What families get each week')}
            </legend>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
              {(
                [
                  ['grades', tr('Grades')],
                  ['attendance', tr('Attendance')],
                  ['homework', tr('Homework due this week')],
                  ['classStory', tr('Class Story')],
                  ['messages', tr('Unread messages reminder')],
                  ['points', tr('Class points this past week')]
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      key === 'points'
                        ? form.digestOptions?.points === true
                        : form.digestOptions?.[key] !== false
                    }
                    onChange={(e) =>
                      f.set({ digestOptions: { ...form.digestOptions, [key]: e.target.checked } })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {tr(
                'The digest is written in the language EduBoard is in. A newsletter from the Newsletter page goes at the top.'
              )}
            </p>
          </fieldset>
        </>
      )}
    </FormCard>
  )
}

/** How much of each assessment families see on the Portal's Grades page. */
export function PortalScoresCard(): React.JSX.Element | null {
  const f = useSettingsForm(['portalScores'] as const)
  if (!f.form) return null
  const options = { ...DEFAULT_APP_SETTINGS.portalScores, ...f.form.portalScores }
  const toggle = (key: keyof typeof options, on: boolean): void =>
    f.set({ portalScores: { ...options, [key]: on } })
  return (
    <FormCard
      icon={ClipboardCheck}
      title={tr('Scores families see')}
      description={tr(
        'Besides the overall grade and attendance, the Portal can show each marked assessment. Assessments nobody has been marked on yet never show. Changes reach the Portal the next time you publish.'
      )}
      dirty={f.dirty}
      saving={f.saving}
      onSave={() => f.save()}
      onUndo={f.reset}
    >
      <div className="col-span-2 flex flex-col gap-2 text-sm">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={options.assessments}
            onChange={(e) => toggle('assessments', e.target.checked)}
          />
          <span>
            {tr('Show each assessment and the score')}
            <span className="block text-xs text-[var(--color-text-muted)]">
              {tr(
                'With a chart of how scores have gone, late and excused marks, and rubric levels.'
              )}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            disabled={!options.assessments}
            checked={options.assessments && options.comments}
            onChange={(e) => toggle('comments', e.target.checked)}
          />
          <span>
            {tr('Include my comments on scores')}
            <span className="block text-xs text-[var(--color-text-muted)]">
              {tr(
                'Off unless you turn it on, since comments in the gradebook are often notes for yourself. Check them before turning this on.'
              )}
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1"
            disabled={!options.assessments}
            checked={options.assessments && options.classAverage}
            onChange={(e) => toggle('classAverage', e.target.checked)}
          />
          <span>
            {tr('Show the class average')}
            <span className="block text-xs text-[var(--color-text-muted)]">
              {tr(
                'Only once 5 or more students have a score, so nobody’s mark can be worked out from it.'
              )}
            </span>
          </span>
        </label>
      </div>
    </FormCard>
  )
}
