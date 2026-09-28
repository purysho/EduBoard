import { useNavigate } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Button } from '@renderer/components/ui/Button'
import { tr } from '@shared/i18n'

/** What a Portal feature shows until a Portal is connected: what it's for, and the way
 * to connect one. */
export function PortalNeeded({ what }: { what: string }): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={Globe}
      title={tr('Connect a Portal first')}
      description={tr(
        '{what} This goes through the Portal, the website where students and families sign in (needs internet). Everything else in EduBoard works without it.',
        { what }
      )}
      action={
        <Button size="sm" onClick={() => navigate('/settings?section=portal')}>
          {tr('Open Portal settings')}
        </Button>
      }
    />
  )
}
