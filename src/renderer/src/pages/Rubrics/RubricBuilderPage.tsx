import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import type { RubricCriterionDraft } from '@shared/inputs'
import { PageHeader } from '@renderer/components/ui/PageHeader'
import { Button } from '@renderer/components/ui/Button'
import { Card, CardBody, CardHeader } from '@renderer/components/ui/Card'
import { FormRow, Input, Select, Textarea } from '@renderer/components/ui/Field'
import { Spinner } from '@renderer/components/ui/EmptyState'
import { useCreateRubric, useRubric, useStandards, useUpdateRubric } from '@renderer/lib/queries'

function emptyCriterion(): RubricCriterionDraft {
  return {
    name: '',
    description: '',
    standardId: null,
    levels: [
      { label: 'Excellent', points: 4, description: '' },
      { label: 'Good', points: 3, description: '' },
      { label: 'Needs work', points: 1, description: '' }
    ]
  }
}

export function RubricBuilderPage(): React.JSX.Element {
  const { rubricId } = useParams<{ rubricId: string }>()
  const isNew = rubricId === 'new'
  const navigate = useNavigate()
  const { data: existing, isLoading } = useRubric(isNew ? undefined : rubricId)
  const { data: standards } = useStandards()
  const createRubric = useCreateRubric()
  const updateRubric = useUpdateRubric()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState<RubricCriterionDraft[]>([emptyCriterion()])
  // Keyed to the rubric id (not a plain boolean) so navigating from one existing
  // rubric's edit page directly to another's — React Router reuses this component
  // instance, only the :rubricId param changes — re-hydrates instead of leaving the
  // previous rubric's data on screen under the new rubric's title.
  const [loadedForId, setLoadedForId] = useState<string | null>(isNew ? 'new' : null)

  // Hydrate the edit buffer from the fetched rubric during render (not an effect) so
  // it can't fight with what the user is typing — same pattern as ScoreCell.
  if (!isNew && existing && loadedForId !== rubricId) {
    setLoadedForId(rubricId ?? null)
    setName(existing.name)
    setDescription(existing.description ?? '')
    setCriteria(
      existing.criteria.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? '',
        standardId: c.standardId,
        levels: c.levels.map((l) => ({
          id: l.id,
          label: l.label,
          points: l.points,
          description: l.description ?? ''
        }))
      }))
    )
  }

  const saving = createRubric.isPending || updateRubric.isPending
  const maxPoints = criteria.reduce((sum, c) => {
    const best = c.levels.reduce((max, l) => Math.max(max, Number(l.points) || 0), 0)
    return sum + best
  }, 0)

  function updateCriterion(index: number, patch: Partial<RubricCriterionDraft>): void {
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function addCriterion(): void {
    setCriteria((prev) => [...prev, emptyCriterion()])
  }

  function removeCriterion(index: number): void {
    setCriteria((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLevel(
    criterionIndex: number,
    levelIndex: number,
    patch: Partial<RubricCriterionDraft['levels'][number]>
  ): void {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i !== criterionIndex
          ? c
          : { ...c, levels: c.levels.map((l, j) => (j === levelIndex ? { ...l, ...patch } : l)) }
      )
    )
  }

  function addLevel(criterionIndex: number): void {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i !== criterionIndex
          ? c
          : { ...c, levels: [...c.levels, { label: '', points: 0, description: '' }] }
      )
    )
  }

  function removeLevel(criterionIndex: number, levelIndex: number): void {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i !== criterionIndex ? c : { ...c, levels: c.levels.filter((_, j) => j !== levelIndex) }
      )
    )
  }

  const canSave =
    name.trim().length > 0 &&
    criteria.length > 0 &&
    criteria.every((c) => c.name.trim().length > 0 && c.levels.length > 0)

  async function handleSave(): Promise<void> {
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      criteria: criteria.map((c) => ({
        ...c,
        name: c.name.trim(),
        levels: c.levels.map((l) => ({ ...l, points: Number(l.points) || 0 }))
      }))
    }
    if (isNew) {
      const created = await createRubric.mutateAsync(payload)
      navigate(`/rubrics/${created.id}`, { replace: true })
    } else if (rubricId) {
      await updateRubric.mutateAsync({ id: rubricId, input: payload })
    }
  }

  if (!isNew && isLoading) return <Spinner />

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={isNew ? 'New rubric' : 'Edit rubric'}
        description={`${maxPoints} points max across ${criteria.length} criteria`}
        leading={
          <button
            onClick={() => navigate('/rubrics')}
            className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
            aria-label="Back to rubrics"
          >
            <ArrowLeft size={18} aria-hidden />
          </button>
        }
        actions={
          <Button variant="primary" onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save rubric'}
          </Button>
        }
      />

      <Card className="mb-4">
        <CardBody className="space-y-4">
          <FormRow label="Rubric name" hint='e.g. "Persuasive essay rubric"'>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FormRow>
          <FormRow label="Description (optional)">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormRow>
        </CardBody>
      </Card>

      <div className="space-y-4">
        {criteria.map((criterion, ci) => (
          <Card key={criterion.id ?? ci}>
            <CardHeader className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--color-text-muted)]">
                Criterion {ci + 1}
              </span>
              <button
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-danger)] disabled:opacity-30"
                onClick={() => removeCriterion(ci)}
                disabled={criteria.length === 1}
                aria-label="Remove criterion"
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormRow label="Name">
                    <Input
                      value={criterion.name}
                      onChange={(e) => updateCriterion(ci, { name: e.target.value })}
                      placeholder="e.g. Thesis"
                    />
                  </FormRow>
                </div>
                <FormRow label="Standard (optional)">
                  <Select
                    value={criterion.standardId ?? ''}
                    onChange={(e) => updateCriterion(ci, { standardId: e.target.value || null })}
                  >
                    <option value="">None</option>
                    {standards?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}
                      </option>
                    ))}
                  </Select>
                </FormRow>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                  Performance levels
                </p>
                <div className="space-y-2">
                  {criterion.levels.map((level, li) => (
                    <div key={level.id ?? li} className="flex items-start gap-2">
                      <Input
                        className="w-32"
                        value={level.label}
                        onChange={(e) => updateLevel(ci, li, { label: e.target.value })}
                        placeholder="Label"
                      />
                      <Input
                        type="number"
                        className="w-20"
                        value={level.points}
                        onChange={(e) => updateLevel(ci, li, { points: Number(e.target.value) })}
                        placeholder="Pts"
                      />
                      <Input
                        value={level.description ?? ''}
                        onChange={(e) => updateLevel(ci, li, { description: e.target.value })}
                        placeholder="Description (optional)"
                      />
                      <button
                        className="mt-1.5 shrink-0 rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] disabled:opacity-30"
                        onClick={() => removeLevel(ci, li)}
                        disabled={criterion.levels.length === 1}
                        aria-label="Remove level"
                      >
                        <Trash2 size={13} aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => addLevel(ci)}>
                  <Plus size={13} className="mr-1 inline" aria-hidden />
                  Level
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Button variant="secondary" className="mt-4" onClick={addCriterion}>
        <Plus size={14} className="mr-1 inline" aria-hidden />
        Add criterion
      </Button>
    </div>
  )
}
