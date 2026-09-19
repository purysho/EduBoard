import { useState } from 'react'
import type { RubricWithCriteria, Score } from '@shared/types'
import { RubricScoringModal } from './RubricScoringModal'

export function RubricScoreCell({
  classId,
  assessmentId,
  studentId,
  studentName,
  rubric,
  score
}: {
  classId: string
  assessmentId: string
  studentId: string
  studentName: string
  rubric: RubricWithCriteria
  score: Score | undefined
}): React.JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
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
