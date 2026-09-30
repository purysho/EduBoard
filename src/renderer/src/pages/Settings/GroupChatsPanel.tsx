import { useState } from 'react'
import { BellOff, BellRing, Link2, MessagesSquare, Plus, QrCode, Upload, X } from 'lucide-react'
import {
  GROUP_CHAT_KINDS,
  groupChatKindName,
  groupChatProblem,
  groupRouteMode,
  isRobotGroupKind,
  type GroupChat,
  type GroupChatKind
} from '@shared/groupChats'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useClasses, useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm'

type DraftGroup = {
  name: string
  kind: GroupChatKind
  webhook: string
  secret: string
  classId: string
  joinUrl: string
  qrDataUrl: string
  qrExpiresAt: string
  muted: boolean
}

const blank = (): DraftGroup => ({
  name: '',
  kind: 'wecom',
  webhook: '',
  secret: '',
  classId: '',
  joinUrl: '',
  qrDataUrl: '',
  qrExpiresAt: '',
  muted: false
})

const isExpired = (date?: string): boolean =>
  !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < new Date().toISOString().slice(0, 10)

/**
 * Settings → communication destinations.
 *
 * DingTalk / WeCom can receive robot messages. Consumer WeChat / QQ are intentionally
 * manual destinations: EduBoard stores a join QR/link and copies a prepared message for
 * the teacher to paste, rather than pretending those apps expose the same webhook API.
 */
