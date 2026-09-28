// The parts of the in-app updater that don't need Electron, so they can be tested:
// where to ask for the newest release, which download fits this computer, and
// downloading it.
import { AppError } from '@shared/errorCodes'
import { createWriteStream, statSync } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { tr } from '@shared/i18n'

export const REPO = 'purysho/EduBoard'

export interface ReleaseAsset {
  name: string
  url: string
  size: number
}

export interface Release {
  version: string
  assets: ReleaseAsset[]
}

export type InstallKind = 'windows-installer' | 'windows-portable' | 'mac' | 'linux-appimage'

/** Which release file this copy of EduBoard updates itself from. Matched by the kind of
 * file (…-Setup.exe, …-arm64.dmg), not the product's name, so copies installed today
 * still find their update if the app is ever renamed (docs/RENAMING.md). */
export function pickAsset(
  kind: InstallKind,
  arch: string,
  assets: ReleaseAsset[]
): ReleaseAsset | null {
  const find = (pattern: RegExp): ReleaseAsset | null =>
    assets.find((a) => pattern.test(a.name)) ?? null
  switch (kind) {
    case 'windows-installer':
      return find(/-Setup\.exe$/)
    case 'windows-portable':
      return find(/-Portable\.exe$/)
    case 'mac':
      // Older releases had one universal EduBoard.dmg; use it when there's no per-chip one.
      return find(arch === 'arm64' ? /-arm64\.dmg$/ : /-x64\.dmg$/) ?? find(/^[^-]+\.dmg$/)
    case 'linux-appimage':
      return find(/\.AppImage$/)
  }
}

/**
 * The newest release. Through the teacher's Portal when there is one: it relays GitHub,
 * which in mainland China is often slow or blocked while the Portal's server isn't.
 * Otherwise straight from GitHub.
 */
export async function fetchLatestRelease(
  portalUrl: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<Release> {
  if (portalUrl) {
    const res = await fetchImpl(`${portalUrl}/api/app-release`, {
      signal: AbortSignal.timeout(20_000)
    })
    if (!res.ok)
      throw new AppError(
        'EB-3002',
        tr('Your Portal couldn’t check for updates ({status}).', { status: res.status })
      )
    const body = (await res.json()) as { version: string; assets: { name: string; size: number }[] }
    return {
      version: body.version,
      assets: body.assets.map((a) => ({
        name: a.name,
        size: a.size,
        url: `${portalUrl}/api/app-release/download/${encodeURIComponent(a.name)}`
      }))
    }
  }
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'EduBoard-Updater' },
    signal: AbortSignal.timeout(20_000)
  })
  if (!res.ok)
    throw new AppError(
      'EB-3002',
      tr('GitHub couldn’t be asked for updates ({status}).', { status: res.status })
    )
  const body = (await res.json()) as {
    tag_name: string
    assets: { name: string; size: number; browser_download_url: string }[]
  }
  return {
    version: body.tag_name.replace(/^v/, ''),
    assets: body.assets.map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url }))
  }
}

/** Downloads a release file, reporting progress, and checks its size at the end. */
export async function downloadAsset(
  asset: ReleaseAsset,
  destination: string,
  onProgress: (fraction: number) => void,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const res = await fetchImpl(asset.url, { headers: { 'User-Agent': 'EduBoard-Updater' } })
  if (!res.ok || !res.body)
    throw new AppError('EB-3003', tr('The download failed ({status}).', { status: res.status }))
  let received = 0
  const total = asset.size || Number(res.headers.get('content-length')) || 0
  const body = Readable.fromWeb(res.body as never)
  body.on('data', (chunk: Buffer) => {
    received += chunk.length
    if (total) onProgress(Math.min(1, received / total))
  })
  await pipeline(body, createWriteStream(destination))
  if (asset.size && statSync(destination).size !== asset.size) {
    throw new AppError('EB-3004', tr('The download was incomplete. Try again.'))
  }
}
