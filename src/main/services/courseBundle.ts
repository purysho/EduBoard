import JSZip from 'jszip'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { basename, extname, join, posix } from 'path'
import type { CoursePack } from '@shared/coursePack'
import { parseCoursePack } from '@shared/coursePack'
import { AppError } from '@shared/errorCodes'
import { tr } from '@shared/i18n'
import { resolveDataDir } from '../db/path'

const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024
const MAX_RESOURCE_BYTES = 100 * 1024 * 1024
const MAX_EXTRACTED_BYTES = 750 * 1024 * 1024
const MAX_RESOURCES = 500

interface CourseBundleManifest {
  kind: 'eduboard-course-bundle'
  version: 1
  coursePack: string
  resources: Record<string, string>
}

export interface LoadedCoursePackSource {
  kind: 'pack' | 'bundle'
  pack: CoursePack
  bundledResourceCount: number
  resourceFilePaths: Record<string, string>
}

function invalidBundle(detail: string): never {
  throw new AppError('EB-2007', tr('This Course Bundle can’t be used: {detail}', { detail }))
}

function safeZipPath(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) {
    invalidBundle(tr('{field} is missing or not valid', { field: label }))
  }
  const raw = value.replace(/\\/g, '/')
  const normalized = posix.normalize(raw)
  if (
    normalized.startsWith('/') ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    normalized === '.' ||
    normalized.endsWith('/')
  ) {
    invalidBundle(tr('{field} is missing or not valid', { field: label }))
  }
  return normalized
}

function safeName(value: string): string {
  const out = value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '')
  return out || 'resource'
}

function parseManifest(text: string): CourseBundleManifest {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    invalidBundle(tr('manifest.json isn’t valid JSON'))
  }
  if (!raw || typeof raw !== 'object') invalidBundle(tr('manifest.json is missing'))
  const x = raw as Record<string, unknown>
  if (x.kind !== 'eduboard-course-bundle' || x.version !== 1) {
    invalidBundle(tr('manifest.json is not an EduBoard Course Bundle v1'))
  }
  const coursePack = safeZipPath(x.coursePack, 'manifest.coursePack')
  if (!x.resources || typeof x.resources !== 'object' || Array.isArray(x.resources)) {
    invalidBundle(tr('{field} is missing or not valid', { field: 'manifest.resources' }))
  }
  const entries = Object.entries(x.resources as Record<string, unknown>)
  if (entries.length > MAX_RESOURCES) invalidBundle(tr('there are too many bundled resources'))
  const resources: Record<string, string> = {}
  for (const [key, value] of entries) {
    if (!/^[a-z0-9][a-z0-9._:-]{0,63}$/i.test(key)) {
      invalidBundle(tr('resource key {key} is not valid', { key }))
    }
    resources[key] = safeZipPath(value, `manifest.resources.${key}`)
  }
  return { kind: 'eduboard-course-bundle', version: 1, coursePack, resources }
}

async function loadBundle(filePath: string, extract: boolean): Promise<LoadedCoursePackSource> {
  const archive = await readFile(filePath)
  if (archive.byteLength > MAX_ARCHIVE_BYTES) invalidBundle(tr('the bundle file is too large'))

  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(archive)
  } catch {
    invalidBundle(tr('the bundle is not a readable ZIP file'))
  }

  const manifestEntry = zip.file('manifest.json')
  if (!manifestEntry) invalidBundle(tr('manifest.json is missing'))
  const manifest = parseManifest(await manifestEntry.async('text'))
  const packEntry = zip.file(manifest.coursePack)
  if (!packEntry) invalidBundle(tr('the Course Pack named in manifest.json is missing'))
  const pack = parseCoursePack(await packEntry.async('text'))

  const resourcesByKey = new Map((pack.resources ?? []).map((resource) => [resource.key.toLowerCase(), resource]))
  const mappedKeys = new Set<string>()
  const resourceFilePaths: Record<string, string> = {}
  const outputDir = join(resolveDataDir(), 'course-bundle-files', safeName(pack.id))
  let extractedBytes = 0

  for (const [manifestKey, sourcePath] of Object.entries(manifest.resources)) {
    const resource = resourcesByKey.get(manifestKey.toLowerCase())
    if (!resource) invalidBundle(tr('unknown resource key {key}', { key: manifestKey }))
    if (resource.type !== 'file') {
      invalidBundle(tr('resource {key} is not a file resource', { key: manifestKey }))
    }
    if (mappedKeys.has(resource.key.toLowerCase())) {
      invalidBundle(tr('the key {key} is used twice', { key: resource.key }))
    }
    mappedKeys.add(resource.key.toLowerCase())
    const entry = zip.file(sourcePath)
    if (!entry || entry.dir) {
      invalidBundle(tr('bundled file is missing for resource {key}', { key: resource.key }))
    }

    if (extract) {
      const bytes = await entry.async('nodebuffer')
      if (bytes.byteLength > MAX_RESOURCE_BYTES) {
        invalidBundle(tr('resource {key} is over 100 MB', { key: resource.key }))
      }
      extractedBytes += bytes.byteLength
      if (extractedBytes > MAX_EXTRACTED_BYTES) {
        invalidBundle(tr('the bundled resources are too large in total'))
      }
      await mkdir(outputDir, { recursive: true })
      const extension = extname(basename(sourcePath)).slice(0, 12)
      const outPath = join(outputDir, `${safeName(resource.key)}${extension}`)
      await writeFile(outPath, bytes)
      resourceFilePaths[resource.key] = outPath
    }
  }

  for (const resource of pack.resources ?? []) {
    if (resource.type === 'file' && !mappedKeys.has(resource.key.toLowerCase())) {
      invalidBundle(tr('file resource {key} has no bundled file', { key: resource.key }))
    }
  }

  return {
    kind: 'bundle',
    pack,
    bundledResourceCount: mappedKeys.size,
    resourceFilePaths
  }
}

export async function loadCoursePackSource(
  filePath: string,
  options: { extractBundleResources?: boolean } = {}
): Promise<LoadedCoursePackSource> {
  if (filePath.toLowerCase().endsWith('.coursebundle')) {
    return loadBundle(filePath, options.extractBundleResources === true)
  }
  return {
    kind: 'pack',
    pack: parseCoursePack(await readFile(filePath, 'utf-8')),
    bundledResourceCount: 0,
    resourceFilePaths: {}
  }
}
