import { useEffect, useState } from 'react'
import type { PortalReviewStats } from '@shared/aiUsage'
import type { AiMaterialKind, LessonResource } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Textarea } from '@renderer/components/ui/Field'
import {
  useApproveAiMaterial,
  useClearPracticeSet,
  useDraftPracticeSet,
  useDraftStudyGuide,
  useUpdateLessonResource
} from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'
import { tr } from '@shared/i18n'

export type StudyMaterialKind = 'guide' | 'flashcards' | 'quiz'

const approvalKey: Record<StudyMaterialKind, AiMaterialKind> = {
  guide: 'studyGuide',
  flashcards: 'flashcards',
  quiz: 'practiceQuiz'
}

/** Where the teacher reads an AI-drafted study guide, flashcard set or practice quiz,
 * regenerates or removes it, and approves it. Students only ever see an approved one,
 * and a new draft needs approving again. */
export function PracticeSetModal({
  resource,
  kind,
  onClose
}: {
  resource: LessonResource
  kind: StudyMaterialKind
  onClose: () => void
}): React.JSX.Element {
  const draftSet = useDraftPracticeSet()
  const draftGuide = useDraftStudyGuide()
  const clear = useClearPracticeSet()
  const update = useUpdateLessonResource()
  const approve = useApproveAiMaterial()
  const [editing, setEditing] = useState<string | null>(null)
  // How students are doing with these cards in spaced review on the Portal, if any.
  const [review, setReview] = useState<PortalReviewStats | null>(null)
  useEffect(() => {
    if (kind === 'guide') return
    let cancelled = false
    window.api.portalSync
      .reviewStats()
      .then((all) => !cancelled && setReview(all.find((m) => m.materialId === resource.id) ?? null))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [kind, resource.id])
  const reviewOf = (itemKind: 'card' | 'question', text: string): React.JSX.Element | null => {
    const item = review?.items.find((i) => i.kind === itemKind && i.text === text)
    if (!item) return null
    const attempts = item.right + item.wrong
    const hard = attempts >= 3 && item.wrong / attempts >= 0.5
    return (
      <p
        className={
          'mt-1 text-xs ' +
          (hard ? 'font-medium text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]')
        }
      >
        {tr('Review: missed {wrong} of {attempts} answers · learned by {learned} of {students}', {
          wrong: item.wrong,
          attempts,
          learned: item.learned,
          students: item.students
        })}
        {hard ? ' · ' + tr('worth re-teaching') : ''}
      </p>
    )
  }

  const label =
    kind === 'guide'
      ? tr('Study guide')
      : kind === 'flashcards'
        ? tr('Flashcards')
        : tr('Practice quiz')
  const guide = kind === 'guide' ? resource.studyGuide : null
  const cards = kind === 'flashcards' ? resource.flashcards : null
  const questions = kind === 'quiz' ? resource.practiceQuiz : null
  const exists = !!(guide || cards?.length || questions?.length)
  const approved = exists && !!resource.aiApproved?.[approvalKey[kind]]
  const drafting = draftSet.isPending || draftGuide.isPending
  const error = draftSet.error ?? draftGuide.error

  const regenerate = (): void => {
    setEditing(null)
    if (kind === 'guide') draftGuide.mutate(resource.id)
    else draftSet.mutate({ resourceId: resource.id, kind })
  }
  const remove = (): void => {
    if (kind === 'guide') {
      update.mutate({ id: resource.id, patch: { studyGuide: null } }, { onSuccess: onClose })
    } else {
      clear.mutate({ resourceId: resource.id, kind }, { onSuccess: onClose })
    }
  }
  // With review results, the most-missed items come first: what to re-teach.
  function sortByMissed<T>(
    list: T[] | null,
    textOf: (item: T) => string,
    itemKind: 'card' | 'question'
  ): T[] | null {
    if (!list || !review) return list
    const missRate = (item: T): number => {
      const r = review.items.find((i) => i.kind === itemKind && i.text === textOf(item))
      return r && r.right + r.wrong ? r.wrong / (r.right + r.wrong) : -1
    }
    return [...list].sort((a, b) => missRate(b) - missRate(a))
  }
  const setApproved = (value: boolean): void =>
    approve.mutate({ resourceId: resource.id, kind: approvalKey[kind], approved: value })

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${label} — ${resource.title}`}
      footer={
        <>
          {exists && (
            <Button variant="ghost" disabled={clear.isPending || update.isPending} onClick={remove}>
              {tr('Remove')}
            </Button>
          )}
          <Button variant="secondary" disabled={drafting} onClick={regenerate}>
            {drafting ? tr('Generating…') : exists ? tr('Regenerate') : tr('Generate')}
          </Button>
          {exists && editing === null && (
            <Button
              variant={approved ? 'secondary' : 'primary'}
              disabled={approve.isPending}
              onClick={() => setApproved(!approved)}
            >
              {approved ? tr('Withdraw from students') : tr('Approve for students')}
            </Button>
          )}
          <Button variant={exists && !approved ? 'secondary' : 'primary'} onClick={onClose}>
            {tr('Done')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p
          className={
            'rounded-lg p-2.5 text-xs ' +
            (approved
              ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
              : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]')
          }
        >
          {!exists
            ? tr(
                'Drafted by AI from this resource’s text (needs internet). Nothing is shown to students until you approve it.'
              )
            : approved
              ? resource.shareWithStudents
                ? tr('Approved: students see this with the resource.')
                : tr('Approved: students see it once the resource is shared with a class.')
              : tr(
                  'Drafted by AI. Read it, correct anything wrong, then approve it. Students don’t see it until you do.'
                )}
        </p>
        {error && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(
              error,
              tr('Could not generate {lowerCase}.', { lowerCase: label.toLowerCase() })
            )}
          </p>
        )}
        {review && review.students > 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr(
              '{n} students review these on the Portal (spaced review). The ones they miss most are listed first and marked.',
              { n: review.students }
            )}
          </p>
        )}
        {!exists && !drafting && (
          <p className="text-[var(--color-text-muted)]">{tr('Nothing generated yet.')}</p>
        )}
        {guide !== null &&
          (editing !== null ? (
            <div className="space-y-2">
              <Textarea rows={16} value={editing} onChange={(e) => setEditing(e.target.value)} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={update.isPending || !editing.trim()}
                  onClick={() =>
                    update.mutate(
                      { id: resource.id, patch: { studyGuide: editing.trim() } },
                      { onSuccess: () => setEditing(null) }
                    )
                  }
                >
                  {tr('Save and approve')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  {tr('Cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] p-3">
                {guide}
              </p>
              <Button size="sm" variant="ghost" onClick={() => setEditing(guide)}>
                {tr('Edit')}
              </Button>
            </div>
          ))}
        {sortByMissed(cards, (c) => c.front, 'card')?.map((c, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-border)] p-2.5">
            <p className="font-medium">{c.front}</p>
            <p className="mt-1 text-[var(--color-text-muted)]">{c.back}</p>
            {reviewOf('card', c.front)}
          </div>
        ))}
        {sortByMissed(questions, (q) => q.question, 'question')?.map((q, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-border)] p-2.5">
            <p className="font-medium">
              {i + 1}. {q.question}
            </p>
            <ul className="mt-1 space-y-0.5">
              {q.options.map((o, oi) => (
                <li
                  key={oi}
                  className={
                    oi === q.answerIndex
                      ? 'font-medium text-[var(--color-success)]'
                      : 'text-[var(--color-text-muted)]'
                  }
                >
                  {oi === q.answerIndex ? '✓ ' : '• '}
                  {o}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{q.explanation}</p>
            {reviewOf('question', q.question)}
          </div>
        ))}
      </div>
    </Modal>
  )
}
