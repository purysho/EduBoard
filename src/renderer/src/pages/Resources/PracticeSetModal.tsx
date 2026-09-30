import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { PortalReviewStats } from '@shared/aiUsage'
import type { AiMaterialKind, LessonResource } from '@shared/types'
import type { Flashcard, PracticeQuestion } from '@shared/practiceSets'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Input, Textarea } from '@renderer/components/ui/Field'
import {
  useApproveAiMaterial,
  useClearPracticeSet,
  useDraftPracticeSet,
  useDraftStudyGuide,
  useSaveManualPracticeSet,
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

const blankCard = (): Flashcard => ({ front: '', back: '' })
const blankQuestion = (): PracticeQuestion => ({
  question: '',
  options: ['', '', '', ''],
  answerIndex: 0,
  explanation: ''
})

/**
 * One editor for teacher-authored and AI-assisted study material.
 *
 * Manual authoring is fully offline and saves as already approved because the teacher
 * wrote/reviewed it. AI remains an optional drafting shortcut and still requires review.
 */
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
  const saveManual = useSaveManualPracticeSet()
  const clear = useClearPracticeSet()
  const update = useUpdateLessonResource()
  const approve = useApproveAiMaterial()

  const [editingGuide, setEditingGuide] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [manualCards, setManualCards] = useState<Flashcard[]>([])
  const [manualQuestions, setManualQuestions] = useState<PracticeQuestion[]>([])
  const [manualError, setManualError] = useState<string | null>(null)

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
  const aiError = draftSet.error ?? draftGuide.error

  function beginManual(): void {
    setManualError(null)
    if (kind === 'guide') {
      setEditingGuide(guide ?? '')
      return
    }
    setManualMode(true)
    if (kind === 'flashcards') {
      setManualCards(cards?.length ? cards.map((c) => ({ ...c })) : [blankCard(), blankCard()])
    } else {
      setManualQuestions(
        questions?.length
          ? questions.map((q) => ({ ...q, options: [...q.options] }))
          : [blankQuestion()]
      )
    }
  }

  const generateWithAi = (): void => {
    setEditingGuide(null)
    setManualMode(false)
    setManualError(null)
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

  async function saveManualSet(): Promise<void> {
    setManualError(null)
    try {
      if (kind === 'flashcards') {
        await saveManual.mutateAsync({
          resourceId: resource.id,
          kind,
          value: manualCards
        })
      } else if (kind === 'quiz') {
        await saveManual.mutateAsync({
          resourceId: resource.id,
          kind,
          value: manualQuestions
        })
      }
      setManualMode(false)
    } catch (e) {
      setManualError(ipcErrorMessage(e, tr('Could not save this material.')))
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

  const editing = editingGuide !== null || manualMode

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${label} — ${resource.title}`}
      footer={
        <>
          {exists && !editing && (
            <Button variant="ghost" disabled={clear.isPending || update.isPending} onClick={remove}>
              {tr('Remove')}
            </Button>
          )}
          {!editing && (
            <Button variant="secondary" onClick={beginManual}>
              {exists ? tr('Edit manually') : tr('Create manually')}
            </Button>
          )}
          {!editing && (
            <Button variant="secondary" disabled={drafting} onClick={generateWithAi}>
              {drafting
                ? tr('Generating…')
                : exists
                  ? tr('Regenerate with AI')
                  : tr('Generate with AI')}
            </Button>
          )}
          {exists && !editing && (
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
                'Create this yourself with no internet, or use AI as an optional first draft. Teacher-authored material is approved when you save it.'
              )
            : approved
              ? resource.shareWithStudents
                ? tr('Approved: students see this with the resource.')
                : tr('Approved: students see it once the resource is shared with a class.')
              : tr(
                  'This draft still needs your approval before students can see it. You can edit it manually or regenerate it with AI.'
                )}
        </p>

        {aiError && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(
              aiError,
              tr('Could not generate {lowerCase}.', { lowerCase: label.toLowerCase() })
            )}
          </p>
        )}
        {manualError && <p className="text-[var(--color-danger)]">{manualError}</p>}

        {review && review.students > 0 && !editing && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr(
              '{n} students review these on the Portal (spaced review). The ones they miss most are listed first and marked.',
              { n: review.students }
            )}
          </p>
        )}

        {!exists && !drafting && !editing && (
          <p className="text-[var(--color-text-muted)]">
            {tr('Nothing here yet. Create it manually offline or generate a draft with AI.')}
          </p>
        )}

        {kind === 'guide' &&
          (editingGuide !== null ? (
            <div className="space-y-2">
              <Textarea
                rows={18}
                value={editingGuide}
                placeholder={tr(
                  'Write the explanation, key ideas, vocabulary, examples, self-check questions or revision notes students need.'
                )}
                onChange={(e) => setEditingGuide(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={update.isPending || !editingGuide.trim()}
                  onClick={() =>
                    update.mutate(
                      { id: resource.id, patch: { studyGuide: editingGuide.trim() } },
                      { onSuccess: () => setEditingGuide(null) }
                    )
                  }
                >
                  {tr('Save and approve')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingGuide(null)}>
                  {tr('Cancel')}
                </Button>
              </div>
            </div>
          ) : guide !== null ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap rounded-lg border border-[var(--color-border)] p-3">
                {guide}
              </p>
            </div>
          ) : null)}

        {kind === 'flashcards' && manualMode ? (
          <ManualFlashcardEditor
            cards={manualCards}
            setCards={setManualCards}
            busy={saveManual.isPending}
            onSave={saveManualSet}
            onCancel={() => setManualMode(false)}
          />
        ) : (
          sortByMissed(cards, (c) => c.front, 'card')?.map((c, i) => (
            <div key={i} className="rounded-lg border border-[var(--color-border)] p-2.5">
              <p className="font-medium">{c.front}</p>
              <p className="mt-1 text-[var(--color-text-muted)]">{c.back}</p>
              {reviewOf('card', c.front)}
            </div>
          ))
        )}

        {kind === 'quiz' && manualMode ? (
          <ManualQuizEditor
            questions={manualQuestions}
            setQuestions={setManualQuestions}
            busy={saveManual.isPending}
            onSave={saveManualSet}
            onCancel={() => setManualMode(false)}
          />
        ) : (
          sortByMissed(questions, (q) => q.question, 'question')?.map((q, i) => (
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
          ))
        )}
      </div>
    </Modal>
  )
}

function ManualFlashcardEditor({
  cards,
  setCards,
  busy,
  onSave,
  onCancel
}: {
  cards: Flashcard[]
  setCards: (cards: Flashcard[]) => void
  busy: boolean
  onSave: () => void
  onCancel: () => void
}): React.JSX.Element {
  const patch = (index: number, update: Partial<Flashcard>): void =>
    setCards(cards.map((card, i) => (i === index ? { ...card, ...update } : card)))

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        {tr(
          'Use cards for vocabulary, sentence frames, speaking prompts, questions, facts or anything with a front and back.'
        )}
      </p>
      {cards.map((card, index) => (
        <div key={index} className="rounded-lg border border-[var(--color-border)] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium">
              {tr('Card {n}', { n: index + 1 })}
            </span>
            {cards.length > 1 && (
              <button
                type="button"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                onClick={() => setCards(cards.filter((_, i) => i !== index))}
                aria-label={tr('Remove card')}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Textarea
              rows={3}
              value={card.front}
              placeholder={tr('Front / prompt')}
              onChange={(e) => patch(index, { front: e.target.value })}
            />
            <Textarea
              rows={3}
              value={card.back}
              placeholder={tr('Back / answer')}
              onChange={(e) => patch(index, { back: e.target.value })}
            />
          </div>
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        disabled={cards.length >= 30}
        onClick={() => setCards([...cards, blankCard()])}
      >
        <Plus size={13} className="mr-1 inline" aria-hidden />
        {tr('Add card')}
      </Button>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={onSave}>
          {busy ? tr('Saving…') : tr('Save and approve')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {tr('Cancel')}
        </Button>
      </div>
    </div>
  )
}

function ManualQuizEditor({
  questions,
  setQuestions,
  busy,
  onSave,
  onCancel
}: {
  questions: PracticeQuestion[]
  setQuestions: (questions: PracticeQuestion[]) => void
  busy: boolean
  onSave: () => void
  onCancel: () => void
}): React.JSX.Element {
  const patch = (index: number, update: Partial<PracticeQuestion>): void =>
    setQuestions(questions.map((question, i) => (i === index ? { ...question, ...update } : question)))

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">
        {tr(
          'Build self-check questions manually. Students can use them in Classroom Hub, the Portal or exported Offline Study Packs.'
        )}
      </p>
      {questions.map((question, index) => (
        <div key={index} className="space-y-2 rounded-lg border border-[var(--color-border)] p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {tr('Question {n}', { n: index + 1 })}
            </span>
            {questions.length > 1 && (
              <button
                type="button"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                onClick={() => setQuestions(questions.filter((_, i) => i !== index))}
                aria-label={tr('Remove question')}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            )}
          </div>
          <Textarea
            rows={2}
            value={question.question}
            placeholder={tr('Question')}
            onChange={(e) => patch(index, { question: e.target.value })}
          />
          <div className="space-y-1.5">
            {question.options.map((option, optionIndex) => (
              <div key={optionIndex} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`answer-${index}`}
                  checked={question.answerIndex === optionIndex}
                  onChange={() => patch(index, { answerIndex: optionIndex })}
                  aria-label={tr('Correct answer')}
                />
                <Input
                  value={option}
                  placeholder={tr('Answer option {n}', { n: optionIndex + 1 })}
                  onChange={(e) => {
                    const options = [...question.options]
                    options[optionIndex] = e.target.value
                    patch(index, { options })
                  }}
                />
                {question.options.length > 2 && (
                  <button
                    type="button"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                    onClick={() => {
                      const options = question.options.filter((_, i) => i !== optionIndex)
                      const answerIndex =
                        question.answerIndex === optionIndex
                          ? 0
                          : question.answerIndex > optionIndex
                            ? question.answerIndex - 1
                            : question.answerIndex
                      patch(index, { options, answerIndex })
                    }}
                    aria-label={tr('Remove answer option')}
                  >
                    <Trash2 size={13} aria-hidden />
                  </button>
                )}
              </div>
            ))}
          </div>
          {question.options.length < 5 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patch(index, { options: [...question.options, ''] })}
            >
              <Plus size={12} className="mr-1 inline" aria-hidden />
              {tr('Add answer option')}
            </Button>
          )}
          <Textarea
            rows={2}
            value={question.explanation}
            placeholder={tr('Explanation shown after answering')}
            onChange={(e) => patch(index, { explanation: e.target.value })}
          />
        </div>
      ))}
      <Button
        size="sm"
        variant="secondary"
        disabled={questions.length >= 15}
        onClick={() => setQuestions([...questions, blankQuestion()])}
      >
        <Plus size={13} className="mr-1 inline" aria-hidden />
        {tr('Add question')}
      </Button>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={onSave}>
          {busy ? tr('Saving…') : tr('Save and approve')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {tr('Cancel')}
        </Button>
      </div>
    </div>
  )
}
