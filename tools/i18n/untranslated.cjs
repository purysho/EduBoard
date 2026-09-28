/* eslint-disable */
// Lists interface text not yet wrapped in tr()/trn(), so new screens stay translatable:
//   node tools/i18n/untranslated.cjs "$PWD" [files]   (default: every renderer file)
// Some hits are fine (routes, CSS, data keys); read the list, fix the real ones.
const fs = require('fs')
const path = require('path')
const repo = process.argv[2]
const ts = require(path.join(repo, 'node_modules/typescript'))

const NON_TEXT_ATTRS = new Set([
  'className',
  'key',
  'type',
  'variant',
  'size',
  'id',
  'href',
  'to',
  'htmlFor',
  'name',
  'value',
  'accept',
  'role',
  'style',
  'form',
  'src',
  'target',
  'rel',
  'method',
  'autoComplete',
  'inputMode',
  'pattern',
  'lang',
  'dir',
  'tone',
  'icon',
  'align',
  'side',
  'width',
  'height',
  'viewBox',
  'd',
  'fill',
  'stroke',
  'dataKey',
  'layout',
  'strokeDasharray',
  'defaultValue',
  'color',
  'mode',
  'position',
  'kind',
  'status',
  'as',
  'rows',
  'min',
  'max',
  'step',
  'download',
  'spellCheck'
])
const TR = new Set(['tr', 'trn', 'trMaybe', 'tk'])

function decode(s) {
  return s
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}
const isCodeish = (s) =>
  /^[a-z0-9_.:\/@#?=&%-]*$/.test(s) || // identifiers, paths, keys
  /var\(--|^https?:|^mailto:|^data:/.test(s) ||
  (/^[MdyEhHpaQqLwkKmsSXxzZoTuG ,.:'\/-]+$/.test(s) && /[Md]/.test(s) && !/ [a-z]{3,}/.test(s)) || // date patterns
  /^(\s*[\w-]+:[\w\-!]+\s*)+$/.test(s) || // tailwind-ish variants
  /\b(px|py|mt|mb|ml|mr|mx|my|p|m|text|bg|flex|grid|rounded|border|gap|w|h|items|justify|font|hover|focus)-/.test(
    s
  )

function check(file) {
  const src = fs.readFileSync(file, 'utf8')
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out = []
  const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const inTr = (n) => {
    for (let p = n.parent; p; p = p.parent) {
      if (ts.isCallExpression(p) && TR.has(p.expression.getText(sf))) return true
      if (ts.isJsxAttribute(p))
        return (
          NON_TEXT_ATTRS.has(p.name.getText(sf)) ||
          /^(data-|aria-(?!label))/.test(p.name.getText(sf))
        )
      if (
        ts.isImportDeclaration(p) ||
        ts.isExportDeclaration(p) ||
        ts.isLiteralTypeNode(p) ||
        ts.isTypeNode(p)
      )
        return true
      if (
        ts.isCallExpression(p) &&
        /^(console\.\w+|queryKey|useQuery|invalidateQueries|classList\.\w+|getElementById|querySelector\w*|addEventListener|removeEventListener|setAttribute|getItem|setItem|removeItem|matchMedia|localStorage\.\w+|require|cn|clsx|format|formatDate|formatLocal|parseISO|new Date|Error|emit|on|send|invoke|handle)$/.test(
          p.expression.getText(sf).split('.').slice(-1)[0]
        )
      )
        return true
      if (
        ts.isCallExpression(p) &&
        /(\.|^)(includes|startsWith|endsWith|split|join|replace|match|test|padStart|localeCompare|get|set|has|delete|filter|find|sort)$/.test(
          p.expression.getText(sf)
        )
      )
        return true
      if (
        ts.isBinaryExpression(p) &&
        [
          ts.SyntaxKind.EqualsEqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsEqualsToken,
          ts.SyntaxKind.EqualsEqualsToken,
          ts.SyntaxKind.ExclamationEqualsToken
        ].includes(p.operatorToken.kind)
      )
        return true
      if (ts.isCaseClause(p) || ts.isElementAccessExpression(p)) return true
      if (
        ts.isPropertyAssignment(p) &&
        /^(queryKey|className|key|id|type|variant|kind|status|mode|method|channel|color|icon|path|to|href|value|role|tone|dataKey)$/.test(
          p.name.getText(sf)
        )
      )
        return true
      if (ts.isStatement(p) || ts.isFunctionLike(p)) break
    }
    return false
  }
  function visit(n) {
    if (ts.isJsxText(n)) {
      const t = decode(n.text).trim()
      const parentTag =
        n.parent && ts.isJsxElement(n.parent) ? n.parent.openingElement.tagName.getText(sf) : ''
      if (/[A-Za-z]/.test(t) && !['code', 'kbd', 'pre'].includes(parentTag))
        out.push(`${line(n)}: JSX ${JSON.stringify(t.replace(/\s+/g, ' ').slice(0, 110))}`)
    } else if (
      ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) &&
        !ts.isPropertyAssignment(n.parent)) ||
      (ts.isStringLiteral(n) && ts.isPropertyAssignment(n.parent) && n.parent.initializer === n)
    ) {
      const t = n.text
      if (
        /[A-Za-z]/.test(t) &&
        !isCodeish(t) &&
        !inTr(n) &&
        !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)
      ) {
        out.push(`${line(n)}: str ${JSON.stringify(t.slice(0, 110))}`)
      }
    } else if (ts.isTemplateExpression(n) && !inTr(n)) {
      const lits = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join(' ')
      if (/[A-Za-z]{2,}/.test(lits) && !isCodeish(lits.replace(/\s+/g, '')))
        out.push(`${line(n)}: tpl ${n.getText(sf).slice(0, 110)}`)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name)
    if (d.isDirectory()) return d.name === '__tests__' ? [] : walk(p)
    return /\.tsx?$/.test(d.name) ? [p] : []
  })
}
const explicit = process.argv.slice(3)
const files = explicit.length
  ? explicit.map((f) => path.resolve(repo, f))
  : walk(path.join(repo, 'src/renderer/src'))
let total = 0
for (const f of files) {
  const r = check(f)
  if (!r.length) continue
  total += r.length
  console.log(`== ${path.relative(repo, f)} (${r.length})`)
  r.forEach((l) => console.log('  ' + l))
}
console.log(`total ${total}`)
