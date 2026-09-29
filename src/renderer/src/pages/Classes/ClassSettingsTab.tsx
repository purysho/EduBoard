import { FormEvent, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  BookOpenCheck,
  CopyPlus,
  Layers,
  Pencil,
  Plus,
  Tags,
  UserCheck
} from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input, Select } from '@renderer/components/ui/Field'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useCourseGroups,
  useCreateCourseGroup,
  useDeleteClass,
  useDeleteGradeCategory,
  useGradeCategories,
  useUpdateClass
} from '@renderer/lib/queries'
import { ClassFormModal } from './ClassFormModal'
import { CategoryFormModal } from './CategoryFormModal'
import { NewTermClassModal } from './NewTermClassModal'
import { GradeScaleEditor } from '@renderer/components/GradeScaleEditor'
import { gradeScaleIsValid } from '@shared/gradeScales'
import { tr } from '@shared/i18n'

const NEW_COURSE_GROUP_VALUE = '__new__'

export function ClassSettingsTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const navigate = useNavigate()
  const { data: categories } = useGradeCategories(classSection.id)
  const { data: courseGroups } = useCourseGroups()
  const updateClass = useUpdateClass()
  const deleteClass = useDeleteClass()
  const deleteCategory = useDeleteGradeCategory(classSection.id)
  const createCourseGroup = useCreateCourseGroup()
  const [showNewTerm, setShowNewTerm] = useState(false)
  const [termWeight, setTermWeight] = useState(classSection.termWeight)
  // Blank means no requirement.
  const [minAttendance, setMinAttendance] = useState(
    classSection.minAttendance === null ? '' : String(classSection.minAttendance)
  )
  const minAttendanceValue = minAttendance.trim() === '' ? null : Number(minAttendance)
  const minAttendanceInvalid =
    minAttendanceValue !== null &&
    (Number.isNaN(minAttendanceValue) || minAttendanceValue <= 0 || minAttendanceValue > 100)

  async function handleCourseGroupChange(value: string): Promise<void> {
    if (value === NEW_COURSE_GROUP_VALUE) {
      const name = window.prompt(tr('Name this course (e.g. "Algebra I")'))?.trim()
      if (!name) return
      const group = await createCourseGroup.mutateAsync({ name })
      await updateClass.mutateAsync({ id: classSection.id, patch: { courseGroupId: group.id } })
      return
    }
    await updateClass.mutateAsync({
      id: classSection.id,
      patch: { courseGroupId: value || null }
    })
  }

  const [passMark, setPassMark] = useState(classSection.passMark)
  const [maxScore, setMaxScore] = useState(classSection.maxScore)
  const [thresholds, setThresholds] = useState(classSection.gradeThresholds)

  const [showEditClass, setShowEditClass] = useState(false)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [confirmDeleteClass, setConfirmDeleteClass] = useState(false)

  const totalWeight = (categories ?? []).reduce((sum, c) => sum + c.weightPercent, 0)

  async function handleGradingSubmit(e: FormEvent): Promise<void> {
    e.preventDefault()
    await updateClass.mutateAsync({
      id: classSection.id,
      patch: {
        passMark: Number(passMark),
        maxScore: Number(maxScore),
        gradeThresholds: thresholds
      }
    })
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className="col-span-2 h-fit">
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{tr('Class details')}</h2>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNewTerm(true)}
              title={tr(
                "A new class for the next term with this class's setup and, if you like, its students (who keep their Portal logins)"
              )}
            >
              <CopyPlus size={13} className="mr-1 inline" aria-hidden />
              {tr('Start next term')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowEditClass(true)}>
              <Pencil size={13} className="mr-1 inline" aria-hidden />
              {tr('Edit')}
            </Button>
          </div>
        </CardHeader>
        <CardBody className="grid grid-cols-4 gap-4 text-sm">
          <DetailItem label={tr('Subject')} value={classSection.subject} />
          <DetailItem label={tr('Grade level')} value={classSection.gradeLevel} />
          <DetailItem label={tr('Schedule')} value={classSection.schedule} />
          <DetailItem label={tr('Room')} value={classSection.room} />
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <h2 className="text-sm font-semibold">{tr('Grading scale')}</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleGradingSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormRow label={tr('Pass mark (%)')}>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={passMark}
                  onChange={(e) => setPassMark(Number(e.target.value))}
                />
              </FormRow>
              <FormRow
                label={tr('Default assessment max score')}
                hint={tr('Used to prefill new assessments')}
              >
                <Input
                  type="number"
                  min={1}
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                />
              </FormRow>
            </div>
            <GradeScaleEditor value={thresholds} onChange={setThresholds} />
            <Button
              variant="primary"
              type="submit"
              disabled={updateClass.isPending || !gradeScaleIsValid(thresholds)}
            >
              {updateClass.isPending ? tr('Saving…') : tr('Save grading scale')}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Layers size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('Course group')}
          </h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            {tr(
              "Link this class to the same course's other terms (e.g. Fall + Spring) to see a combined grade for each student on the Composite Grades page."
            )}
          </p>
          <FormRow label={tr('Course')}>
            <Select
              value={classSection.courseGroupId ?? ''}
              onChange={(e) => handleCourseGroupChange(e.target.value)}
            >
              <option value="">{tr('Not part of a course group')}</option>
              {(courseGroups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
              <option value={NEW_COURSE_GROUP_VALUE}>{tr('+ New course…')}</option>
            </Select>
          </FormRow>
          {classSection.courseGroupId && (
            <FormRow
              label={tr('Weight in composite')}
              hint={tr(
                "How much this term counts relative to the group's other terms — 1 means equally"
              )}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={termWeight}
                  onChange={(e) => setTermWeight(Number(e.target.value))}
                  className="w-24"
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => updateClass.mutate({ id: classSection.id, patch: { termWeight } })}
                  disabled={updateClass.isPending || termWeight === classSection.termWeight}
                >
                  {tr('Save')}
                </Button>
              </div>
            </FormRow>
          )}
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <UserCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('Attendance requirement')}
          </h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            {tr(
              "If this course requires a minimum attendance, students below it are listed on the Dashboard once they've had three sessions. Excused absences don't count against them."
            )}
          </p>
          <FormRow label={tr('Minimum attendance (%)')} hint={tr('Leave blank for no requirement')}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={100}
                placeholder={tr('e.g. 80')}
                value={minAttendance}
                onChange={(e) => setMinAttendance(e.target.value)}
                className="w-24"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  updateClass.mutate({
                    id: classSection.id,
                    patch: { minAttendance: minAttendanceValue }
                  })
                }
                disabled={
                  updateClass.isPending ||
                  minAttendanceInvalid ||
                  minAttendanceValue === classSection.minAttendance
                }
              >
                {tr('Save')}
              </Button>
            </div>
          </FormRow>
          {minAttendanceInvalid && (
            <p className="text-xs text-[var(--color-danger)]">
              {tr('Enter a number from 1 to 100.')}
            </p>
          )}
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <BookOpenCheck size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('Homework')}
          </h2>
        </CardHeader>
        <CardBody className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={classSection.noHomework}
              disabled={updateClass.isPending}
              onChange={(e) =>
                updateClass.mutate({
                  id: classSection.id,
                  patch: { noHomework: e.target.checked }
                })
              }
            />
            {tr('No homework in this class')}
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">
            {tr(
              'For a course that doesn’t allow homework. Each lesson plan’s homework becomes “Consolidation in class”: the same short task, done in the last minutes of the lesson. Spaced review and the Study Helper on the Portal stay there as optional practice.'
            )}
          </p>
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Tags size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            {tr('Grade categories')}
          </h2>
          <Button variant="secondary" size="sm" onClick={() => setShowAddCategory(true)}>
            <Plus size={13} className="mr-1 inline" aria-hidden />
            {tr('Category')}
          </Button>
        </CardHeader>
        <CardBody>
          {!categories?.length ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              {tr(
                'No categories yet — assessments will count equally toward the class grade. Add categories like "Homework" and "Exams" to weight them differently.'
              )}
            </p>
          ) : (
            <>
              <ul className="divide-y divide-[var(--color-border)]">
                {categories.map((cat) => (
                  <li key={cat.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{cat.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-[var(--color-text-muted)]">{cat.weightPercent}%</span>
                      <button
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                        onClick={() => setEditingCategory(cat.id)}
                      >
                        {tr('Edit')}
                      </button>
                      <button
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                        onClick={() => deleteCategory.mutate(cat.id)}
                      >
                        {tr('Delete')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {totalWeight !== 100 && (
                <p className="mt-2 text-xs text-[var(--color-warning)]">
                  {tr(
                    'Weights add up to {totalWeight}%, not 100%. Categories with graded work are renormalized automatically, but this is worth double-checking.',
                    { totalWeight }
                  )}
                </p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Card className="col-span-2 h-fit">
        <CardHeader>
          <h2 className="text-sm font-semibold">{tr('Archive')}</h2>
        </CardHeader>
        <CardBody className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {classSection.archived ? tr('This class is archived') : tr('Archive this class')}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {classSection.archived
                ? tr(
                    'Hidden from the active classes list. All its data is kept, and it can be unarchived any time. On the Portal, students still see it as finished: grades, feedback and materials, read-only.'
                  )
                : tr(
                    'Hides it from the active classes list at the end of a term, without deleting anything — roster, gradebook, attendance, and lesson plans are all kept. On the Portal it shows as finished: students keep their grades, feedback and materials, but can’t hand in more work or join.'
                  )}
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() =>
              updateClass.mutate({
                id: classSection.id,
                patch: { archived: !classSection.archived }
              })
            }
            disabled={updateClass.isPending}
          >
            {classSection.archived ? (
              <>
                <ArchiveRestore size={14} className="mr-1 inline" aria-hidden />
                {tr('Unarchive')}
              </>
            ) : (
              <>
                <Archive size={14} className="mr-1 inline" aria-hidden />
                {tr('Archive')}
              </>
            )}
          </Button>
        </CardBody>
      </Card>

      <Card className="col-span-2 border-[var(--color-danger)]/30">
        <CardHeader>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-danger)]">
            <AlertTriangle size={15} aria-hidden />
            {tr('Danger zone')}
          </h2>
        </CardHeader>
        <CardBody className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{tr('Delete this class')}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {tr(
                'Permanently removes the class, its roster, gradebook, attendance, and lesson plans.'
              )}
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmDeleteClass(true)}>
            {tr('Delete class')}
          </Button>
        </CardBody>
      </Card>

      <ClassFormModal
        open={showEditClass}
        onClose={() => setShowEditClass(false)}
        classSection={classSection}
      />
      {showNewTerm && (
        <NewTermClassModal open onClose={() => setShowNewTerm(false)} classSection={classSection} />
      )}
      <CategoryFormModal
        open={showAddCategory}
        onClose={() => setShowAddCategory(false)}
        classId={classSection.id}
        nextSortOrder={categories?.length ?? 0}
      />
      {editingCategory && (
        <CategoryFormModal
          open
          onClose={() => setEditingCategory(null)}
          classId={classSection.id}
          category={categories?.find((c) => c.id === editingCategory)}
          nextSortOrder={0}
        />
      )}
      <ConfirmDialog
        open={confirmDeleteClass}
        title={tr('Delete class')}
        message={tr(
          'Delete "{name}"? This permanently removes its roster, gradebook, attendance records, and lesson plans. This can\'t be undone.',
          { name: classSection.name }
        )}
        confirmLabel={tr('Delete')}
        danger
        onConfirm={async () => {
          await deleteClass.mutateAsync(classSection.id)
          navigate('/classes')
        }}
        onCancel={() => setConfirmDeleteClass(false)}
      />
    </div>
  )
}

function DetailItem({ label, value }: { label: string; value: string | null }): React.JSX.Element {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p>{value || '—'}</p>
    </div>
  )
}
