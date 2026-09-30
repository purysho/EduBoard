import { readFile, stat, writeFile } from 'fs/promises'
import { isAbsolute, join, normalize, relative, resolve, sep } from 'path'
import JSZip from 'jszip'

function usage() {
  console.error('Usage: npm run course-bundle -- <source-folder> <output.coursebundle>')
  console.error('The source folder needs manifest.json, the Course Pack it names, and its resource files.')
  process.exit(2)
}

function safeRelative(value, label) {
  if (typeof value !== 'string' || !value.trim() || isAbsolute(value)) {
    throw new Error(`${label} must be a relative path`)
  }
  const normalized = normalize(value)
  if (normalized === '..' || normalized.startsWith('..' + sep)) {
    throw new Error(`${label} must stay inside the source folder`)
  }
  return normalized
}

const [, , sourceArg, outputArg] = process.argv
if (!sourceArg || !outputArg) usage()

const source = resolve(sourceArg)
const output = resolve(outputArg)
const manifestPath = join(source, 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
if (manifest.kind !== 'eduboard-course-bundle' || manifest.version !== 1) {
  throw new Error('manifest.json must be an EduBoard Course Bundle v1 manifest')
}
const coursePack = safeRelative(manifest.coursePack, 'manifest.coursePack')
if (!manifest.resources || typeof manifest.resources !== 'object' || Array.isArray(manifest.resources)) {
  throw new Error('manifest.resources must map resource keys to relative file paths')
}

const paths = new Set([coursePack, ...Object.values(manifest.resources).map((v, i) => safeRelative(v, `resource ${i + 1}`))])
const zip = new JSZip()
zip.file('manifest.json', JSON.stringify(manifest, null, 2) + '\n')

for (const rel of paths) {
  const full = resolve(source, rel)
  const back = relative(source, full)
  if (back === '..' || back.startsWith('..' + sep) || isAbsolute(back)) {
    throw new Error(`Path escapes source folder: ${rel}`)
  }
  const info = await stat(full)
  if (!info.isFile()) throw new Error(`Not a file: ${rel}`)
  zip.file(rel.replaceAll('\\', '/'), await readFile(full))
}

const bytes = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 }
})
await writeFile(output, bytes)
console.log(`Created ${output} (${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB)`)
