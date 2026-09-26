import { app } from 'electron'
import { getSettings } from '../repositories/settingsRepo'
import { normalizePortalUrl } from '@shared/portalUrl'
import { isNewerVersion } from '@shared/appVersion'
import type { UpdateCheck } from '@shared/types'

const RELEASES_URL = 'https://github.com/purysho/EduBoard/releases/latest'

/** Asks the teacher's Portal which desktop version is the newest (the Portal is updated
 * from the same code as each release). Never throws: no Portal, or no answer, simply
 * means "can't tell right now". */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const current = app.getVersion()
  const portalUrl = normalizePortalUrl(getSettings().portalUrl)
  if (!portalUrl)
    return { current, latest: null, updateAvailable: false, downloadUrl: RELEASES_URL }
  try {
    const res = await fetch(`${portalUrl}/api/app-version`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(String(res.status))
    const body = (await res.json()) as { version?: string; downloadUrl?: string }
    const latest = typeof body.version === 'string' ? body.version : null
    return {
      current,
      latest,
      updateAvailable: !!latest && isNewerVersion(latest, current),
      downloadUrl: body.downloadUrl || RELEASES_URL
    }
  } catch {
    return { current, latest: null, updateAvailable: false, downloadUrl: RELEASES_URL }
  }
}
