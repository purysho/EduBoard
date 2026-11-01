// Local-only pilot mode: while it's on, nothing about the teacher's classes leaves this
// computer. A school pack turns it on (docs/SCHOOL_DEPLOYMENT.md, "A local-only pilot").
//
// Enforced here in the main process, not only greyed out in the window:
//   - pilotRefusal() is checked for every IPC call (ipc/register.ts handle()), and
//     refuses each channel of a 'blocked' flow in shared/dataFlows.ts;
//   - assertOutboundAllowed() is called by the network code itself (portalFetch, the AI
//     calls, group chat posts), so a background job or a channel missed above still
//     can't send;
//   - the usage ping, automatic update downloads and Electron's spelling dictionary
//     download check pilotModeOn() directly.
import { session } from 'electron'
import { AppError, withCode } from '@shared/errorCodes'
import { PILOT_BLOCKED_CHANNELS, dataFlow, type DataFlowId } from '@shared/dataFlows'
import { tr } from '@shared/i18n'
import { getSettings } from '../repositories/settingsRepo'
import { storedPilotMode } from '../i18n'

export function pilotModeOn(): boolean {
  try {
    return getSettings().pilotMode === true
  } catch {
    // The database can't be read yet (an encrypted one before the teacher unlocks it):
    // use the copy kept beside it, so a pilot holds from the first moment.
    return storedPilotMode()
  }
}

function refusalMessage(id: DataFlowId): string {
  return tr('Turned off in this local-only pilot: {what}. Nothing was sent.', {
    what: tr(dataFlow(id).name)
  })
}

/** Throws if pilot mode is on and the flow is one it turns off. */
export function assertOutboundAllowed(id: DataFlowId, on = pilotModeOn()): void {
  if (on && dataFlow(id).pilot === 'blocked') throw new AppError('EB-7001', refusalMessage(id))
}

/** The error to send back for an IPC call pilot mode refuses, or null to let it run.
 * Already carries its code, so it isn't written to the error log: in a pilot these are
 * expected (an automatic publish after every edit, for one). */
export function pilotRefusal(channel: string, on = pilotModeOn()): Error | null {
  if (!on) return null
  const flow = PILOT_BLOCKED_CHANNELS.get(channel)
  return flow ? new Error(withCode(refusalMessage(flow), 'EB-7001')) : null
}

// An address that can't be reached, so Electron's spellchecker never downloads a
// dictionary from Google while pilot mode is on. Electron has no "don't download" switch.
const NO_DICTIONARY_DOWNLOADS = 'http://127.0.0.1:9/'
const ELECTRON_DICTIONARY_DEFAULT = 'https://redirector.gvt1.com/edgedl/chrome/dict/'

/** Points Electron's spelling dictionary downloads away from the internet in pilot mode,
 * and back to Electron's default when it's off. Called at startup and whenever the
 * setting changes. */
export function applyPilotSpellcheck(on = pilotModeOn()): void {
  try {
    session.defaultSession.setSpellCheckerDictionaryDownloadURL(
      on ? NO_DICTIONARY_DOWNLOADS : ELECTRON_DICTIONARY_DEFAULT
    )
  } catch {
    // Before the app is ready, or not running inside Electron (tests).
  }
}
