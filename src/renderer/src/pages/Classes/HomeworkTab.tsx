import { FormEvent, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ClipboardList, Copy, Paperclip, Plus, Star, Trash2 } from 'lucide-react'
import type {
  ClassSection,
  HomeworkAssignment,
  HomeworkSubmissionStatus,
  HomeworkSubmissionWithStudent
} from '@shared/types'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Badge } from '@renderer/components/ui/Badge'
import { DateSelect, FormRow, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { Modal } from '@renderer/components/ui/Modal'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { cn } from '@renderer/lib/cn'
import {
  useCreateHomeworkAssignment,
  useDeleteHomeworkAssignment,
  useHomeworkAssignments,
  useHomeworkRubricScores,
  useHomeworkSubmissions,
  useRubric,
  useRubrics,
  useSaveHomeworkRubricScores,
  useSetHomeworkSubmissionGrade,
  useSetHomeworkSubmissionPortfolio,
  useUpdateHomeworkAssignment
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
  const updateAssignment = useUpdateHomeworkAssignment(classSection.id)

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
                        <Badge tone={a.status === 'published' ? 'success' : 'neutral'}>
                          {a.status === 'published' ? 'Published' : 'Draft'}
                        </Badge>
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
                        variant={a.status === 'published' ? 'ghost' : 'secondary'}
                        size="sm"
                        disabled={updateAssignment.isPending}
                        onClick={() =>
                          updateAssignment.mutate({
                            id: a.id,
                            patch: { status: a.status === 'published' ? 'draft' : 'published' }
                          })
                        }
                      >
                        {a.status === 'published' ? 'Unpublish' : 'Publish to students'}
                      </Button>
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
  const { data: rubrics } = useRubrics()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [rubricId, setRubricId] = useState('')

  // Pre-fill from the assignment being reused whenever a fresh one is picked — due date is
  // deliberately left blank since "reuse" means a new due date, not the old one; the
  // attachment isn't carried over either, since it lives at a path only the original had.
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)
  if (reuseFrom && reuseFrom.id !== prefilledFrom) {
    setPrefilledFrom(reuseFrom.id)
    setTitle(reuseFrom.title)
    setDescription(reuseFrom.description ?? '')
    setTopic(reuseFrom.topic ?? '')
    setRubricId(reuseFrom.rubricId ?? '')
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
      topic: topic.trim() || null,
      status: 'draft',
      rubricId: rubricId || null
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
    setRubricId('')
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
        <p className="text-xs text-[var(--color-text-muted)]">
          Saves as a draft, visible only to you. Use &quot;Publish to students&quot; on the
          assignment afterward when it&apos;s ready to go out.
        </p>
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
        <FormRow
          label="Rubric"
          hint="Optional — score submissions criterion-by-criterion instead of a plain grade"
        >
          <Select value={rubricId} onChange={(e) => setRubricId(e.target.value)}>
            <option value="">No rubric</option>
            {rubrics?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
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
            <SubmissionRow key={s.studentId} assignment={assignment} submission={s} />
          ))}
        </div>
      )}
    </Modal>
  )
}

