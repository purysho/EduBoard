import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Play, Plus, RotateCcw, Square, Trash2, Wifi } from 'lucide-react'
import type { ClassSection, ExitTicketQuestion, ExitTicketQuestionType } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useClearExitTicketResponses,
  useExitTicket,
  useExitTicketResponses,
  useExitTicketServerInfo,
  useSetExitTicketOpen,
  useUpsertExitTicket
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

const MAX_QUESTIONS = 3

function newQuestion(): ExitTicketQuestion {
  return { id: crypto.randomUUID(), prompt: '', type: 'text' }
}

export function ExitTicketTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: ticket, isLoading } = useExitTicket(classSection.id)
  const upsertTicket = useUpsertExitTicket(classSection.id)
  const setOpen = useSetExitTicketOpen(classSection.id)

  const [title, setTitle] = useState(ticket?.title ?? 'Exit Ticket')
  const [questions, setQuestions] = useState<ExitTicketQuestion[]>(
    ticket?.questions.length ? ticket.questions : [newQuestion()]
  )
  const [loadedTicketId, setLoadedTicketId] = useState<string | null>(null)

  // Hydrate the editor from the saved ticket once, during render (not an effect) —
  // same resync pattern used throughout this codebase (see ScoreCell.lastSeenPoints).
  if (ticket && loadedTicketId !== ticket.id) {
    setLoadedTicketId(ticket.id)
    setTitle(ticket.title)
    setQuestions(ticket.questions.length ? ticket.questions : [newQuestion()])
  }

  function updateQuestion(index: number, patch: Partial<ExitTicketQuestion>): void {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)))
  }

  function addQuestion(): void {
    if (questions.length >= MAX_QUESTIONS) return
    setQuestions((prev) => [...prev, newQuestion()])
  }

  function removeQuestion(index: number): void {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave(): Promise<void> {
    await upsertTicket.mutateAsync({
      classId: classSection.id,
      title: title.trim() || 'Exit Ticket',
      questions: questions
        .filter((q) => q.prompt.trim())
        .map((q) => ({
          ...q,
          prompt: q.prompt.trim(),
          options: q.type === 'choice' ? (q.options ?? []).filter(Boolean) : undefined
        }))
    })
  }

  const canSave = questions.some((q) => q.prompt.trim())

  if (isLoading) return <Spinner />

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Questions</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <FormRow label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormRow>

          {questions.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-[var(--color-border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-muted)]">
                  Question {i + 1}
                </span>
                <button
                  className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] disabled:opacity-30"
                  onClick={() => removeQuestion(i)}
                  disabled={questions.length === 1}
                  aria-label="Remove question"
                >
                  <Trash2 size={13} aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    value={q.prompt}
                    onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                    placeholder="e.g. What's one thing you learned today?"
                  />
                </div>
                <Select
                  value={q.type}
                  onChange={(e) =>
                    updateQuestion(i, { type: e.target.value as ExitTicketQuestionType })
                  }
                >
                  <option value="text">Short answer</option>
                  <option value="choice">Multiple choice</option>
                </Select>
              </div>
              {q.type === 'choice' && (
                <Input
                  className="mt-2"
                  value={(q.options ?? []).join(', ')}
                  onChange={(e) =>
                    updateQuestion(i, { options: e.target.value.split(',').map((o) => o.trim()) })
                  }
                  placeholder="Options, comma-separated (e.g. Yes, No, Not sure)"
                />
              )}
            </div>
          ))}

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={addQuestion}
              disabled={questions.length >= MAX_QUESTIONS}
            >
              <Plus size={13} className="mr-1 inline" aria-hidden />
              Question
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!canSave || upsertTicket.isPending}
            >
              {upsertTicket.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {ticket && (
        <SessionPanel
          classId={classSection.id}
          ticketId={ticket.id}
          isOpen={ticket.isOpen}
          onToggleOpen={(open) => setOpen.mutate({ id: ticket.id, isOpen: open })}
          toggling={setOpen.isPending}
        />
      )}
    </div>
  )
}

