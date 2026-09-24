import { FormEvent, useEffect, useState } from 'react'
import { Languages, MessageSquare, Send } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ipcErrorMessage } from '@renderer/lib/format'
import {
  useMarkPortalThreadRead,
  usePortalMessageThreads,
  useSendPortalMessage,
  useTranslatePortalMessage
} from '@renderer/lib/queries'

// Fixed target — the app's own UI is English, so "translate" for a teacher always
// means "show me this in English." (The student/family side of the same feature, on
// the Portal itself, offers the reverse: translate the teacher's message into whatever
// language the family picked.)
const TARGET_LANG = 'English'

export function MessagesPage(): React.JSX.Element {
  const { data: threads, isLoading, isError, error } = usePortalMessageThreads()
  const markRead = useMarkPortalThreadRead()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = threads?.find((t) => t.accountId === selectedId) ?? null

  useEffect(() => {
    if (selectedId && selected && selected.unread > 0) markRead.mutate(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.unread])

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Direct messages with families through the Portal."
      />

      {isLoading ? (
        <Spinner />
      ) : isError ? (
        <p className="text-sm text-[var(--color-danger)]">
          {ipcErrorMessage(error, 'Could not load messages.')}
        </p>
      ) : !threads?.length ? (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Once families are on the Portal, their messages to you will show up here."
        />
      ) : (
        <div className="grid grid-cols-[260px_1fr] gap-4" style={{ minHeight: 480 }}>
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-[var(--color-border)]">
              {threads.map((t) => (
                <li key={t.accountId}>
                  <button
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--color-surface-muted)] ${
                      t.accountId === selectedId ? 'bg-[var(--color-surface-muted)]' : ''
                    }`}
                    onClick={() => setSelectedId(t.accountId)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {t.studentNames || t.username}
                      </span>
                      <span className="block truncate text-xs text-[var(--color-text-muted)]">
                        {t.messages[t.messages.length - 1]?.body ?? ''}
                      </span>
                    </span>
                    {t.unread > 0 && <Badge tone="primary">{t.unread}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {selected ? (
            <ThreadPanel
              accountId={selected.accountId}
              label={selected.studentNames || selected.username}
            />
          ) : (
            <Card className="flex items-center justify-center text-sm text-[var(--color-text-muted)]">
              Select a conversation
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function ThreadPanel({
  accountId,
  label
}: {
  accountId: string
  label: string
}): React.JSX.Element {
  const { data: threads } = usePortalMessageThreads()
  const sendMessage = useSendPortalMessage()
  const translateMessage = useTranslatePortalMessage()
  const [body, setBody] = useState('')
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [translatingId, setTranslatingId] = useState<string | null>(null)

  const thread = threads?.find((t) => t.accountId === accountId)

  async function handleTranslate(messageId: string): Promise<void> {
    if (translations[messageId] !== undefined) {
      setTranslations((prev) => {
        const next = { ...prev }
        delete next[messageId]
        return next
      })
      return
    }
    setTranslatingId(messageId)
    try {
      const translated = await translateMessage.mutateAsync({
        messageId,
        targetLang: TARGET_LANG
      })
      setTranslations((prev) => ({ ...prev, [messageId]: translated }))
    } catch {
      // Silently ignored — the original text is still shown, and the button stays
      // available to try again (e.g. if the teacher hasn't set up an AI key yet).
    } finally {
      setTranslatingId(null)
    }
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!body.trim()) return
    await sendMessage.mutateAsync({ accountId, body: body.trim() })
    setBody('')
  }

  return (
    <Card className="flex flex-col p-0">
      <div className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold">
        {label}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {thread?.messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.sender === 'teacher' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                m.sender === 'teacher'
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-muted)] text-[var(--color-text)]'
              }`}
            >
              <p className="whitespace-pre-wrap">{translations[m.id] ?? m.body}</p>
              <div
                className={`mt-1 flex items-center gap-2 text-[10px] ${m.sender === 'teacher' ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}
              >
                <span>{new Date(m.createdAt).toLocaleString()}</span>
                <button
                  type="button"
                  onClick={() => handleTranslate(m.id)}
                  disabled={translatingId === m.id}
                  className="inline-flex items-center gap-0.5 underline decoration-dotted hover:opacity-80 disabled:opacity-50"
                >
                  <Languages size={10} aria-hidden />
                  {translatingId === m.id
                    ? 'Translating…'
                    : translations[m.id] !== undefined
                      ? 'Show original'
                      : 'Translate'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 border-t border-[var(--color-border)] p-3"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={!body.trim() || sendMessage.isPending}
        >
          <Send size={14} aria-hidden />
        </Button>
      </form>
    </Card>
  )
}
