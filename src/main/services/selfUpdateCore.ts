// The parts of the in-app updater that don't need Electron, so they can be tested:
// where to ask for the newest release, which download fits this computer, and
// downloading it.
import { AppError } from '@shared/errorCodes'
import { createHash } from 'crypto'
import { createWriteStream, rmSync, statSync } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import { tr } from '@shared/i18n'
import { GITHUB_TIMEOUT_WITH_MIRROR_MS, UPDATE_MIRROR_URL } from '@shared/updateMirror'

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
 * Otherwise from GitHub, and if GitHub doesn't answer quickly, from the update mirror
 * (shared/updateMirror.ts) when one is set up. Only the version number goes to any of
 * them; downloads are checked against their SHA-256 whichever one they came from.
 */
export async function fetchLatestRelease(
  portalUrl: string | null,
  fetchImpl: typeof fetch = fetch,
  mirrorUrl: string = UPDATE_MIRROR_URL
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
  const mirror = usableMirror(mirrorUrl)
  if (!mirror) return fetchFromGitHub(fetchImpl, 20_000)
  try {
    return await fetchFromGitHub(fetchImpl, GITHUB_TIMEOUT_WITH_MIRROR_MS)
  } catch {
    try {
      return await fetchFromMirror(mirror, fetchImpl)
    } catch {
      throw new AppError(
        'EB-3002',
        tr(
          'Neither GitHub nor the update mirror could be asked for updates. Check the internet connection and try again later.'
        )
      )
    }
  }
}

async function fetchFromGitHub(fetchImpl: typeof fetch, timeoutMs: number): Promise<Release> {
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'EduBoard-Updater' },
    signal: AbortSignal.timeout(timeoutMs)
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

/** The mirror's address without a trailing slash, or null when there's none, or it isn't
 * https (an installer list must not be open to tampering on the way). */
export function usableMirror(mirrorUrl: string): string | null {
  const trimmed = mirrorUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  try {
    return new URL(trimmed).protocol === 'https:' ? trimmed : null
  } catch {
    return null
  }
}

/** Reads <mirror>/latest.json (see shared/updateMirror.ts for its shape). */
export async function fetchFromMirror(
  mirror: string,
  fetchImpl: typeof fetch = fetch
): Promise<Release> {
  const res = await fetchImpl(`${mirror}/latest.json`, {
    headers: { 'User-Agent': 'EduBoard-Updater' },
    signal: AbortSignal.timeout(20_000)
  })
  if (!res.ok)
    throw new AppError(
      'EB-3002',
      tr('The update mirror couldn’t be asked for updates ({status}).', { status: res.status })
    )
  const body = (await res.json()) as {
    version?: unknown
    assets?: { name?: unknown; size?: unknown; sha256?: unknown }[]
  }
  if (typeof body.version !== 'string' || !Array.isArray(body.assets))
    throw new AppError('EB-3002', tr('The update mirror’s version list couldn’t be read.'))
  return {
    version: body.version.replace(/^v/, ''),
    assets: body.assets
      .filter((a) => isSafeReleaseAssetName(a?.name))
      .map((a) => {
        const name = a.name as string
        const sha = typeof a.sha256 === 'string' ? a.sha256.trim() : ''
        return {
          name,
          size: typeof a.size === 'number' && a.size > 0 ? a.size : 0,
          // A missing or malformed checksum leaves the digest empty, and then
          // downloadAsset refuses the file.
          digest: normalizeSha256Digest(sha.startsWith('sha256:') ? sha : `sha256:${sha}`),
          url: `${mirror}/${encodeURIComponent(name)}`
        }
      })
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
