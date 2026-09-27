import { useState } from 'react'
import { CopyPlus, GraduationCap, Plus } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useClasses } from '@renderer/lib/queries'
import { ClassCard } from './ClassCard'
import { ClassFormModal } from './ClassFormModal'
import { NextTermAllModal } from './NextTermAllModal'
import { tr } from '@shared/i18n'

export function ClassesListPage(): React.JSX.Element {
  const [showArchived, setShowArchived] = useState(false)
  const { data: classes, isLoading } = useClasses(showArchived)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNextTerm, setShowNextTerm] = useState(false)

  const visibleClasses = showArchived ? classes : classes?.filter((c) => !c.archived)

  return (
    <div>
      <PageHeader
        title={tr('Classes')}
        description={tr('Every class, section, and club you teach.')}
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              {tr('Show archived')}
            </label>
            {!!classes?.some((c) => !c.archived) && (
              <Button
                variant="secondary"
                onClick={() => setShowNextTerm(true)}
                title={tr('Next-term classes for all your classes at once')}
              >
                <CopyPlus size={15} className="mr-1 inline" aria-hidden />
                {tr('Start next term')}
              </Button>
            )}
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              <Plus size={15} className="mr-1 inline" aria-hidden />
              {tr('New class')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !visibleClasses?.length ? (
        <EmptyState
          icon={GraduationCap}
          title={showArchived ? tr('No archived classes') : tr('No classes yet')}
          description={
            showArchived
              ? tr('Classes you archive at the end of a term show up here.')
              : tr(
                  'Create your first class to start tracking a roster, gradebook, and lesson plans.'
                )
          }
          action={
            !showArchived && (
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                <Plus size={15} className="mr-1 inline" aria-hidden />
                {tr('New class')}
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {visibleClasses.map((c) => (
            <ClassCard key={c.id} classSection={c} />
          ))}
        </div>
      )}

      <ClassFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      {showNextTerm && classes && (
        <NextTermAllModal open onClose={() => setShowNextTerm(false)} classes={classes} />
      )}
    </div>
  )
}
