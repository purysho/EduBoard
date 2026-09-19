import { useState } from 'react'
import type { RubricWithCriteria } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { cn } from '@renderer/lib/cn'
import { useRubricScores, useSaveRubricScores } from '@renderer/lib/queries'

export function RubricScoringModal({
  open,
  onClose,
  classId,
  assessmentId,
  studentId,
  studentName,
  rubric
}: {
  open: boolean
  onClose: () => void
  classId: string
  assessmentId: string
  studentId: string
  studentName: string
  rubric: RubricWithCriteria
}): React.JSX.Element {
  const { data: existing, isLoading } = useRubricScores(
    open ? assessmentId : undefined,
    open ? studentId : undefined
  )
  const saveScores = useSaveRubricScores(classId)

  const [selections, setSelections] = useState<Record<string, string>>({})

  // Sync the edit buffer from the fetched scores during render (not an effect) so it
  // can't fight with what the user just clicked — same pattern as ScoreCell's
  // lastSeenPoints. Re-syncs whenever the modal (re)opens or a fresh `existing` loads.
  const [lastSeenKey, setLastSeenKey] = useState<string | null>(null)
  const currentKey = open ? `${assessmentId}:${studentId}:${existing ? 'loaded' : 'loading'}` : null
  if (open && existing && currentKey !== lastSeenKey) {
    setLastSeenKey(currentKey)
    const map: Record<string, string> = {}
    for (const s of existing) map[s.criterionId] = s.levelId
    setSelections(map)
  } else if (!open && lastSeenKey !== null) {
    setLastSeenKey(null)
    setSelections({})
  }

  const total = rubric.criteria.reduce((sum, c) => {
    const levelId = selections[c.id]
    const level = c.levels.find((l) => l.id === levelId)
    return sum + (level?.points ?? 0)
  }, 0)

  const allScored = rubric.criteria.every((c) => selections[c.id])

  async function handleSave(): Promise<void> {
    await saveScores.mutateAsync({
      assessmentId,
      studentId,
      selections: rubric.criteria.map((c) => ({ criterionId: c.id, levelId: selections[c.id] }))
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${rubric.name} — ${studentName}`}
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
            {saveScores.isPending ? 'Saving…' : `Save (${total}/${rubric.maxPoints})`}
          </Button>
        </>
      }
    >
      {isLoading ? (
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
        </div>
      )}
    </Modal>
  )
}
