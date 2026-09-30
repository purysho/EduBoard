import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  downloadAsset,
  fetchLatestRelease,
  localUpdateFileName,
  normalizeSha256Digest,
  pickAsset
} from '../selfUpdateCore'

const HELLO_DIGEST =
  'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
const asset = (
  name: string,
  size = 5,
  digest: string | null = HELLO_DIGEST
): { name: string; url: string; size: number; digest: string | null } => ({
  name,
  url: `https://api.github.com/assets/${name}`,
  size,
  digest
})
const assets = [
  asset('EduBoard-Setup.exe'),
  asset('EduBoard-Portable.exe'),
  asset('EduBoard-arm64.dmg'),
  asset('EduBoard-x64.dmg'),
  asset('EduBoard.dmg'),
  asset('EduBoard.AppImage'),
  asset('latest.yml')
]

describe('which download fits this computer', () => {
  it('matches each kind of install', () => {
    expect(pickAsset('windows-installer', 'x64', assets)?.name).toBe('EduBoard-Setup.exe')
    expect(pickAsset('windows-portable', 'x64', assets)?.name).toBe('EduBoard-Portable.exe')
    expect(pickAsset('mac', 'arm64', assets)?.name).toBe('EduBoard-arm64.dmg')
    expect(pickAsset('mac', 'x64', assets)?.name).toBe('EduBoard-x64.dmg')
    expect(pickAsset('linux-appimage', 'x64', assets)?.name).toBe('EduBoard.AppImage')
  })

  it('falls back to an older universal Mac download, and says when there is none', () => {
    expect(pickAsset('mac', 'x64', [asset('EduBoard.dmg')])?.name).toBe('EduBoard.dmg')
    expect(pickAsset('linux-appimage', 'x64', [asset('EduBoard-Setup.exe')])).toBeNull()
  })

  it('still finds the update if the app is renamed, and never picks a blockmap', () => {
    const renamed = [
      asset('Tongban-Setup.exe.blockmap'),
      asset('Tongban-Setup.exe'),
      asset('Tongban-Portable.exe'),
      asset('Tongban-arm64.dmg.blockmap'),
      asset('Tongban-arm64.dmg'),
      asset('Tongban-x64.dmg'),
      asset('Tongban.AppImage')
    ]
    expect(pickAsset('windows-installer', 'x64', renamed)?.name).toBe('Tongban-Setup.exe')
    expect(pickAsset('windows-portable', 'x64', renamed)?.name).toBe('Tongban-Portable.exe')
    expect(pickAsset('mac', 'arm64', renamed)?.name).toBe('Tongban-arm64.dmg')
    expect(pickAsset('mac', 'x64', renamed)?.name).toBe('Tongban-x64.dmg')
    expect(pickAsset('linux-appimage', 'x64', renamed)?.name).toBe('Tongban.AppImage')
  })

  it('ignores release asset names that could become filesystem paths', () => {
    expect(pickAsset('windows-installer', 'x64', [asset('../Evil-Setup.exe')])).toBeNull()
    expect(pickAsset('windows-installer', 'x64', [asset('..\\Evil-Setup.exe')])).toBeNull()
    expect(pickAsset('windows-installer', 'x64', [asset('Evil:stream-Setup.exe')])).toBeNull()
    expect(pickAsset('mac', 'arm64', [asset('/tmp/Evil-arm64.dmg')])).toBeNull()
  })

  it('uses fixed local update names instead of release-provided names', () => {
    expect(localUpdateFileName('windows-installer')).toBe('update.exe')
    expect(localUpdateFileName('windows-portable')).toBe('update.exe')
    expect(localUpdateFileName('mac')).toBe('update.dmg')
    expect(localUpdateFileName('linux-appimage')).toBe('update.AppImage')
  })

  it('normalizes only complete SHA-256 digests', () => {
    expect(normalizeSha256Digest(HELLO_DIGEST.toUpperCase())).toBe(HELLO_DIGEST)
    expect(normalizeSha256Digest('sha256:1234')).toBeNull()
    expect(normalizeSha256Digest('md5:2cf24dba')).toBeNull()
    expect(normalizeSha256Digest(null)).toBeNull()
  })
})

describe('getting the new version', () => {
  let dir: string
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'eduboard-update-'))
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('asks the Portal when there is one, and downloads through it', async () => {
    const urls: string[] = []
    const fakeFetch = (async (url: string) => {
      urls.push(url)
      return Response.json({
        version: '0.3.3',
        assets: [{ name: 'EduBoard-Setup.exe', size: 5, digest: HELLO_DIGEST }]
      })
    }) as unknown as typeof fetch
    const release = await fetchLatestRelease('https://portal.example', fakeFetch)
    expect(release.version).toBe('0.3.3')
    expect(release.assets[0]).toEqual({
      name: 'EduBoard-Setup.exe',
      size: 5,
      digest: HELLO_DIGEST,
      url: 'https://portal.example/api/app-release/download/EduBoard-Setup.exe'
    })
    expect(urls).toEqual(['https://portal.example/api/app-release'])
  })

  it('asks GitHub directly without a Portal', async () => {
    const fakeFetch = (async () =>
      Response.json({
        tag_name: 'v0.3.3',
        assets: [
          {
            name: 'EduBoard.AppImage',
            size: 7,
            browser_download_url: 'https://gh/dl',
            digest: HELLO_DIGEST.toUpperCase()
          }
        ]
      })) as unknown as typeof fetch
    const release = await fetchLatestRelease(null, fakeFetch)
    expect(release).toEqual({
      version: '0.3.3',
      assets: [{ name: 'EduBoard.AppImage', size: 7, digest: HELLO_DIGEST, url: 'https://gh/dl' }]
    })
  })

  it('downloads with progress, and refuses a file of the wrong size', async () => {
    const fakeFetch = (async () => new Response('hello')) as unknown as typeof fetch
    const fractions: number[] = []
    const file = join(dir, 'EduBoard-Setup.exe')
    await downloadAsset(asset('EduBoard-Setup.exe', 5), file, (f) => fractions.push(f), fakeFetch)
    expect(readFileSync(file, 'utf8')).toBe('hello')
    expect(fractions.at(-1)).toBe(1)
    await expect(
      downloadAsset(asset('EduBoard.AppImage', 999), join(dir, 'x'), () => {}, fakeFetch)
    ).rejects.toThrow(/incomplete/)
  })

  it('refuses same-size content with the wrong digest and removes it', async () => {
    const fakeFetch = (async () => new Response('xxxxx')) as unknown as typeof fetch
    const file = join(dir, 'update.exe')
    await expect(
      downloadAsset(asset('EduBoard-Setup.exe', 5), file, () => {}, fakeFetch)
    ).rejects.toThrow(/verified/)
    expect(() => readFileSync(file)).toThrow()
  })

  it('refuses an update whose release metadata has no valid digest', async () => {
    let fetched = false
    const fakeFetch = (async () => {
      fetched = true
      return new Response('hello')
    }) as unknown as typeof fetch
    await expect(
      downloadAsset(asset('EduBoard-Setup.exe', 5, null), join(dir, 'update.exe'), () => {}, fakeFetch)
    ).rejects.toThrow(/verified/)
    expect(fetched).toBe(false)
  })
})
