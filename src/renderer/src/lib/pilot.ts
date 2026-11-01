// Local-only pilot mode in the window: what's greyed out, and why. The main process
// refuses these anyway (main/services/pilotMode.ts); this is so the teacher sees the
// reason on the button instead of an error after pressing it.
import type { AppSettings } from '@shared/types'
import { blockedInPilot, type DataFlowId } from '@shared/dataFlows'
import { tr } from '@shared/i18n'
import { useSettings } from './queries'

export const DATA_FLOWS_ROUTE = '/settings?section=privacy'

/** Whether a Portal is set up and may be used: never in a local-only pilot. */
export function portalConnected(
  settings: Pick<AppSettings, 'portalUrl' | 'portalSyncSecret' | 'pilotMode'> | undefined
): boolean {
  if (!settings || settings.pilotMode) return false
  return !!settings.portalUrl.trim() && !!settings.portalSyncSecret.trim()
}

export function usePilotMode(): boolean {
  const { data: settings } = useSettings()
  return settings?.pilotMode === true
}

/** For a button that would send data off the computer: whether it's turned off here, and
 * the short reason to show on it. */
export function useOutbound(flow: DataFlowId): { blocked: boolean; reason: string | undefined } {
  const pilot = usePilotMode()
  const blocked = pilot && blockedInPilot(flow)
  return { blocked, reason: blocked ? pilotOffReason() : undefined }
}

export function pilotOffReason(): string {
  return tr('Turned off: this computer is in a local-only pilot, so nothing goes to the internet.')
}