function SubmissionRow({
  assignment,
  submission
}: {
  assignment: HomeworkAssignment
  submission: HomeworkSubmissionWithStudent
}): React.JSX.Element {
  const assignmentId = assignment.id
  const setGrade = useSetHomeworkSubmissionGrade()
  const setPortfolio = useSetHomeworkSubmissionPortfolio()
  const [grade, setGradeValue] = useState(submission.grade ?? '')
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [opening, setOpening] = useState(false)
  const [scoringRubric, setScoringRubric] = useState(false)

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
        <div className="flex items-center gap-2">
          {submission.status === 'done' && (
            <button
              title={submission.portfolio ? 'Remove from Portfolio' : 'Add to student Portfolio'}
              onClick={() =>
                setPortfolio.mutate({
                  homeworkAssignmentId: assignmentId,
                  studentId: submission.studentId,
                  portfolio: !submission.portfolio
                })
              }
              disabled={setPortfolio.isPending}
              className={
                submission.portfolio
                  ? 'text-[var(--color-warning)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-warning)]'
              }
            >
              <Star size={16} fill={submission.portfolio ? 'currentColor' : 'none'} aria-hidden />
            </button>
          )}
          <Badge tone={STATUS_TONE[submission.status]}>{STATUS_LABEL[submission.status]}</Badge>
        </div>
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
      {submission.status !== 'not_started' && assignment.rubricId && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={() => setScoringRubric(true)}>
            {submission.grade ? `Rubric score: ${submission.grade}` : 'Score with rubric'}
          </Button>
        </div>
      )}
      {submission.status !== 'not_started' && !assignment.rubricId && (
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
      {scoringRubric && assignment.rubricId && (
        <HomeworkRubricScoringModal
          open
          onClose={() => setScoringRubric(false)}
          homeworkAssignmentId={assignmentId}
          rubricId={assignment.rubricId}
          studentId={submission.studentId}
          studentName={submission.studentName}
        />
      )}
    </div>
  )
}

function HomeworkRubricScoringModal({
  open,
  onClose,
  homeworkAssignmentId,
  rubricId,
  studentId,
  studentName
}: {
  open: boolean
  onClose: () => void
  homeworkAssignmentId: string
  rubricId: string
  studentId: string
  studentName: string
}): React.JSX.Element {
  const { data: rubric, isLoading: rubricLoading } = useRubric(rubricId)
  const { data: existing, isLoading: scoresLoading } = useHomeworkRubricScores(
    homeworkAssignmentId,
    studentId
  )
  const saveScores = useSaveHomeworkRubricScores()

  const [selections, setSelections] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')

  const [lastSeenKey, setLastSeenKey] = useState<string | null>(null)
  const currentKey = existing ? 'loaded' : 'loading'
  if (existing && currentKey !== lastSeenKey) {
    setLastSeenKey(currentKey)
    const map: Record<string, string> = {}
    for (const s of existing) map[s.criterionId] = s.levelId
    setSelections(map)
  }

  const isLoading = rubricLoading || scoresLoading
  const total =
    rubric?.criteria.reduce((sum, c) => {
      const level = c.levels.find((l) => l.id === selections[c.id])
      return sum + (level?.points ?? 0)
    }, 0) ?? 0
  const allScored = !!rubric && rubric.criteria.every((c) => selections[c.id])

  async function handleSave(): Promise<void> {
    if (!rubric) return
    await saveScores.mutateAsync({
      homeworkAssignmentId,
      studentId,
      selections: rubric.criteria.map((c) => ({ criterionId: c.id, levelId: selections[c.id] })),
      feedback: feedback.trim() || null
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rubric ? `${rubric.name} — ${studentName}` : studentName}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!allScored || saveScores.isPending}
          >
            {saveScores.isPending ? 'Saving…' : `Save (${total}/${rubric?.maxPoints ?? 0})`}
          </Button>
        </>
      }
    >
      {isLoading || !rubric ? (
        <Spinner />
      ) : (
        <div className="space-y-5">
          {rubric.criteria.map((criterion) => (
            <div key={criterion.id}>
              <p className="mb-2 text-sm font-semibold">{criterion.name}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {criterion.levels.map((level) => {
                  const selected = selections[criterion.id] === level.id
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() =>
                        setSelections((prev) => ({ ...prev, [criterion.id]: level.id }))
                      }
                      className={cn(
                        'rounded-lg border p-2.5 text-left text-xs transition-colors',
                        selected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                          : 'border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]'
                      )}
                    >
                      <div className="flex items-center justify-between font-medium">
                        <span>{level.label}</span>
                        <span className="text-[var(--color-text-muted)]">{level.points}</span>
                      </div>
                      {level.description && (
                        <p className="mt-1 text-[var(--color-text-muted)]">{level.description}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-1.5 text-sm font-semibold">Feedback (optional)</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={2}
              placeholder="A note for the student…"
              className="w-full resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      )}
    </Modal>
  )
}
