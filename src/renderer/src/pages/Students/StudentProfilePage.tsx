import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Pencil, Trash2, Users } from 'lucide-react'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Avatar } from '@renderer/components/ui/Avatar'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { EmptyState, Spinner } from '@renderer/components/ui/EmptyState'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useClasses,
  useDeleteStudent,
  useEnrollmentsByStudent,
  useStudents
} from '@renderer/lib/queries'
import { formatDate, studentFullName } from '@renderer/lib/format'
import { StudentFormModal } from './StudentFormModal'
import { StudentClassRow } from './StudentClassRow'
import { StudentLogPanel } from './StudentLogPanel'

export function StudentProfilePage(): React.JSX.Element {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { data: students, isLoading } = useStudents(true)
  const { data: enrollments } = useEnrollmentsByStudent(studentId)
  const { data: classes } = useClasses(true)
  const deleteStudent = useDeleteStudent()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const student = students?.find((s) => s.id === studentId)

  if (isLoading) return <Spinner />
  if (!student) return <EmptyState icon={Users} title="Student not found" />

  const classById = new Map((classes ?? []).map((c) => [c.id, c]))

  return (
    <div>
      <PageHeader
        leading={<Avatar name={studentFullName(student)} size="lg" />}
        title={studentFullName(student)}
        description={student.gradeLevel ?? undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={14} className="mr-1 inline" aria-hidden />
              Edit
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} className="mr-1 inline" aria-hidden />
              Delete
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-1 h-fit">
          <CardHeader>
            <h2 className="text-sm font-semibold">Details</h2>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <DetailRow label="Student #" value={student.studentNumber} />
            <DetailRow label="Date of birth" value={formatDate(student.dateOfBirth)} />
            <DetailRow label="Email" value={student.email} />
            <DetailRow label="Guardian" value={student.guardianName} />
            <DetailRow label="Guardian contact" value={student.guardianContact} />
            {student.notes && (
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)]">Notes</p>
                <p className="mt-1 whitespace-pre-wrap">{student.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="col-span-2 h-fit">
          <CardHeader>
            <h2 className="text-sm font-semibold">Classes</h2>
          </CardHeader>
          {!enrollments?.length ? (
            <CardBody>
              <p className="text-sm text-[var(--color-text-muted)]">
                Not enrolled in any classes yet. Enroll this student from a class&apos;s Roster tab.
              </p>
            </CardBody>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Class</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Grade</th>
                  <th className="px-4 py-2.5 font-medium">Trend</th>
                  <th className="px-4 py-2.5 font-medium">Letter</th>
                  <th className="px-4 py-2.5 font-medium">Attendance</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enrollment) => {
                  const cls = classById.get(enrollment.classId)
                  if (!cls) return null
                  return (
                    <StudentClassRow
                      key={enrollment.id}
                      studentId={student.id}
                      cls={cls}
                      enrollment={enrollment}
                    />
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <StudentLogPanel studentId={student.id} />
      </div>

      <StudentFormModal open={editOpen} onClose={() => setEditOpen(false)} student={student} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete student"
        message={`Delete ${studentFullName(student)}? This also removes their enrollments, scores, and attendance history. This can't be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={async () => {
          await deleteStudent.mutateAsync(student.id)
          navigate('/students')
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}

function DetailRow({
  label,
  value
}: {
  label: string
  value: string | null | undefined
}): React.JSX.Element {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p>{value || '—'}</p>
    </div>
  )
}
