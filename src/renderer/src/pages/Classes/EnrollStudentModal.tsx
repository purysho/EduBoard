import { useMemo, useState } from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Field'
import { useClassRoster, useEnrollStudent, useStudents } from '@renderer/lib/queries'
import { studentFullName, todayIso } from '@renderer/lib/format'
import { StudentFormModal } from '@renderer/pages/Students/StudentFormModal'

export function EnrollStudentModal({
  open,
  onClose,
  classId
}: {
  open: boolean
  onClose: () => void
  classId: string
}): React.JSX.Element {
  const { data: students } = useStudents()
  const { data: roster } = useClassRoster(classId)
  const enrollStudent = useEnrollStudent(classId)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showNewStudent, setShowNewStudent] = useState(false)

  const enrolledIds = useMemo(() => new Set((roster ?? []).map((r) => r.student.id)), [roster])
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (students ?? [])
      .filter((s) => !enrolledIds.has(s.id))
      .filter((s) => !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
  }, [students, enrolledIds, search])

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleEnroll(): Promise<void> {
    const today = todayIso()
    for (const studentId of selected) {
      await enrollStudent.mutateAsync({ studentId, classId, enrolledOn: today })
    }
    setSelected(new Set())
    onClose()
  }

  return (
    <>
      <Modal
        open={open && !showNewStudent}
        onClose={onClose}
        title="Enroll students"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEnroll}
              disabled={selected.size === 0 || enrollStudent.isPending}
            >
              Enroll {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="secondary" onClick={() => setShowNewStudent(true)}>
              + New
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--color-border)]">
            {candidates.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--color-text-muted)]">
                No students to enroll. Everyone already in this class, or add a new student.
              </p>
            ) : (
              candidates.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-[var(--color-border)] px-3 py-2 text-sm last:border-0 hover:bg-[var(--color-surface-muted)]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                  />
                  <span>{studentFullName(s)}</span>
                  {s.gradeLevel && (
                    <span className="text-[var(--color-text-muted)]">· {s.gradeLevel}</span>
                  )}
                </label>
              ))
            )}
          </div>
        </div>
      </Modal>

      <StudentFormModal
        open={showNewStudent}
        onClose={() => setShowNewStudent(false)}
        enrollInClassId={classId}
      />
    </>
  )
}
