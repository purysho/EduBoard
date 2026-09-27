import { useState } from 'react'
import { MessagesSquare, Plus, X } from 'lucide-react'
import { groupChatKind, groupChatProblem, type GroupChat } from '@shared/groupChats'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { useClasses, useSettings, useUpdateSettings } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

const inputClass =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm'

const kindName = (kind: GroupChat['kind']): string =>
  kind === 'dingtalk' ? tr('DingTalk') : tr('WeCom')

const blank = { name: '', webhook: '', secret: '', classId: '' }

/** Settings → Class group chats: the DingTalk / WeCom parent groups EduBoard can post
 * Class Story updates and newsletters into, through each group's robot. */
export function GroupChatsPanel(): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const { data: classes } = useClasses()
  const update = useUpdateSettings()
  const [draft, setDraft] = useState<typeof blank | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  if (!settings) return null
  const groups = settings.groupChats ?? []
  const className = (id?: string): string => classes?.find((c) => c.id === id)?.name ?? ''
  const kind = draft ? groupChatKind(draft.webhook) : null
  const problem = draft ? groupChatProblem(draft) : null

  return (
    <Card>
      <CardHeader>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <MessagesSquare size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          {tr('Class group chats')}
          <span className="text-[10px] font-normal text-[var(--color-text-muted)]">
            {tr('needs internet')}
          </span>
        </h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr(
            'Post Class Story updates and newsletters into a class’s DingTalk (钉钉) or WeCom (企业微信) group. In the group’s settings, add a custom robot (DingTalk: 群设置 → 机器人 → 自定义; WeCom: 添加群机器人) and paste its webhook address here. Everyone in the group sees what you send, so never send anything about a single student.'
          )}
        </p>

        {groups.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
            {groups.map((g) => (
              <li key={g.id} className="flex items-center gap-3 px-3 py-2">
                <span className="font-medium">{g.name}</span>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {kindName(g.kind)}
                  {g.classId && className(g.classId) ? ` · ${className(g.classId)}` : ''}
                </span>
                <button
                  aria-label={tr('Remove {name}', { name: g.name })}
                  className="ml-auto rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                  onClick={() => update.mutate({ groupChats: groups.filter((x) => x.id !== g.id) })}
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <div className="space-y-2 rounded-md border border-[var(--color-border)] p-3">
            <label className="block">
              <span className="text-xs font-medium">{tr('Name')}</span>
              <input
                className={inputClass}
                value={draft.name}
                placeholder={tr('e.g. 4B parents')}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">{tr('Robot webhook address')}</span>
              <input
                className={`${inputClass} font-mono text-xs`}
                value={draft.webhook}
                placeholder="https://oapi.dingtalk.com/robot/send?access_token=…"
                onChange={(e) => setDraft({ ...draft, webhook: e.target.value.trim() })}
              />
              {kind && (
                <span className="text-xs text-[var(--color-success)]">
                  {tr('{service} group robot', { service: kindName(kind) })}
                </span>
              )}
            </label>
            {kind === 'dingtalk' && (
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
            {draft.webhook && problem && (
              <p className="text-xs text-[var(--color-danger)]">{problem}</p>
            )}
            {status && (
              <p
                role="status"
                className={`text-xs ${status.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
              >
                {status.text}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!kind || busy}
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
              <Button
                variant="primary"
                size="sm"
                disabled={!!problem || update.isPending}
                onClick={async () => {
                  await update.mutateAsync({
                    groupChats: [
                      ...groups,
                      {
                        id: crypto.randomUUID(),
                        name: draft.name.trim(),
                        kind: kind!,
                        webhook: draft.webhook,
                        ...(kind === 'dingtalk' && draft.secret ? { secret: draft.secret } : {}),
                        classId: draft.classId
                      }
                    ]
                  })
                  setDraft(null)
                  setStatus(null)
                }}
              >
                {tr('Save group')}
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
            onClick={() => setDraft(blank)}
          >
            <Plus size={12} aria-hidden />
            {tr('Add a group chat')}
          </button>
        )}
      </CardBody>
    </Card>
  )
}
