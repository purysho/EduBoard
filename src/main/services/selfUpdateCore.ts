// The parts of the in-app updater that don't need Electron, so they can be tested:
// where to ask for the newest release, which download fits this computer, and
// downloading it.
import { AppError } from '@shared/errorCodes'
import { createHash } from 'crypto'
import { createWriteStream, rmSync, statSync } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { tr } from '@shared/i18n'

export const REPO = 'purysho/EduBoard'

export interface ReleaseAsset {
  name: string
  url: string
  size: number
  digest: string | null
}

export interface Release {
  version: string
  assets: ReleaseAsset[]
}

export type InstallKind = 'windows-installer' | 'windows-portable' | 'mac' | 'linux-appimage'

// Release metadata comes from a network service. Never let an asset name become a local
// path: separators, Windows device/stream punctuation and control characters are refused.
// eslint-disable-next-line no-control-regex
const UNSAFE_RELEASE_ASSET_NAME = /[<>:"/\\|?*\u0000-\u001f]/

export function isSafeReleaseAssetName(name: unknown): name is string {
  if (typeof name !== 'string' || name.length === 0 || name.length > 180) return false
  if (name === '.' || name === '..' || name.endsWith('.') || name.endsWith(' ')) return false
  return !UNSAFE_RELEASE_ASSET_NAME.test(name)
}

export function normalizeSha256Digest(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /^sha256:([0-9a-f]{64})$/i.exec(value.trim())
  return match ? `sha256:${match[1].toLowerCase()}` : null
}

/** The name used on this computer is fixed by install kind, never copied from release
 * metadata. This keeps a compromised release listing from escaping pending-update/. */
export function localUpdateFileName(kind: InstallKind): string {
  switch (kind) {
    case 'windows-installer':
    case 'windows-portable':
      return 'update.exe'
    case 'mac':
      return 'update.dmg'
    case 'linux-appimage':
      return 'update.AppImage'
  }
}

/** Which release file this copy of EduBoard updates itself from. Matched by the kind of
 * file (…-Setup.exe, …-arm64.dmg), not the product's name, so copies installed today
 * still find their update if the app is ever renamed (docs/RENAMING.md). */
export function pickAsset(
  kind: InstallKind,
  arch: string,
  assets: ReleaseAsset[]
): ReleaseAsset | null {
  const find = (pattern: RegExp): ReleaseAsset | null =>
    assets.find((a) => isSafeReleaseAssetName(a.name) && pattern.test(a.name)) ?? null
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
    const body = (await res.json()) as {
      version: string
      assets: { name: string; size: number; digest?: string | null }[]
    }
    return {
      version: body.version,
      assets: body.assets.map((a) => ({
        name: a.name,
        size: a.size,
        digest: normalizeSha256Digest(a.digest),
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
    assets: {
      name: string
      size: number
      browser_download_url: string
      digest?: string | null
    }[]
  }
  return {
    version: body.tag_name.replace(/^v/, ''),
    assets: body.assets.map((a) => ({
      name: a.name,
      size: a.size,
      digest: normalizeSha256Digest(a.digest),
      url: a.browser_download_url
    }))
  }
}

/** Downloads a release file, reporting progress, then verifies both size and SHA-256. */
export async function downloadAsset(
  asset: ReleaseAsset,
  destination: string,
  onProgress: (fraction: number) => void,
  fetchImpl: typeof fetch = fetch
): Promise<void> {
  const expectedDigest = normalizeSha256Digest(asset.digest)
  if (!expectedDigest)
    throw new AppError('EB-3007', tr('The update could not be verified. Download it again.'))

  const res = await fetchImpl(asset.url, { headers: { 'User-Agent': 'EduBoard-Updater' } })
  if (!res.ok || !res.body)
    throw new AppError('EB-3003', tr('The download failed ({status}).', { status: res.status }))
  let received = 0
  const hash = createHash('sha256')
  const total = asset.size || Number(res.headers.get('content-length')) || 0
  const body = Readable.fromWeb(res.body as never)
  body.on('data', (chunk: Buffer) => {
    received += chunk.length
    hash.update(chunk)
    if (total) onProgress(Math.min(1, received / total))
  })
  await pipeline(body, createWriteStream(destination))
  if (asset.size && statSync(destination).size !== asset.size) {
    rmSync(destination, { force: true })
    throw new AppError('EB-3004', tr('The download was incomplete. Try again.'))
  }
  const actualDigest = `sha256:${hash.digest('hex')}`
  if (actualDigest !== expectedDigest) {
    rmSync(destination, { force: true })
    throw new AppError('EB-3007', tr('The update could not be verified. Download it again.'))
  }
}
