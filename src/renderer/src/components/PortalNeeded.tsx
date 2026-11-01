import { useNavigate } from 'react-router-dom'
import { Globe, ShieldCheck } from 'lucide-react'
import { EmptyState } from '@renderer/components/ui/EmptyState'
import { Button } from '@renderer/components/ui/Button'
import { DATA_FLOWS_ROUTE, usePilotMode } from '@renderer/lib/pilot'
import { tr } from '@shared/i18n'

/** What a Portal feature shows until a Portal is connected: what it's for, and the way
 * to connect one. In a local-only pilot there is no Portal, and it says so. */
export function PortalNeeded({ what }: { what: string }): React.JSX.Element {
  const navigate = useNavigate()
  const pilot = usePilotMode()
  if (pilot) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title={tr('Turned off in this local-only pilot')}
        description={tr(
          '{what} This goes through the Portal, which is turned off here so that nothing about your students goes to the internet. Everything else in EduBoard works as usual.',
          { what }
        )}
        action={
          <Button size="sm" onClick={() => navigate(DATA_FLOWS_ROUTE)}>
            {tr('What leaves this computer')}
          </Button>
        }
      />
    )
  }
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
