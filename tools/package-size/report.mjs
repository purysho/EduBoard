import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import process from 'node:process'

const root = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) ?? 'out'
const check = process.argv.includes('--check')
const jsonOnly = process.argv.includes('--json')
const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const budgets = JSON.parse(readFileSync(new URL('./budgets.json', import.meta.url), 'utf8'))

function walk(dir) {
  const rows = []
  try {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const stat = statSync(path)
      if (stat.isDirectory()) rows.push(...walk(path))
      else rows.push({ path, size: stat.size })
    }
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  return rows
}

function sum(rows, predicate = () => true) {
  return rows.reduce((total, row) => total + (predicate(row) ? row.size : 0), 0)
}

const files = walk(root)
const normalized = (p) => relative(root, p).split(sep).join('/')
const isJs = (row) => /\.m?js$/i.test(row.path)
const rendererJsBytes = sum(files, (row) => normalized(row.path).startsWith('renderer/') && isJs(row))
const mainPreloadJsBytes = sum(
  files,
  (row) =>
    (normalized(row.path).startsWith('main/') || normalized(row.path).startsWith('preload/')) &&
    isJs(row)
)
const locales = files.filter((row) => normalized(row.path).split('/').includes('locales'))
const asar = files.find((row) => basename(row.path) === 'app.asar')
const nodeModulesBytes = sum(files, (row) => normalized(row.path).includes('node_modules/'))
const largest = [...files]
  .sort((a, b) => b.size - a.size)
  .slice(0, 15)
  .map((row) => ({ path: normalized(row.path), bytes: row.size }))
const productionDependencyCount = Object.keys(packageJson.dependencies ?? {}).length

const result = {
  root,
  fileCount: files.length,
  outTotalBytes: sum(files),
  rendererJsBytes,
  mainPreloadJsBytes,
  nodeModulesBytes,
  appAsarBytes: asar?.size ?? 0,
  localeBytes: sum(locales),
  localeFileCount: locales.length,
  productionDependencyCount,
  largest
}

const violations = []
if (check && files.length === 0) violations.push(`no files found under ${root}; build first`)
for (const key of ['outTotalBytes', 'rendererJsBytes', 'mainPreloadJsBytes', 'productionDependencyCount']) {
  const limit = budgets[key]
  if (typeof limit === 'number' && result[key] > limit) {
    violations.push(`${key}: ${result[key]} > budget ${limit}`)
  }
}

if (jsonOnly) {
  process.stdout.write(JSON.stringify({ ...result, budgets, violations }, null, 2) + '\n')
} else {
  const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2)
  console.log('EduBoard package composition')
  console.log(`  root: ${root}`)
  console.log(`  files: ${result.fileCount}`)
  console.log(`  total: ${mb(result.outTotalBytes)} MB`)
  console.log(`  renderer JS: ${mb(rendererJsBytes)} MB`)
  console.log(`  main + preload JS: ${mb(mainPreloadJsBytes)} MB`)
  console.log(`  packaged node_modules: ${mb(nodeModulesBytes)} MB`)
  console.log(`  app.asar: ${mb(result.appAsarBytes)} MB`)
  console.log(`  locales: ${mb(result.localeBytes)} MB across ${result.localeFileCount} files`)
  console.log(`  production dependencies: ${productionDependencyCount}`)
  if (largest.length) {
    console.log('  largest files:')
    for (const row of largest) console.log(`    ${mb(row.bytes)} MB  ${row.path}`)
  }
  if (violations.length) {
    console.error('Size budget violations:')
    for (const violation of violations) console.error(`  - ${violation}`)
  }
}

if (check && violations.length) process.exit(1)
