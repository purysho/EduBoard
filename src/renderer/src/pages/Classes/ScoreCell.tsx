import { KeyboardEvent, useState } from 'react'
import type { Score } from '@shared/types'
import { useUpsertScore } from '@renderer/lib/queries'
import { ScoreHistoryPopover } from './ScoreHistoryPopover'

export function ScoreCell({
  classId,
  assessmentId,
  studentId,
  maxScore,
  score
}: {
  classId: string
  assessmentId: string
  studentId: string
  maxScore: number
  score: Score | undefined
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
    if (e.key === 'Enter') e.currentTarget.blur()
  }

  const isExcused = score?.excused ?? false

  return (
    <span className="group/cell relative inline-flex items-center">
      <input
        type="number"
        min={0}
        max={maxScore}
        value={isExcused ? '' : value}
        placeholder={isExcused ? 'Exc.' : ''}
        disabled={isExcused}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className="w-16 rounded border border-transparent bg-transparent px-1.5 py-1 text-center text-sm hover:border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none disabled:text-[var(--color-text-muted)]"
      />
      {score && (
        <span className="absolute -right-3 opacity-0 transition-opacity group-hover/cell:opacity-100">
          <ScoreHistoryPopover assessmentId={assessmentId} studentId={studentId} />
        </span>
      )}
    </span>
  )
}
