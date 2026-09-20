import { useState } from 'react'
import { BookOpenText, Sparkles } from 'lucide-react'
import type { NotebookAnswer } from '@shared/types'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { Textarea } from '@renderer/components/ui/Field'
import { Badge } from '@renderer/components/ui/Badge'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useAskNotebook, useIndexAllResources, useLessonResources } from '@renderer/lib/queries'
import { ipcErrorMessage } from '@renderer/lib/format'

export function NotebookPage(): React.JSX.Element {
  const { data: resources, isLoading } = useLessonResources()
  const indexAll = useIndexAllResources()
  const ask = useAskNotebook()

  const [question, setQuestion] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null) // null = all
  const [answer, setAnswer] = useState<NotebookAnswer | null>(null)

  const indexedResources = (resources ?? []).filter((r) => r.indexedAt)

  function toggleResource(id: string): void {
    setSelectedIds((prev) => {
      const base = prev ?? new Set(indexedResources.map((r) => r.id))
      const next = new Set(base)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAsk(): Promise<void> {
    if (!question.trim()) return
    const resourceIds = selectedIds ? Array.from(selectedIds) : null
    const result = await ask.mutateAsync({ question: question.trim(), resourceIds })
    setAnswer(result)
  }

  if (isLoading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Notebook"
        description="Ask questions grounded in your indexed Resources — answers cite exactly which resource they came from."
        actions={
          <Button
            variant="secondary"
            onClick={() => indexAll.mutate()}
            disabled={indexAll.isPending}
          >
            <Sparkles size={15} className="mr-1 inline" aria-hidden />
            {indexAll.isPending ? 'Indexing…' : 'Index all resources'}
          </Button>
        }
      />

      {!indexedResources.length ? (
        <EmptyState
          icon={BookOpenText}
          title="Nothing indexed yet"
          description='Index a resource from the Resources page (or click "Index all resources" above) before asking questions here.'
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-1 h-fit">
            <CardHeader>
              <h2 className="text-sm font-semibold">Search scope</h2>
            </CardHeader>
            <CardBody className="space-y-2">
              <p className="text-xs text-[var(--color-text-muted)]">
                {selectedIds === null
                  ? 'Searching all indexed resources.'
                  : `Searching ${selectedIds.size} selected resource${selectedIds.size === 1 ? '' : 's'}.`}
              </p>
              <ul className="space-y-1.5">
                {indexedResources.map((r) => {
                  const checked = selectedIds === null || selectedIds.has(r.id)
                  return (
                    <li key={r.id}>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleResource(r.id)}
                        />
                        {r.title}
                      </label>
                    </li>
                  )
                })}
              </ul>
              {selectedIds !== null && (
                <button
                  className="text-xs text-[var(--color-primary)] hover:underline"
                  onClick={() => setSelectedIds(null)}
                >
                  Reset to all
                </button>
              )}
            </CardBody>
          </Card>

          <div className="col-span-2 space-y-4">
            <Card>
              <CardBody className="space-y-3">
                <Textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. What does the reading say about photosynthesis?"
                  rows={3}
                />
                <Button
                  variant="primary"
                  onClick={handleAsk}
                  disabled={!question.trim() || ask.isPending}
                >
                  {ask.isPending ? 'Thinking…' : 'Ask'}
                </Button>
                {ask.isError && (
                  <p className="text-sm text-[var(--color-danger)]">
                    {ipcErrorMessage(ask.error, 'Could not answer that question.')}
                  </p>
                )}
              </CardBody>
            </Card>

            {answer && (
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold">Answer</h2>
                </CardHeader>
                <CardBody className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm">{answer.answer}</p>
                  {answer.citations.length > 0 && (
                    <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
                      <h3 className="text-xs font-semibold text-[var(--color-text-muted)]">
                        Sources
                      </h3>
                      {answer.citations.map((c, i) => (
                        <div key={`${c.resourceId}-${c.chunkIndex}`} className="text-xs">
                          <Badge tone="neutral">
                            [{i + 1}] {c.resourceTitle}
                          </Badge>
                          <p className="mt-1 text-[var(--color-text-muted)]">{c.snippet}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
