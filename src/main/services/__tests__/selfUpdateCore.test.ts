import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { downloadAsset, fetchLatestRelease, pickAsset } from '../selfUpdateCore'

const asset = (name: string, size = 5): { name: string; url: string; size: number } => ({
  name,
  url: `https://api.github.com/assets/${name}`,
  size
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
      return Response.json({ version: '0.3.3', assets: [{ name: 'EduBoard-Setup.exe', size: 5 }] })
    }) as unknown as typeof fetch
    const release = await fetchLatestRelease('https://portal.example', fakeFetch)
    expect(release.version).toBe('0.3.3')
    expect(release.assets[0].url).toBe(
      'https://portal.example/api/app-release/download/EduBoard-Setup.exe'
    )
    expect(urls).toEqual(['https://portal.example/api/app-release'])
  })

  it('asks GitHub directly without a Portal', async () => {
    const fakeFetch = (async () =>
      Response.json({
        tag_name: 'v0.3.3',
        assets: [{ name: 'EduBoard.AppImage', size: 7, browser_download_url: 'https://gh/dl' }]
      })) as unknown as typeof fetch
    const release = await fetchLatestRelease(null, fakeFetch)
    expect(release).toEqual({
      version: '0.3.3',
      assets: [{ name: 'EduBoard.AppImage', size: 7, url: 'https://gh/dl' }]
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
})
