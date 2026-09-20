import { KeyboardEvent, useState } from 'react'
import type { AssignmentSubmission, Score } from '@shared/types'
import { useUpsertScore } from '@renderer/lib/queries'
import { ScoreHistoryPopover } from './ScoreHistoryPopover'
import { CommentPopover } from './CommentPopover'
import { SubmissionPopover } from './SubmissionPopover'
import { focusGradebookCell } from './gradebookNav'

export function ScoreCell({
  classId,
  assessmentId,
  studentId,
  maxScore,
  score,
  submission,
  row,
  col
}: {
  classId: string
  assessmentId: string
  studentId: string
  maxScore: number
  score: Score | undefined
  submission: AssignmentSubmission | undefined
  row: number
  col: number
}): React.JSX.Element {
  const upsertScore = useUpsertScore(classId)
  const [value, setValue] = useState(score?.pointsEarned?.toString() ?? '')

  // Resync the edit buffer when the underlying score changes for a reason other than
  // this cell's own commit (e.g. another cell's bulk save, or a query refetch) — done
  // during render, not in an effect, so it can't fight with what the user is typing.
  const [lastSeenPoints, setLastSeenPoints] = useState(score?.pointsEarned)
  if (score?.pointsEarned !== lastSeenPoints) {
    setLastSeenPoints(score?.pointsEarned)
    setValue(score?.pointsEarned?.toString() ?? '')
  }

  function commit(): void {
    const trimmed = value.trim()
    const pointsEarned = trimmed === '' ? null : Number(trimmed)
    if (pointsEarned === score?.pointsEarned) return
    if (pointsEarned !== null && Number.isNaN(pointsEarned)) {
      setValue(score?.pointsEarned?.toString() ?? '')
      return
    }
    upsertScore.mutate({ assessmentId, studentId, pointsEarned, excused: score?.excused ?? false })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    switch (e.key) {
      case 'Enter':
        e.currentTarget.blur()
        focusGradebookCell(row + 1, col)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusGradebookCell(row - 1, col)
        break
      case 'ArrowDown':
        e.preventDefault()
        focusGradebookCell(row + 1, col)
        break
      // Number inputs don't expose selectionStart/selectionEnd in Chromium (always null),
      // so there's no reliable way to tell "cursor at the edge" from "cursor in the middle" —
      // Left/Right always move cells here, spreadsheet-style, rather than the text cursor.
      case 'ArrowLeft':
        e.preventDefault()
        focusGradebookCell(row, col - 1)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusGradebookCell(row, col + 1)
        break
    }
  }

  const isExcused = score?.excused ?? false

  return (
    <span className="group/cell relative inline-flex items-center">
      <input
        type="number"
        min={0}
        max={maxScore}
        data-row={row}
        data-col={col}
        value={isExcused ? '' : value}
        placeholder={isExcused ? 'Exc.' : ''}
        disabled={isExcused}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-16 rounded border border-transparent bg-transparent px-1.5 py-1 text-center text-sm hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none disabled:text-[var(--color-text-muted)]"
      />
      {score && (
        <span className="absolute -right-3 flex flex-col opacity-0 transition-opacity group-hover/cell:opacity-100">
          <ScoreHistoryPopover assessmentId={assessmentId} studentId={studentId} />
        </span>
      )}
      {score && (
        <span
          className={`absolute -right-3 top-3 flex flex-col transition-opacity ${
            score?.comment ? 'opacity-100' : 'opacity-0 group-hover/cell:opacity-100'
          }`}
        >
          <CommentPopover
            classId={classId}
            assessmentId={assessmentId}
            studentId={studentId}
            score={score}
          />
        </span>
      )}
      <span
        className={`absolute -right-3 top-6 flex flex-col transition-opacity ${
          submission ? 'opacity-100' : 'opacity-0 group-hover/cell:opacity-100'
        }`}
      >
        <SubmissionPopover
          classId={classId}
          assessmentId={assessmentId}
          studentId={studentId}
          submission={submission}
        />
      </span>
    </span>
  )
}
