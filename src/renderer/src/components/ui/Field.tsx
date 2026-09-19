import {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
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
