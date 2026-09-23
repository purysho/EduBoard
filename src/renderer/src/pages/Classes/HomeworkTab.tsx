import { FormEvent, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ClipboardList, Copy, Paperclip, Plus, Trash2 } from 'lucide-react'
import type {
  ClassSection,
  HomeworkAssignment,
  HomeworkSubmissionStatus,
  HomeworkSubmissionWithStudent
} from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { DateSelect, FormRow, Input, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useCreateHomeworkAssignment,
  useDeleteHomeworkAssignment,
  useHomeworkAssignments,
  useHomeworkSubmissions,
  useSetHomeworkSubmissionGrade
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

/** Groups assignments by their topic label, "Other" catching anything left blank —
 * topics keep their first-seen order (roughly creation order) rather than alphabetizing,
 * since a teacher naming topics "Week 1", "Week 2" etc. wants them to stay in that order. */
function groupByTopic(assignments: HomeworkAssignment[]): [string, HomeworkAssignment[]][] {
  const groups = new Map<string, HomeworkAssignment[]>()
  for (const a of assignments) {
    const key = a.topic?.trim() || 'Other'
    const list = groups.get(key) ?? []
    list.push(a)
    groups.set(key, list)
  }
  const entries = [...groups.entries()]
  entries.sort((a, b) => (a[0] === 'Other' ? 1 : b[0] === 'Other' ? -1 : 0))
  return entries
}

export function HomeworkTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const { data: assignments, isLoading } = useHomeworkAssignments(classSection.id)
  const deleteAssignment = useDeleteHomeworkAssignment(classSection.id)

  const [showAdd, setShowAdd] = useState(false)
  const [selected, setSelected] = useState<HomeworkAssignment | null>(null)
  const [pendingDelete, setPendingDelete] = useState<HomeworkAssignment | null>(null)
  const [reuseFrom, setReuseFrom] = useState<HomeworkAssignment | null>(null)

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
          description="Students see these on the Portal and can turn in their work right there."
          action={
            <Button variant="primary" onClick={() => setShowAdd(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              Assignment
            </Button>
          }
        />
      ) : (
        groupByTopic(assignments).map(([topic, group]) => (
          <div key={topic} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {topic}
            </h2>
            <div className="space-y-3">
              {group.map((a) => (
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
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          {a.description}
                        </p>
                      )}
                      {a.fileName && (
                        <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-primary)]">
                          <Paperclip size={12} aria-hidden />
                          {a.fileName}
                        </span>
                      )}
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      {a.filePath && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.api.homeworkAssignments.openPath(a.filePath!)}
                        >
                          <Paperclip size={13} className="mr-1 inline" aria-hidden />
                          Open file
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReuseFrom(a)
                          setShowAdd(true)
                        }}
                      >
                        <Copy size={13} className="mr-1 inline" aria-hidden />
                        Reuse
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPendingDelete(a)}>
                        <Trash2 size={13} className="mr-1 inline" aria-hidden />
                        Delete
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <NewAssignmentModal
        open={showAdd}
        onClose={() => {
          setShowAdd(false)
          setReuseFrom(null)
        }}
        classId={classSection.id}
        reuseFrom={reuseFrom}
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
  classId,
  reuseFrom
}: {
  open: boolean
  onClose: () => void
  classId: string
  reuseFrom?: HomeworkAssignment | null
}): React.JSX.Element {
  const createAssignment = useCreateHomeworkAssignment(classId)
  const { data: existingAssignments } = useHomeworkAssignments(classId)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [topic, setTopic] = useState('')

  // Pre-fill from the assignment being reused whenever a fresh one is picked — due date is
  // deliberately left blank since "reuse" means a new due date, not the old one; the
  // attachment isn't carried over either, since it lives at a path only the original had.
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)
  if (reuseFrom && reuseFrom.id !== prefilledFrom) {
    setPrefilledFrom(reuseFrom.id)
    setTitle(reuseFrom.title)
    setDescription(reuseFrom.description ?? '')
    setTopic(reuseFrom.topic ?? '')
  }

  const existingTopics = [
    ...new Set((existingAssignments ?? []).map((a) => a.topic).filter((t): t is string => !!t))
  ]

  async function handlePickFile(): Promise<void> {
    const picked = await window.api.homeworkAssignments.pickFile()
    if (picked) setFilePath(picked)
  }

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    await createAssignment.mutateAsync({
      classId,
      title: title.trim(),
      description: description.trim() || null,
      dueDate: dueDate || null,
      filePath,
      fileName: filePath ? filePath.split(/[/\\]/).pop() || filePath : null,
      topic: topic.trim() || null
    })
    resetForm()
    onClose()
  }

  function resetForm(): void {
    setTitle('')
    setDescription('')
    setDueDate('')
    setFilePath(null)
    setTopic('')
    setPrefilledFrom(null)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        resetForm()
        onClose()
      }}
      title={reuseFrom ? 'Reuse assignment' : 'New assignment'}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              resetForm()
              onClose()
            }}
          >
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
        <FormRow label="Topic / unit" hint="Optional — groups this with related assignments">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            list="topic-suggestions"
            placeholder="e.g. Unit 1: Ecosystems"
          />
          <datalist id="topic-suggestions">
            {existingTopics.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </FormRow>
        <FormRow label="Due date" hint="Optional">
          <DateSelect value={dueDate} onChange={setDueDate} />
        </FormRow>
        <FormRow label="Description" hint="Optional">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormRow>
        <FormRow label="Attachment" hint="Optional — a worksheet or instructions file">
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={handlePickFile}>
              <Paperclip size={13} className="mr-1 inline" aria-hidden />
              {filePath ? 'Change file' : 'Choose file'}
            </Button>
            {filePath && (
              <span className="truncate text-xs text-[var(--color-text-muted)]">
                {filePath.split(/[/\\]/).pop()}
              </span>
            )}
          </div>
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

  return (
    <Modal open onClose={onClose} title={assignment.title} wide>
      {isLoading ? (
        <Spinner />
      ) : !submissions?.length ? (
        <p className="text-sm text-[var(--color-text-muted)]">No students enrolled.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            Use &quot;Pull from Portal&quot; on the class&apos;s Portal tab first to fetch what
            students have turned in.
          </p>
          {submissions.map((s) => (
            <SubmissionRow key={s.studentId} assignmentId={assignment.id} submission={s} />
          ))}
        </div>
      )}
    </Modal>
  )
}

