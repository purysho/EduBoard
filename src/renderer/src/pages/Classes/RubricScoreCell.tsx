import { KeyboardEvent, useState } from 'react'
import type { RubricWithCriteria, Score } from '@shared/types'
import { RubricScoringModal } from './RubricScoringModal'
import { focusGradebookCell } from './gradebookNav'

export function RubricScoreCell({
  classId,
  assessmentId,
  studentId,
  studentName,
  rubric,
  score,
  row,
  col
}: {
  classId: string
  assessmentId: string
  studentId: string
  studentName: string
  rubric: RubricWithCriteria
  score: Score | undefined
  row: number
  col: number
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  // Same spreadsheet-style Enter/Arrow navigation as the plain-points ScoreCell, so
  // moving through a row doesn't silently stop at a rubric-graded column.
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
    switch (e.key) {
      case 'Enter':
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

  return (
    <>
      <button
        type="button"
        data-row={row}
        data-col={col}
        onClick={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="relative w-16 rounded border border-transparent px-1.5 py-1 text-center text-sm hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
        title={
          score?.comment ? `Grade with ${rubric.name} — has a comment` : `Grade with ${rubric.name}`
        }
      >
        {score?.pointsEarned ?? <span className="text-[var(--color-text-muted)]">—</span>}
        {score?.comment && (
          <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
        )}
      </button>
      <RubricScoringModal
        open={open}
        onClose={() => setOpen(false)}
        classId={classId}
        assessmentId={assessmentId}
        studentId={studentId}
        studentName={studentName}
        rubric={rubric}
        score={score}
      />
    </>
  )
}
