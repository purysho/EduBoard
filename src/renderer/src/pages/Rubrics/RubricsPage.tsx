import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, Plus, Trash2 } from 'lucide-react'
import type { RubricWithCriteria } from '@shared/types'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useDeleteRubric, useRubrics } from '@renderer/lib/queries'
import { cn } from '@renderer/lib/cn'
import { StandardsPanel } from './StandardsPanel'
import { CompetencyPanel } from './CompetencyPanel'
import { tr } from '@shared/i18n'

type Tab = 'library' | 'standards' | 'competencies'

export function RubricsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { data: rubrics, isLoading } = useRubrics()
  const deleteRubric = useDeleteRubric()
  const [tab, setTab] = useState<Tab>('library')
  const [pendingDelete, setPendingDelete] = useState<RubricWithCriteria | null>(null)

  return (
    <div>
      <PageHeader
        title={tr('Rubrics & Standards')}
        description={tr(
          'Build reusable grading rubrics and keep a library of the standards they cover.'
        )}
        actions={
          tab === 'library' && (
            <Button variant="primary" onClick={() => navigate('/rubrics/new')}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              {tr('New rubric')}
            </Button>
          )
        }
      />

      <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
        {(
          [
            { key: 'library', label: tr('Rubric library') },
            { key: 'standards', label: tr('Standards') },
            { key: 'competencies', label: tr('Competencies') }
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'standards' ? (
        <StandardsPanel />
      ) : tab === 'competencies' ? (
        <CompetencyPanel />
      ) : isLoading ? (
        <Spinner />
      ) : !rubrics?.length ? (
        <EmptyState
          icon={ClipboardCheck}
          title={tr('No rubrics yet')}
          description={tr('Build a rubric once and reuse it on any assessment across any class.')}
          action={
            <Button variant="primary" onClick={() => navigate('/rubrics/new')}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              {tr('New rubric')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {rubrics.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer"
              onClick={() => navigate(`/rubrics/${r.id}`)}
            >
              <CardBody>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{r.name}</h3>
                  <button
                    className="shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)]"
                    onClick={(e) => {
                      e.stopPropagation()
                      setPendingDelete(r)
                    }}
                    aria-label={tr('Delete rubric')}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
                {r.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-muted)]">
                    {r.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-[var(--color-text-muted)]">
                  {tr('{length} criteria · {maxPoints} pts max', {
                    length: r.criteria.length,
                    maxPoints: r.maxPoints
                  })}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={tr('Delete rubric')}
        message={tr(
          'Delete "{name}"? Assessments using it keep their current scores but lose the rubric detail — this can\'t be undone.',
          { name: pendingDelete?.name }
        )}
        confirmLabel={tr('Delete')}
        danger
        onConfirm={async () => {
          if (pendingDelete) await deleteRubric.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
