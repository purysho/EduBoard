import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Badge } from '@renderer/components/ui/Badge'
import { Input } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useParentCommunications, useUpdateStudentLogEntry } from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'
import { CONTACT_METHOD_LABELS } from '@renderer/lib/parentComms'

export function CommunicationsPage(): React.JSX.Element {
  const { data: entries, isLoading } = useParentCommunications()
  const updateEntry = useUpdateStudentLogEntry()

  const [search, setSearch] = useState('')
  const [followUpOnly, setFollowUpOnly] = useState(false)

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
        title="Communications"
        description="Every logged call, email, or in-person conversation with a guardian, across all students."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by student or note…"
          className="max-w-xs"
        />
        <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={followUpOnly}
            onChange={(e) => setFollowUpOnly(e.target.checked)}
          />
          Needs follow-up only
          {openFollowUps > 0 && <Badge tone="warning">{openFollowUps}</Badge>}
        </label>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !entries?.length ? (
        <EmptyState
          icon={MessageCircle}
          title="No parent communications logged yet"
          description={
            'Log a call, email, or in-person conversation from a student’s profile page — it will show up here.'
          }
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={MessageCircle}
          title="No matches"
          description="Try a different search or filter."
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
                        <Badge tone="warning">Follow-up needed</Badge>
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
                      Mark follow-up {entry.followUpDone ? 'needed' : 'done'}
                    </button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </ul>
      )}
    </div>
  )
}
