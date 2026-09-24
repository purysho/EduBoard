import {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useState
} from 'react'
import { cn } from '@renderer/lib/cn'

const fieldClasses =
  'w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] disabled:opacity-50'

export function Label(props: LabelHTMLAttributes<HTMLLabelElement>): React.JSX.Element {
  return (
    <label
      {...props}
      className={cn(
        'mb-1 block text-xs font-medium text-[var(--color-text-muted)]',
        props.className
      )}
    />
  )
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): React.JSX.Element {
  return <input className={cn(fieldClasses, className)} {...props} />
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): React.JSX.Element {
  return <textarea className={cn(fieldClasses, 'min-h-20 resize-y', className)} {...props} />
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>): React.JSX.Element {
  return <select className={cn(fieldClasses, className)} {...props} />
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

/** A Month/Day/Year select trio instead of the OS date picker — used everywhere a date
 * is entered (due dates, DOB, assessment/schedule dates), for a consistent look across
 * the app and to avoid the ambiguous mm/dd-vs-dd/mm reading of a typed date string.
 *
 * Keyed by `value` so the inner component remounts (and re-derives its local Y/M/D
 * state fresh) whenever the caller changes `value` out from under it — e.g. clearing
 * the field after "Add date." Between those resets, the inner component owns its own
 * state, so picking just the month doesn't get wiped out while day/year are still
 * unset (the caller's `value` only ever holds a complete date or ''). */
export function DateSelect(props: {
  value: string | null | undefined
  onChange: (value: string) => void
  minYear?: number
  maxYear?: number
  required?: boolean
  id?: string
}): React.JSX.Element {
  return <DateSelectFields key={props.value || ''} {...props} />
}

function DateSelectFields({
  value,
  onChange,
  minYear,
  maxYear,
  required,
  id
}: {
  value: string | null | undefined
  onChange: (value: string) => void
  minYear?: number
  maxYear?: number
  required?: boolean
  id?: string
}): React.JSX.Element {
  const thisYear = new Date().getFullYear()
  const lo = minYear ?? thisYear - 5
  const hi = maxYear ?? thisYear + 5

  const [initialY = '', initialM = '', initialD = ''] = (value || '').split('-')
  const [y, setY] = useState(initialY)
  const [m, setM] = useState(initialM)
  const [d, setD] = useState(initialD)

  function pick(ny: string, nm: string, nd: string): void {
    setY(ny)
    setM(nm)
    setD(nd)
    onChange(ny && nm && nd ? `${ny}-${nm}-${nd}` : '')
  }

  const years = Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => hi - i)

  return (
    <div id={id} className="grid grid-cols-[2fr_1fr_1.2fr] gap-2">
      <Select value={m} onChange={(e) => pick(y, e.target.value, d)} required={required}>
        <option value="">Month</option>
        {MONTH_NAMES.map((name, i) => (
          <option key={name} value={String(i + 1).padStart(2, '0')}>
            {name}
          </option>
        ))}
      </Select>
      <Select value={d} onChange={(e) => pick(y, m, e.target.value)} required={required}>
        <option value="">Day</option>
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <option key={day} value={String(day).padStart(2, '0')}>
            {day}
          </option>
        ))}
      </Select>
      <Select value={y} onChange={(e) => pick(e.target.value, m, d)} required={required}>
        <option value="">Year</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </Select>
    </div>
  )
}

export function FormRow({
  label,
  children,
  hint
}: {
  label: string
  children: ReactNode
  hint?: string
}): React.JSX.Element {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      {hint && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>}
    </div>
  )
}
