import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { Avatar } from '@renderer/components/ui/Avatar'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { useStudents } from '@renderer/lib/queries'
import { studentFullName } from '@renderer/lib/format'
import { StudentFormModal } from './StudentFormModal'

export function StudentsListPage(): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const { data: students, isLoading } = useStudents()

  const filtered = useMemo(() => {
    if (!students) return []
    const q = search.trim().toLowerCase()
    if (!q) return students
    return students.filter((s) =>
      `${s.firstName} ${s.lastName} ${s.studentNumber ?? ''} ${s.gradeLevel ?? ''}`
        .toLowerCase()
        .includes(q)
    )
  }, [students, search])

  return (
    <div>
      <PageHeader
        title="Students"
        description="Your full student directory, across every class and club."
        actions={
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} className="mr-1 inline" aria-hidden />
            Add student
          </Button>
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden
        />
        <Input
          placeholder="Search by name, ID, or grade level…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={students?.length ? 'No students match your search' : 'No students yet'}
          description={
            students?.length
              ? undefined
              : 'Add your first student, or import a roster from Settings.'
          }
          action={
            !students?.length ? (
              <Button variant="primary" onClick={() => setShowAddModal(true)}>
                <Plus size={15} className="mr-1 inline" aria-hidden />
                Add student
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Grade / cohort</th>
                <th className="px-4 py-2.5 font-medium">Student #</th>
                <th className="px-4 py-2.5 font-medium">Guardian</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr
                  key={student.id}
                  className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/students/${student.id}`}
                      className="flex items-center gap-2.5 font-medium text-[var(--color-text)] hover:text-[var(--color-primary)]"
                    >
                      <Avatar name={studentFullName(student)} size="sm" />
                      {studentFullName(student)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {student.gradeLevel ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {student.studentNumber ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                    {student.guardianName ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StudentFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  )
}