function SessionPanel({
  classId,
  ticketId,
  isOpen,
  onToggleOpen,
  toggling
}: {
  classId: string
  ticketId: string
  isOpen: boolean
  onToggleOpen: (open: boolean) => void
  toggling: boolean
}): React.JSX.Element {
  const { data: serverInfo } = useExitTicketServerInfo(isOpen)
  const { data: responses } = useExitTicketResponses(ticketId, isOpen)
  const clearResponses = useClearExitTicketResponses(ticketId)
  const [confirmClear, setConfirmClear] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  // The server's routes are keyed by class id (getExitTicketByClass), not the ticket's
  // own id — a class has at most one ticket, so the class id is the stable, natural key
  // for the URL a student's device hits.
  const studentUrl = serverInfo?.url ? `${serverInfo.url}/t/${classId}` : null

  // Fetch the QR code once we have a URL to encode — during render, guarded, rather
  // than an effect, since it's a one-shot derived value keyed to the URL string.
  const [qrForUrl, setQrForUrl] = useState<string | null>(null)
  if (studentUrl && qrForUrl !== studentUrl) {
    setQrForUrl(studentUrl)
    window.api.exitTickets.getQrDataUrl(studentUrl).then(setQrDataUrl)
  } else if (!studentUrl && qrForUrl !== null) {
    setQrForUrl(null)
    setQrDataUrl(null)
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Wifi size={15} className="text-[var(--color-text-muted)]" aria-hidden />
          Session
        </h2>
        <Button
          variant={isOpen ? 'danger' : 'primary'}
          size="sm"
          onClick={() => onToggleOpen(!isOpen)}
          disabled={toggling}
        >
          {isOpen ? (
            <>
              <Square size={13} className="mr-1 inline" aria-hidden />
              Stop session
            </>
          ) : (
            <>
              <Play size={13} className="mr-1 inline" aria-hidden />
              Start session
            </>
          )}
        </Button>
      </CardHeader>
      <CardBody className="space-y-4">
        {!isOpen ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Start a session to let students submit answers from their own devices on this
            classroom&apos;s WiFi — no internet, no app to install, nothing to sign in to.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-4">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR code to the exit ticket"
                  className="h-32 w-32 rounded-lg border border-[var(--color-border)]"
                />
              )}
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Students on this WiFi go to:
                </p>
                <p className="mt-1 break-all text-lg font-semibold">{studentUrl ?? '…'}</p>
                {!serverInfo?.lanIp && (
                  <p className="mt-2 text-xs text-[var(--color-warning)]">
                    Couldn&apos;t detect a network address — make sure this computer is connected to
                    the classroom WiFi (not just powered on).
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <h3 className="text-sm font-semibold">
                Responses {responses ? `(${responses.length})` : ''}
              </h3>
              <button
                className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                onClick={() => setConfirmClear(true)}
              >
                <RotateCcw size={12} aria-hidden />
                Clear
              </button>
            </div>
            {!responses?.length ? (
              <p className="text-sm text-[var(--color-text-muted)]">
                No responses yet — they&apos;ll appear here as students submit.
              </p>
            ) : (
              <ul className="max-h-96 space-y-3 overflow-auto">
                {responses.map((r) => (
                  <li key={r.id} className="rounded-lg border border-[var(--color-border)] p-2.5">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{r.studentName}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatDate(r.submittedAt, 'p')}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-[var(--color-text-muted)]">
                      {Object.values(r.answers).map((answer, i) => (
                        <p key={i}>{answer}</p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardBody>

      <ConfirmDialog
        open={confirmClear}
        title="Clear responses"
        message="Delete all responses for this session? This can't be undone."
        confirmLabel="Clear"
        danger
        onConfirm={async () => {
          await clearResponses.mutateAsync()
          setConfirmClear(false)
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </Card>
  )
}