export function GroupChatsPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const { data: classes } = useClasses()
  const update = useUpdateSettings()
  const [draft, setDraft] = useState<DraftGroup | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  if (!settings) return null
  const groups = settings.groupChats ?? []
  const className = (id?: string): string => classes?.find((c) => c.id === id)?.name ?? ''

  const saveGroups = (next: GroupChat[]): void => update.mutate({ groupChats: next })
  const patchGroup = (id: string, patch: Partial<GroupChat>): void =>
    saveGroups(groups.map((group) => (group.id === id ? { ...group, ...patch } : group)))

  const problem = draft ? groupChatProblem(draft) : null
  const robot = draft ? isRobotGroupKind(draft.kind) : false

  async function importQr(): Promise<void> {
    if (!draft) return
    const qr = await window.api.groupChats.pickQr()
    if (qr) setDraft({ ...draft, qrDataUrl: qr })
  }

  async function makeQr(): Promise<void> {
    if (!draft?.joinUrl.trim()) return
    setBusy(true)
    setStatus(null)
    try {
      const qr = await window.api.groupChats.makeQr(draft.joinUrl)
      setDraft({ ...draft, qrDataUrl: qr })
    } catch (e) {
      setStatus({ ok: false, text: ipcErrorMessage(e, tr('Could not make that QR code.')) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <MessagesSquare size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Class communication destinations')}
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr(
            'DingTalk and WeCom can receive EduBoard posts automatically through a group robot. For WeChat and QQ, save the group QR or invite link here; EduBoard copies the prepared message for you to paste into the group. Routing mute controls EduBoard only — it does not change notification settings inside the phone app.'
          )}
        </p>

        {groups.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
            {groups.map((group) => {
              const mode = groupRouteMode(group)
              return (
                <li key={group.id} className="space-y-2 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{group.name}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {groupChatKindName(group.kind)}
                      {group.classId && className(group.classId)
                        ? ` · ${className(group.classId)}`
                        : ''}
                      {' · '}
                      {mode === 'robot'
                        ? tr('automatic send')
                        : mode === 'manual'
                          ? tr('copy and paste')
                          : tr('routing muted')}
                    </span>
                    {isExpired(group.qrExpiresAt) && (
                      <span className="text-xs font-medium text-[var(--color-warning)]">
                        {tr('QR may be expired')}
                      </span>
                    )}
                    <button
                      className="ml-auto rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                      onClick={() => patchGroup(group.id, { muted: !group.muted })}
                      aria-label={group.muted ? tr('Unmute EduBoard routing') : tr('Mute EduBoard routing')}
                      title={group.muted ? tr('Unmute EduBoard routing') : tr('Mute EduBoard routing')}
                    >
                      {group.muted ? <BellOff size={14} aria-hidden /> : <BellRing size={14} aria-hidden />}
                    </button>
                    <button
                      aria-label={tr('Remove {name}', { name: group.name })}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      onClick={() => saveGroups(groups.filter((item) => item.id !== group.id))}
                    >
                      <X size={13} aria-hidden />
                    </button>
                  </div>

                  {(group.qrDataUrl || group.joinUrl) && (
                    <details className="text-xs text-[var(--color-text-muted)]">
                      <summary className="cursor-pointer text-[var(--color-primary)]">
                        {tr('Group join card')}
                      </summary>
                      <div className="mt-2 flex flex-wrap items-start gap-3">
                        {group.qrDataUrl && (
                          <img
                            src={group.qrDataUrl}
                            alt={tr('{name} group QR code', { name: group.name })}
                            className="h-32 w-32 rounded-md border border-[var(--color-border)] bg-white object-contain p-1"
                          />
                        )}
                        <div className="space-y-1">
                          {group.joinUrl && (
                            <p className="max-w-md break-all">
                              <Link2 size={11} className="mr-1 inline" aria-hidden />
                              {group.joinUrl}
                            </p>
                          )}
                          {group.qrExpiresAt && (
                            <p>
                              {tr('QR review date: {date}', { date: group.qrExpiresAt })}
                            </p>
                          )}
                        </div>
                      </div>
                    </details>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {draft ? (
          <div className="space-y-3 rounded-md border border-[var(--color-border)] p-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium">{tr('Service')}</span>
                <select
                  className={inputClass}
                  value={draft.kind}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      kind: e.target.value as GroupChatKind,
                      webhook: '',
                      secret: ''
                    })
                  }
                >
                  {GROUP_CHAT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {groupChatKindName(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium">{tr('Name')}</span>
                <input
                  className={inputClass}
                  value={draft.name}
                  placeholder={tr('e.g. 4B parents')}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
            </div>

            {robot && (
              <>
                <label className="block">
                  <span className="text-xs font-medium">{tr('Robot webhook address')}</span>
                  <input
                    className={`${inputClass} font-mono text-xs`}
                    value={draft.webhook}
                    placeholder={
                      draft.kind === 'dingtalk'
                        ? 'https://oapi.dingtalk.com/robot/send?access_token=…'
                        : 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…'
                    }
                    onChange={(e) => setDraft({ ...draft, webhook: e.target.value.trim() })}
                  />
                </label>
                {draft.kind === 'dingtalk' && (
                  <label className="block">
                    <span className="text-xs font-medium">
                      {tr('Signing secret (加签), if the robot uses one')}
                    </span>
                    <input
                      className={`${inputClass} font-mono text-xs`}
                      value={draft.secret}
                      placeholder="SEC…"
                      onChange={(e) => setDraft({ ...draft, secret: e.target.value.trim() })}
                    />
                  </label>
                )}
              </>
            )}

            <label className="block">
              <span className="text-xs font-medium">{tr('Class')}</span>
              <select
                className={inputClass}
                value={draft.classId}
                onChange={(e) => setDraft({ ...draft, classId: e.target.value })}
              >
                <option value="">{tr('Not for one class')}</option>
                {(classes ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
              <p className="mb-2 text-xs font-medium">{tr('Optional group join card')}</p>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className={inputClass}
                  value={draft.joinUrl}
                  placeholder={tr('Paste an invite link, if the app gives you one')}
                  onChange={(e) => setDraft({ ...draft, joinUrl: e.target.value.trim() })}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!draft.joinUrl.trim() || busy}
                  onClick={makeQr}
                >
                  <QrCode size={13} className="mr-1 inline" aria-hidden />
                  {tr('Make QR')}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={importQr}>
                  <Upload size={13} className="mr-1 inline" aria-hidden />
                  {tr('Import group QR')}
                </Button>
                <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  {tr('QR review / expiry date')}
                  <input
                    type="date"
                    className={inputClass}
                    value={draft.qrExpiresAt}
                    onChange={(e) => setDraft({ ...draft, qrExpiresAt: e.target.value })}
                  />
                </label>
              </div>
              {draft.qrDataUrl && (
                <img
                  src={draft.qrDataUrl}
                  alt={tr('Group QR preview')}
                  className="mt-3 h-36 w-36 rounded-md border border-[var(--color-border)] bg-white object-contain p-1"
                />
              )}
              {!robot && (
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  {tr(
                    'WeChat / QQ routing is manual: EduBoard prepares and copies the message; you paste it into the group. A QR or invite link is for joining the group, not for sending messages.'
                  )}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={draft.muted}
                onChange={(e) => setDraft({ ...draft, muted: e.target.checked })}
              />
              {tr('Start with EduBoard routing muted')}
            </label>

            {problem && <p className="text-xs text-[var(--color-danger)]">{problem}</p>}
            {status && (
              <p
                role="status"
                className={`text-xs ${status.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
              >
                {status.text}
              </p>
            )}

            <div className="flex gap-2">
              {robot && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!!problem || busy}
                  onClick={async () => {
                    setBusy(true)
                    setStatus(null)
                    try {
                      await window.api.groupChats.test({
                        webhook: draft.webhook,
                        secret: draft.secret
                      })
                      setStatus({ ok: true, text: tr('Sent. Check the group for the message.') })
                    } catch (e) {
                      setStatus({
                        ok: false,
                        text: ipcErrorMessage(e, tr('That didn’t work. Try again.'))
                      })
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {tr('Send a test message')}
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                disabled={!!problem || update.isPending}
                onClick={async () => {
                  const group: GroupChat = {
                    id: crypto.randomUUID(),
                    name: draft.name.trim(),
                    kind: draft.kind,
                    webhook: robot ? draft.webhook.trim() : '',
                    ...(draft.kind === 'dingtalk' && draft.secret
                      ? { secret: draft.secret.trim() }
                      : {}),
                    classId: draft.classId,
                    ...(draft.joinUrl ? { joinUrl: draft.joinUrl } : {}),
                    ...(draft.qrDataUrl ? { qrDataUrl: draft.qrDataUrl } : {}),
                    ...(draft.qrExpiresAt ? { qrExpiresAt: draft.qrExpiresAt } : {}),
                    muted: draft.muted
                  }
                  await update.mutateAsync({ groupChats: [...groups, group] })
                  setDraft(null)
                  setStatus(null)
                }}
              >
                {tr('Save destination')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDraft(null)
                  setStatus(null)
                }}
              >
                {tr('Cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <button
            className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
            onClick={() => setDraft(blank())}
          >
            <Plus size={12} aria-hidden />
            {tr('Add a communication destination')}
          </button>
        )}
      </CardBody>
    </Card>
  )
}
