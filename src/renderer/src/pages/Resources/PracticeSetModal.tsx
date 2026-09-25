import type { LessonResource } from '@shared/types'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { useClearPracticeSet, useDraftPracticeSet } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'

type Kind = 'flashcards' | 'quiz'

/** Lets the teacher read an AI-drafted flashcard set or practice quiz before (and after)
 * students see it, and regenerate or remove it. A shared resource publishes whatever is
 * saved here, so this is the review step. */
export function PracticeSetModal({
  resource,
  kind,
  onClose
}: {
  resource: LessonResource
  kind: Kind
  onClose: () => void
}): React.JSX.Element {
  const draft = useDraftPracticeSet()
  const clear = useClearPracticeSet()
  const label = kind === 'flashcards' ? 'Flashcards' : 'Practice quiz'
  const cards = kind === 'flashcards' ? resource.flashcards : null
  const questions = kind === 'quiz' ? resource.practiceQuiz : null
  const count = (cards ?? questions ?? []).length

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${label} — ${resource.title}`}
      footer={
        <>
          {count > 0 && (
            <Button
              variant="ghost"
              disabled={clear.isPending}
              onClick={() =>
                clear.mutate({ resourceId: resource.id, kind }, { onSuccess: onClose })
              }
            >
              Remove
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={draft.isPending}
            onClick={() => draft.mutate({ resourceId: resource.id, kind })}
          >
            {draft.isPending ? 'Generating…' : count ? 'Regenerate' : 'Generate'}
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-xs text-[var(--color-text-muted)]">
          Drafted by AI from this resource&apos;s text. Check it before students rely on it.
          {resource.shareWithStudents
            ? ' It is published to students with this resource.'
            : ' Students only see it once the resource is shared with a class.'}
        </p>
        {draft.isError && (
          <p className="text-[var(--color-danger)]">
            {ipcErrorMessage(draft.error, `Could not generate ${label.toLowerCase()}.`)}
          </p>
        )}
        {count === 0 && !draft.isPending && (
          <p className="text-[var(--color-text-muted)]">Nothing generated yet.</p>
        )}
        {cards?.map((c, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-border)] p-2.5">
            <p className="font-medium">{c.front}</p>
            <p className="mt-1 text-[var(--color-text-muted)]">{c.back}</p>
          </div>
        ))}
        {questions?.map((q, i) => (
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
          </div>
        ))}
      </div>
    </Modal>
  )
}
