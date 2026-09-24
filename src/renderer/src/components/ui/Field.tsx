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
 * The caller's `value` only ever holds a complete date or '', so the Y/M/D picks live in
 * local state — picking just the month mustn't get wiped out while day/year are unset.
 * That local state is re-derived only when `value` changes to something this component
 * didn't report itself (e.g. the caller clearing the field after "Add date"). Clearing
 * one dropdown back to its placeholder reports '' but keeps the other two picks. */
export function DateSelect({
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

  const current = value || ''
  const [parts, setParts] = useState(() => splitDate(current))
  const [lastSeen, setLastSeen] = useState(current)
  if (current !== lastSeen) {
    setLastSeen(current)
    setParts(splitDate(current))
  }
  const { y, m, d } = parts

  function pick(ny: string, nm: string, nd: string): void {
    const next = ny && nm && nd ? `${ny}-${nm}-${nd}` : ''
    setParts({ y: ny, m: nm, d: nd })
    setLastSeen(next)
    onChange(next)
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

function splitDate(value: string): { y: string; m: string; d: string } {
  const [y = '', m = '', d = ''] = value.split('-')
  return { y, m, d }
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
