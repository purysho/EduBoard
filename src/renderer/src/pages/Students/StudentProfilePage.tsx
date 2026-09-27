import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Merge, Pencil, Trash2, Users } from 'lucide-react'
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
  usePortalProfile,
  useSettings,
  useStudents
} from '@renderer/lib/queries'
import { formatDate, studentFullName } from '@renderer/lib/format'
import { StudentFormModal } from './StudentFormModal'
import { StudentClassRow } from './StudentClassRow'
import { StudentLogPanel } from './StudentLogPanel'
import { MergeStudentsModal } from './MergeStudentsModal'
import { PrivacyCard } from './PrivacyCard'
import { tr } from '@shared/i18n'

export function StudentProfilePage(): React.JSX.Element {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const { data: students, isLoading } = useStudents(true)
  const { data: enrollments } = useEnrollmentsByStudent(studentId)
  const { data: classes } = useClasses(true)
  const deleteStudent = useDeleteStudent()
  const { data: settings } = useSettings()

  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)

  const student = students?.find((s) => s.id === studentId)

  if (isLoading) return <Spinner />
  if (!student) return <EmptyState icon={Users} title={tr('Student not found')} />

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
              {tr('Edit')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setMergeOpen(true)}
              title={tr('This student is on your list twice? Merge the two into one')}
            >
              <Merge size={14} className="mr-1 inline" aria-hidden />
              {tr('Merge')}
            </Button>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} className="mr-1 inline" aria-hidden />
              {tr('Delete')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-6">
          <Card className="h-fit">
            <CardHeader>
              <h2 className="text-sm font-semibold">{tr('Details')}</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              <DetailRow label={tr('Student #')} value={student.studentNumber} />
              <DetailRow label={tr('Date of birth')} value={formatDate(student.dateOfBirth)} />
              <DetailRow label={tr('Email')} value={student.email} />
              <DetailRow label={tr('Guardian')} value={student.guardianName} />
              <DetailRow label={tr('Guardian contact')} value={student.guardianContact} />
              {(settings?.studentFields ?? []).map((f) => (
                <DetailRow key={f.id} label={f.label} value={student.customFields?.[f.id]} />
              ))}
              {student.notes && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">
                    {tr('Notes')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{student.notes}</p>
                </div>
              )}
            </CardBody>
          </Card>

          <PortalProfileCard studentId={student.id} />
        </div>

        <Card className="col-span-2 h-fit">
          <CardHeader>
            <h2 className="text-sm font-semibold">{tr('Classes')}</h2>
          </CardHeader>
          {!enrollments?.length ? (
            <CardBody>
              <p className="text-sm text-[var(--color-text-muted)]">
                {tr(
                  "Not enrolled in any classes yet. Enroll this student from a class's Roster tab."
                )}
              </p>
            </CardBody>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{tr('Class')}</th>
                  <th className="px-4 py-2.5 font-medium">{tr('Status')}</th>
                  <th className="px-4 py-2.5 font-medium">{tr('Grade')}</th>
                  <th className="px-4 py-2.5 font-medium">{tr('Trend')}</th>
                  <th className="px-4 py-2.5 font-medium">{tr('Letter')}</th>
                  <th className="px-4 py-2.5 font-medium">{tr('Attendance')}</th>
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
      {mergeOpen && (
        <MergeStudentsModal
          keep={student}
          onClose={() => setMergeOpen(false)}
          onMerged={(kept) => navigate(`/students/${kept.id}`)}
        />
      )}

      <PrivacyCard student={student} />

      <ConfirmDialog
        open={confirmDelete}
        title={tr('Delete student')}
        message={tr(
          "Delete {name}? This also removes their enrollments, scores, and attendance history, and their Portal login and handed-in work. This can't be undone.",
          { name: studentFullName(student) }
        )}
        confirmLabel={tr('Delete')}
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

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec'
].map((m) => tr(m))

/** What the student chose to share on their Portal profile, loaded live. Shows nothing
 * when no Portal is configured or the student hasn't made a profile yet. */
function PortalProfileCard({ studentId }: { studentId: string }): React.JSX.Element | null {
  const { data: settings } = useSettings()
  const portalConfigured = Boolean(settings?.portalUrl.trim() && settings?.portalSyncSecret.trim())
  const { data: profile, isError } = usePortalProfile(studentId, { enabled: portalConfigured })
  if (!portalConfigured || isError || !profile) return null

  const [mm, dd] = (profile.birthday ?? '').split('-')
  const birthday = mm && dd ? `${MONTHS[Number(mm) - 1] ?? ''} ${Number(dd)}` : null

  return (
    <Card className="h-fit">
      <CardHeader>
        <h2 className="text-sm font-semibold">{tr('Portal profile')}</h2>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <div className="flex items-center gap-3">
          {profile.photoDataUrl ? (
            <img
              src={profile.photoDataUrl}
              alt=""
              className="h-14 w-14 rounded-full object-cover"
            />
          ) : null}
          <div>
            {profile.preferredName && (
              <p className="font-medium">
                {tr('Goes by {preferredName}', { preferredName: profile.preferredName })}
              </p>
            )}
            {profile.pronouns && (
              <p className="text-[var(--color-text-muted)]">{profile.pronouns}</p>
            )}
          </div>
        </div>
        {profile.bio && <p className="whitespace-pre-wrap">{profile.bio}</p>}
        <DetailRow label={tr('Birthday')} value={birthday} />
        <DetailRow label={tr('Preferred language')} value={profile.preferredLanguage} />
        {profile.goals && (
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              {tr('Learning goals')}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{profile.goals}</p>
          </div>
        )}
        {profile.teacherNote && (
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)]">
              {tr("What they'd like you to know")}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{profile.teacherNote}</p>
          </div>
        )}
        <p className="text-xs text-[var(--color-text-muted)]">
          {tr('Written by the student on the Portal.')}
        </p>
      </CardBody>
    </Card>
  )
}
