import { Plus, X } from 'lucide-react'
import type { GradeThresholds } from '@shared/types'
import {
  GRADE_SCALE_PRESETS,
  gradeBands,
  letterForPercent,
  scaleProblem,
  type GradeBand
} from '@shared/gradeScales'

/** Which preset a class's scale matches, or 'custom'. */
function presetId(value: GradeThresholds): string {
  if (!value.scale?.length) return 'af'
  const key = (bands: GradeBand[]): string =>
    [...bands]
      .sort((a, b) => b.min - a.min)
      .map((b) => `${b.label}:${b.min}`)
      .join('|')
  return (
    GRADE_SCALE_PRESETS.find((p) => p.bands && key(p.bands) === key(value.scale!))?.id ?? 'custom'
  )
}

/** Pick a scale (A–F, A–F with +/−, 优秀…待合格, 1–7, 9–1, Pass/Fail) or build one, and
 * set each band's cut-off. Shows what a few percents would get. */
export function GradeScaleEditor({
  value,
  onChange
}: {
  value: GradeThresholds
  onChange: (next: GradeThresholds) => void
}): React.JSX.Element {
  const current = presetId(value)
  const bands = gradeBands(value)
  const isAF = !value.scale?.length
  const problem = isAF ? null : scaleProblem(bands)
  const note = GRADE_SCALE_PRESETS.find((p) => p.id === current)?.note

  function setBands(next: GradeBand[]): void {
    onChange({ ...value, scale: next })
  }

  function setBand(i: number, patch: Partial<GradeBand>): void {
    if (isAF) {
      // A–F: only the A/B/C/D cut-offs are editable; F is always from 0.
      const letter = bands[i].label as 'A' | 'B' | 'C' | 'D'
      if (patch.min !== undefined && letter !== ('F' as string)) {
        onChange({ ...value, [letter]: patch.min })
      }
      return
    }
    setBands(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <span className="font-medium">Scale</span>
        <select
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
          value={current}
          onChange={(e) => {
            const id = e.target.value
            if (id === 'custom') {
              setBands(bands.map((b) => ({ ...b })))
              return
            }
            const preset = GRADE_SCALE_PRESETS.find((p) => p.id === id)
            onChange({
              ...value,
              scale: preset?.bands ? preset.bands.map((b) => ({ ...b })) : undefined
            })
          }}
        >
          {GRADE_SCALE_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="custom">Your own…</option>
        </select>
      </label>
      {note && <p className="text-xs text-[var(--color-text-muted)]">{note}</p>}

      <table className="text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--color-text-muted)]">
            <th className="pr-3 pb-1 font-medium">Band</th>
            <th className="pr-3 pb-1 font-medium">From %</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bands.map((b, i) => {
            const lowest = i === bands.length - 1
            return (
              <tr key={i}>
                <td className="pr-3 py-0.5">
                  <input
                    aria-label={`Band ${i + 1} name`}
                    className="w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 disabled:opacity-60"
                    value={b.label}
                    disabled={isAF}
                    onChange={(e) => setBand(i, { label: e.target.value })}
                  />
                </td>
                <td className="pr-3 py-0.5">
                  <input
                    aria-label={`${b.label} from percent`}
                    type="number"
                    min={0}
                    max={100}
                    className="w-20 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 disabled:opacity-60"
                    value={b.min}
                    disabled={isAF && lowest}
                    onChange={(e) => setBand(i, { min: Number(e.target.value) })}
                  />
                </td>
                <td>
                  {!isAF && bands.length > 2 && (
                    <button
                      type="button"
                      aria-label={`Remove ${b.label}`}
                      className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
                      onClick={() => setBands(bands.filter((_, j) => j !== i))}
                    >
                      <X size={13} aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {!isAF && (
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
          onClick={() => {
            const lowestAboveZero = Math.min(
              ...bands.filter((b) => b.min > 0).map((b) => b.min),
              100
            )
            setBands([...bands, { label: '', min: Math.max(1, Math.floor(lowestAboveZero / 2)) }])
          }}
        >
          <Plus size={12} aria-hidden />
          Add a band
        </button>
      )}
      {problem ? (
        <p className="text-xs text-[var(--color-danger)]">{problem}</p>
      ) : (
        <p className="text-xs text-[var(--color-text-muted)]">
          e.g. {[95, 82, 64, 40].map((p) => `${p}% → ${letterForPercent(p, value)}`).join(' · ')}
        </p>
      )}
    </div>
  )
}
