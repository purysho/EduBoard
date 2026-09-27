import { useState } from 'react'
import { History } from 'lucide-react'
import type { AuditLogEntry } from '@shared/types'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Badge } from '@renderer/components/ui/Badge'
import { Select } from '@renderer/components/ui/Field'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useAuditLog, useClasses, useStudents } from '@renderer/lib/queries'
import { formatDate, studentFullName } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

const ACTION_TONE: Record<AuditLogEntry['action'], 'neutral' | 'success' | 'warning' | 'danger'> = {
  create: 'success',
  update: 'warning',
  delete: 'danger'
}

const ENTITY_LABEL: Record<string, string> = {
  student: tr('Student'),
  class: tr('Class'),
  enrollment: tr('Enrollment'),
  score: tr('Grade'),
  attendance: tr('Attendance'),
  homeworkAssignment: tr('Homework'),
  homeworkSubmission: tr('Submission')
}

export function AuditLogPage(): React.JSX.Element {
  const [studentId, setStudentId] = useState('')
  const [classId, setClassId] = useState('')
  const { data: students } = useStudents(true)
  const { data: classes } = useClasses(true)
  const { data: entries, isLoading } = useAuditLog({
    studentId: studentId || undefined,
    classId: classId || undefined
  })

  const studentName = new Map((students ?? []).map((s) => [s.id, studentFullName(s)]))
  const className = new Map((classes ?? []).map((c) => [c.id, c.name]))

  return (
    <div>
      <PageHeader
        title={tr('Audit Log')}
        description={tr(
          "Every grade, attendance, enrollment, class, and homework change — who did what, when. A removed student's entries stop appearing here immediately, but are kept for 12 months (see Settings → Backups) before being permanently purged."
        )}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-56">
          <option value="">{tr('All students')}</option>
          {(students ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {studentFullName(s)}
            </option>
          ))}
        </Select>
        <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-56">
          <option value="">{tr('All classes')}</option>
          {(classes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Spinner />
      ) : !entries?.length ? (
        <EmptyState
          icon={History}
          title={tr('No activity yet')}
          description={tr(
            'Grade, attendance, and homework changes will show up here as they happen.'
          )}
        />
      ) : (
        <Card>
          <CardBody className="divide-y divide-[var(--color-border)] !p-0">
            {entries.map((e) => (
              <div key={e.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge tone={ACTION_TONE[e.action]}>
                      {ENTITY_LABEL[e.entityType] ?? e.entityType}
                    </Badge>
                    <p className="text-sm">{e.summary}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {e.studentId && studentName.get(e.studentId)
                      ? studentName.get(e.studentId)
                      : null}
                    {e.studentId && e.classId ? ' · ' : ''}
                    {e.classId && className.get(e.classId) ? className.get(e.classId) : null}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {formatDate(e.createdAt, 'MMM d, yyyy h:mm a')}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