function SubmissionRow({
  assignmentId,
  submission
}: {
  assignmentId: string
  submission: HomeworkSubmissionWithStudent
}): React.JSX.Element {
  const setGrade = useSetHomeworkSubmissionGrade()
  const [grade, setGradeValue] = useState(submission.grade ?? '')
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [opening, setOpening] = useState(false)

  async function handleOpenFile(): Promise<void> {
    if (!submission.fileName) return
    setOpening(true)
    try {
      await window.api.homeworkAssignments.openSubmissionFile(
        assignmentId,
        submission.studentId,
        submission.fileName
      )
    } finally {
      setOpening(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{submission.studentName}</span>
        <Badge tone={STATUS_TONE[submission.status]}>{STATUS_LABEL[submission.status]}</Badge>
      </div>
      {submission.textAnswer && (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">{submission.textAnswer}</p>
      )}
      {submission.fileName && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1"
          onClick={handleOpenFile}
          disabled={opening}
        >
          <Paperclip size={13} className="mr-1 inline" aria-hidden />
          {opening ? 'Opening…' : submission.fileName}
        </Button>
      )}
      {submission.status !== 'not_started' && (
        <div className="mt-3 grid grid-cols-[100px_1fr] gap-2">
          <Input
            placeholder="Grade"
            value={grade}
            onChange={(e) => setGradeValue(e.target.value)}
          />
          <Input
            placeholder="Feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="col-span-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={setGrade.isPending}
              onClick={() =>
                setGrade.mutate({
                  homeworkAssignmentId: assignmentId,
                  studentId: submission.studentId,
                  grade: grade.trim() || null,
                  feedback: feedback.trim() || null
                })
              }
            >
              {setGrade.isPending ? 'Saving…' : 'Save grade'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
