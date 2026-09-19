import { FormEvent, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { AlertTriangle, Pencil, Plus, Tags } from 'lucide-react'
import type { ClassSection } from '@shared/types'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { Button } from '@renderer/components/ui/Button'
import { FormRow, Input } from '@renderer/components/ui/Field'
import { ConfirmDialog } from '@renderer/components/ui/ConfirmDialog'
import {
  useDeleteClass,
  useDeleteGradeCategory,
  useGradeCategories,
  useUpdateClass
} from '@renderer/lib/queries'
import { ClassFormModal } from './ClassFormModal'
import { CategoryFormModal } from './CategoryFormModal'

export function ClassSettingsTab(): React.JSX.Element {
  const { classSection } = useOutletContext<{ classSection: ClassSection }>()
  const navigate = useNavigate()
  const { data: categories } = useGradeCategories(classSection.id)
  const updateClass = useUpdateClass()
  const deleteClass = useDeleteClass()
  const deleteCategory = useDeleteGradeCategory(classSection.id)

  const [passMark, setPassMark] = useState(classSection.passMark)
  const [maxScore, setMaxScore] = useState(classSection.maxScore)
  const [thresholdA, setThresholdA] = useState(classSection.gradeThresholds.A)
  const [thresholdB, setThresholdB] = useState(classSection.gradeThresholds.B)
  const [thresholdC, setThresholdC] = useState(classSection.gradeThresholds.C)
  const [thresholdD, setThresholdD] = useState(classSection.gradeThresholds.D)

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
        gradeThresholds: {
          A: Number(thresholdA),
          B: Number(thresholdB),
          C: Number(thresholdC),
          D: Number(thresholdD)
        }
      }
    })
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <Card className="col-span-2 h-fit">
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Class details</h2>
          <Button variant="secondary" size="sm" onClick={() => setShowEditClass(true)}>
            <Pencil size={13} className="mr-1 inline" aria-hidden />
            Edit
          </Button>
        </CardHeader>
        <CardBody className="grid grid-cols-4 gap-4 text-sm">
          <DetailItem label="Subject" value={classSection.subject} />
          <DetailItem label="Grade level" value={classSection.gradeLevel} />
          <DetailItem label="Schedule" value={classSection.schedule} />
          <DetailItem label="Room" value={classSection.room} />
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <h2 className="text-sm font-semibold">Grading scale</h2>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleGradingSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormRow label="Pass mark (%)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={passMark}
                  onChange={(e) => setPassMark(Number(e.target.value))}
                />
              </FormRow>
              <FormRow label="Default assessment max score" hint="Used to prefill new assessments">
                <Input
                  type="number"
                  min={1}
                  value={maxScore}
                  onChange={(e) => setMaxScore(Number(e.target.value))}
                />
              </FormRow>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <FormRow label="A ≥">
                <Input
                  type="number"
                  value={thresholdA}
                  onChange={(e) => setThresholdA(Number(e.target.value))}
                />
              </FormRow>
              <FormRow label="B ≥">
                <Input
                  type="number"
                  value={thresholdB}
                  onChange={(e) => setThresholdB(Number(e.target.value))}
                />
              </FormRow>
              <FormRow label="C ≥">
                <Input
                  type="number"
                  value={thresholdC}
                  onChange={(e) => setThresholdC(Number(e.target.value))}
                />
              </FormRow>
              <FormRow label="D ≥">
                <Input
                  type="number"
                  value={thresholdD}
                  onChange={(e) => setThresholdD(Number(e.target.value))}
                />
              </FormRow>
            </div>
            <Button variant="primary" type="submit" disabled={updateClass.isPending}>
              {updateClass.isPending ? 'Saving…' : 'Save grading scale'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card className="h-fit">
        <CardHeader className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Tags size={15} className="text-[var(--color-text-muted)]" aria-hidden />
            Grade categories
          </h2>
          <Button variant="secondary" size="sm" onClick={() => setShowAddCategory(true)}>
            <Plus size={13} className="mr-1 inline" aria-hidden />
            Category
          </Button>
        </CardHeader>
        <CardBody>
          {!categories?.length ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              No categories yet — assessments will count equally toward the class grade. Add
              categories like &quot;Homework&quot; and &quot;Exams&quot; to weight them differently.
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
                        Edit
                      </button>
                      <button
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                        onClick={() => deleteCategory.mutate(cat.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {totalWeight !== 100 && (
                <p className="mt-2 text-xs text-[var(--color-warning)]">
                  Weights add up to {totalWeight}%, not 100%. Categories with graded work are
                  renormalized automatically, but this is worth double-checking.
                </p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      <Card className="col-span-2 border-[var(--color-danger)]/30">
        <CardHeader>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-danger)]">
            <AlertTriangle size={15} aria-hidden />
            Danger zone
          </h2>
        </CardHeader>
        <CardBody className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Delete this class</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Permanently removes the class, its roster, gradebook, attendance, and lesson plans.
            </p>
          </div>
          <Button variant="danger" onClick={() => setConfirmDeleteClass(true)}>
            Delete class
          </Button>
        </CardBody>
      </Card>

      <ClassFormModal
        open={showEditClass}
        onClose={() => setShowEditClass(false)}
        classSection={classSection}
      />
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
        title="Delete class"
        message={`Delete "${classSection.name}"? This permanently removes its roster, gradebook, attendance records, and lesson plans. This can't be undone.`}
        confirmLabel="Delete"
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
