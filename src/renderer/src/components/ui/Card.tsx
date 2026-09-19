import { HTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div className={cn('px-5 py-4 border-b border-[var(--color-border)]', className)} {...props} />
  )
}

export function CardBody({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('p-5', className)} {...props} />
}
