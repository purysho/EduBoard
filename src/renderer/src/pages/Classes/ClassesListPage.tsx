import { useState } from 'react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useClasses } from '@renderer/lib/queries'
import { ClassCard } from './ClassCard'
import { ClassFormModal } from './ClassFormModal'

export function ClassesListPage(): React.JSX.Element {
  const { data: classes, isLoading } = useClasses()
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div>
      <PageHeader
        title="Classes"
        description="Every class, section, and club you teach."
        actions={
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            + New class
          </Button>
        }
      />

      {isLoading ? (
        <Spinner />
      ) : !classes?.length ? (
        <EmptyState
          title="No classes yet"
          description="Create your first class to start tracking a roster, gradebook, and lesson plans."
          action={
            <Button variant="primary" onClick={() => setShowAddModal(true)}>
              + New class
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {classes.map((c) => (
            <ClassCard key={c.id} classSection={c} />
          ))}
        </div>
      )}

      <ClassFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  )
}
