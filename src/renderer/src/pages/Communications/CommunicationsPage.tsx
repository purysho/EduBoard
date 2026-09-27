import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Plus } from 'lucide-react'
import type { ContactMethod } from '@shared/types'
import { CONTACT_METHODS } from '@shared/types'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Badge } from '@renderer/components/ui/Badge'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import {
  useCreateParentCommunication,
  useParentCommunications,
  useStudents,
  useUpdateStudentLogEntry
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { CONTACT_METHOD_LABELS } from '@renderer/lib/parentComms'
import { tr } from '@shared/i18n'

export function CommunicationsPage(): React.JSX.Element {
  const { data: entries, isLoading } = useParentCommunications()
  const updateEntry = useUpdateStudentLogEntry()

  const [search, setSearch] = useState('')
  const [followUpOnly, setFollowUpOnly] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (entries ?? []).filter((e) => {
      if (followUpOnly && !(e.followUpNeeded && !e.followUpDone)) return false
      if (!q) return true
      return e.studentName.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)
    })
  }, [entries, search, followUpOnly])

  const openFollowUps = (entries ?? []).filter((e) => e.followUpNeeded && !e.followUpDone).length

  return (
    <div>
      <PageHeader
        title={tr('Communications')}
        description={tr(
          'Every logged call, email, or in-person conversation with a guardian, across all students.'
        )}
        actions={
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={15} className="mr-1 inline" aria-hidden />
            {tr('Log communication')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tr('Search by student or note…')}
          className="max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={followUpOnly}
            onChange={(e) => setFollowUpOnly(e.target.checked)}
          />
          {tr('Needs follow-up only')}
          {openFollowUps > 0 && <Badge tone="warning">{openFollowUps}</Badge>}
        </label>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !entries?.length ? (
        <EmptyState
          icon={MessageCircle}
          title={tr('No parent communications logged yet')}
          description={tr(
            'Click “Log communication” above to record your first call, email, or in-person conversation.'
          )}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={MessageCircle}
          title={tr('No matches')}
          description={tr('Try a different search or filter.')}
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((entry) => (
            <Card key={entry.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <Link
                        to={`/students/${entry.studentId}`}
                        className="font-semibold hover:text-[var(--color-primary)]"
                      >
                        {entry.studentName}
                      </Link>
                      {entry.contactMethod && (
                        <Badge tone="primary">{CONTACT_METHOD_LABELS[entry.contactMethod]}</Badge>
                      )}
                      {entry.followUpNeeded && !entry.followUpDone && (
                        <Badge tone="warning">{tr('Follow-up needed')}</Badge>
                      )}
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {formatDate(entry.createdAt, 'MMM d, yyyy p')}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{entry.text}</p>
                  </div>
                  {entry.followUpNeeded && (
                    <button
                      className="shrink-0 text-xs text-[var(--color-primary)] hover:underline"
                      onClick={() =>
                        updateEntry.mutate({
                          id: entry.id,
                          studentId: entry.studentId,
                          patch: { followUpDone: !entry.followUpDone }
                        })
                      }
                    >
                      {entry.followUpDone ? tr('Mark follow-up needed') : tr('Mark follow-up done')}
                    </button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}

      <LogCommunicationModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  )
}

function LogCommunicationModal({
  open,
  onClose
}: {
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  const { data: students } = useStudents()
  const createEntry = useCreateParentCommunication()

  const [studentId, setStudentId] = useState('')
  const [contactMethod, setContactMethod] = useState<ContactMethod>('phone')
  const [text, setText] = useState('')
  const [followUpNeeded, setFollowUpNeeded] = useState(false)

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    if (!studentId || !text.trim()) return
    await createEntry.mutateAsync({
      studentId,
      type: 'contact',
      text: text.trim(),
      contactMethod,
      followUpNeeded
    })
    setStudentId('')
    setText('')
    setFollowUpNeeded(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tr('Log communication')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {tr('Cancel')}
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="log-comm-form"
            disabled={!studentId || !text.trim() || createEntry.isPending}
          >
            {createEntry.isPending ? tr('Saving…') : tr('Save')}
          </Button>
        </>
      }
    >
      <form id="log-comm-form" onSubmit={handleSubmit} className="space-y-4">
        <FormRow label={tr('Student')}>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
            <option value="">{tr('Select a student…')}</option>
            {(students ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label={tr('Contact method')}>
          <Select
            value={contactMethod}
            onChange={(e) => setContactMethod(e.target.value as ContactMethod)}
          >
            {CONTACT_METHODS.map((m) => (
              <option key={m} value={m}>
                {CONTACT_METHOD_LABELS[m]}
              </option>
            ))}
          </Select>
        </FormRow>
        <FormRow label={tr('Notes')}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            autoFocus
            placeholder={tr('What was discussed…')}
          />
        </FormRow>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={followUpNeeded}
            onChange={(e) => setFollowUpNeeded(e.target.checked)}
          />
          {tr('Needs follow-up')}
        </label>
      </form>
    </Modal>
  )
}
