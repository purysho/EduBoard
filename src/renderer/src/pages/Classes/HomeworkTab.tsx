import { FormEvent, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ClipboardList, Plus, Trash2 } from 'lucide-react'
import type { ClassSection, HomeworkAssignment, HomeworkSubmissionStatus } from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { FormRow, Input, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useCreateHomeworkAssignment,
  useDeleteHomeworkAssignment,
  useHomeworkAssignments,
  useHomeworkSubmissions,
  useSetHomeworkSubmissionStatus
} from '@renderer/lib/queries'
import { formatDate } from '@renderer/lib/format'

const STATUS_LABEL: Record<HomeworkSubmissionStatus, string> = {
  not_started: 'Not started',
  submitted: 'Submitted',
  done: 'Done'
}
const STATUS_TONE: Record<HomeworkSubmissionStatus, 'neutral' | 'warning' | 'success'> = {
  not_started: 'neutral',
  submitted: 'warning',
  done: 'success'
}
const STATUS_CYCLE: Record<HomeworkSubmissionStatus, HomeworkSubmissionStatus> = {
  not_started: 'submitted',
  submitted: 'done',
  done: 'not_started'
}

export function HomeworkTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: assignments, isLoading } = useHomeworkAssignments(classSection.id)
  const deleteAssignment = useDeleteHomeworkAssignment(classSection.id)

  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<HomeworkAssignment | null>(null)
  const [pendingDelete, setPendingDelete] = useState<HomeworkAssignment | null>(null)

  if (isLoading) return <Spinner />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} className="mr-1 inline" aria-hidden />
          Assignment
        </Button>
      </div>

      {!assignments?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No homework assignments yet"
          description="Once the Portal is live, university-level students see these and mark them done."
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              Assignment
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex items-start justify-between gap-4">
                <button className="min-w-0 text-left" onClick={() => setSelected(a)}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold hover:text-[var(--color-primary)]">
                      {a.title}
                    </h3>
                    {a.dueDate && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        Due {formatDate(a.dueDate)}
                      </span>
                    )}
                  </div>
                  {a.description && (
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{a.description}</p>
                  )}
                </button>
                <Button variant="ghost" size="sm" onClick={() => setPendingDelete(a)}>
                  <Trash2 size={13} className="mr-1 inline" aria-hidden />
                  Delete
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <NewAssignmentModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        classId={classSection.id}
      />
      {selected && (
        <SubmissionsModal
          assignment={selected}
          classId={classSection.id}
          onClose={() => setSelected(null)}
        />
      )}
      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete assignment"
        message={`Delete "${pendingDelete?.title}"? This also removes everyone's submission status.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          if (pendingDelete) await deleteAssignment.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

function NewAssignmentModal({
  open,
  onClose,
  classId
}: {
  open: boolean
  onClose: () => void
  classId: string
}): React.JSX.Element {
  const createAssignment = useCreateHomeworkAssignment(classId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    await createAssignment.mutateAsync({
      classId,
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || null
    })
    setTitle('')
    setDescription('')
    setDueDate('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New assignment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="homework-form"
            disabled={!title.trim() || createAssignment.isPending}
          >
            {createAssignment.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form id="homework-form" onSubmit={handleSubmit} className="space-y-4">
        <FormRow label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </FormRow>
        <FormRow label="Due date" hint="Optional">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </FormRow>
        <FormRow label="Description" hint="Optional">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormRow>
      </form>
    </Modal>
  )
}

function SubmissionsModal({
  assignment,
  classId,
  onClose
}: {
  assignment: HomeworkAssignment
  classId: string
  onClose: () => void
}): React.JSX.Element {
  const { data: submissions, isLoading } = useHomeworkSubmissions(assignment.id, classId)
  const setStatus = useSetHomeworkSubmissionStatus()

  return (
    <Modal open onClose={onClose} title={assignment.title} wide>
      {isLoading ? (
        <Spinner />
      ) : !submissions?.length ? (
        <p className="text-sm text-[var(--color-text-muted)]">No students enrolled.</p>
      ) : (
        <div>
          <p className="mb-3 text-xs text-[var(--color-text-muted)]">
            Click a status to cycle Not started → Submitted → Done.
          </p>
          <ul className="divide-y divide-[var(--color-border)]">
            {submissions.map((s) => (
              <li key={s.studentId} className="flex items-center justify-between py-2 text-sm">
                <span>{s.studentName}</span>
                <button
                  onClick={() =>
                    setStatus.mutate({
                      homeworkAssignmentId: assignment.id,
                      studentId: s.studentId,
                      status: STATUS_CYCLE[s.status]
                    })
                  }
                >
                  <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
