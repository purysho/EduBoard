import { useState } from 'react'
import { Archive, CopyPlus, GraduationCap, Plus } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import { useBulkArchiveClasses, useClasses } from '@renderer/lib/queries'
import { ClassCard } from './ClassCard'
import { ClassFormModal } from './ClassFormModal'
import { NextTermAllModal } from './NextTermAllModal'
import { tr } from '@shared/i18n'

export function ClassesListPage(): React.JSX.Element {
  const [showArchived, setShowArchived] = useState(false)
  const { data: classes, isLoading } = useClasses(showArchived)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showNextTerm, setShowNextTerm] = useState(false)
  const [bulkArchiveMode, setBulkArchiveMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmArchive, setConfirmArchive] = useState(false)
  const bulkArchive = useBulkArchiveClasses()

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
            {!!classes?.some((c) => !c.archived) && !bulkArchiveMode && (
              <Button
                variant="secondary"
                onClick={() => setBulkArchiveMode(true)}
              >
                <Archive size={15} className="mr-1 inline" aria-hidden />
                {tr('Bulk archive')}
              </Button>
            )}
            {bulkArchiveMode && (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBulkArchiveMode(false)
                    setSelectedIds([])
                  }}
                >
                  {tr('Cancel')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={!selectedIds.length || bulkArchive.isPending}
                  onClick={() => setConfirmArchive(true)}
                >
                  <Archive size={15} className="mr-1 inline" aria-hidden />
                  {tr('Archive selected ({n})', { n: selectedIds.length })}
                </Button>
              </>
            )}
            {!!classes?.some((c) => !c.archived) && !bulkArchiveMode && (
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
            <div key={c.id} className="relative">
              {bulkArchiveMode && !c.archived && (
                <label className="mb-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={(e) =>
                      setSelectedIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                      )
                    }
                  />
                  {tr('Select for archive')}
                </label>
              )}
              <ClassCard classSection={c} />
            </div>
          ))}
        </div>
      )}

      <ClassFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      {showNextTerm && classes && (
        <NextTermAllModal open onClose={() => setShowNextTerm(false)} classes={classes} />
      )}
      <ConfirmDialog
        open={confirmArchive}
        title={tr('Archive selected classes?')}
        message={tr(
          'Archive {n} selected classes? Their data stays available under Show archived.',
          { n: selectedIds.length }
        )}
        confirmLabel={tr('Archive')}
        onConfirm={async () => {
          await bulkArchive.mutateAsync(selectedIds)
          setConfirmArchive(false)
          setSelectedIds([])
          setBulkArchiveMode(false)
        }}
        onCancel={() => setConfirmArchive(false)}
      />
    </div>
  )
}
