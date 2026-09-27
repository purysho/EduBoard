import type { ReactNode } from 'react'
import { useSecurityStatus } from '@renderer/lib/queries'
import { LockScreen } from './LockScreen'

/** Renders the app only while it isn't locked. Until the first status arrives nothing
 * is shown, so a protected EduBoard never flashes its pages before the lock screen. */
export function SecurityGate({ children }: { children: ReactNode }): React.JSX.Element | null {
  const { data: status } = useSecurityStatus()
  if (!status) return null
  if (status.locked) return <LockScreen retryInSeconds={status.retryInSeconds} />
  return <>{children}</>
}
