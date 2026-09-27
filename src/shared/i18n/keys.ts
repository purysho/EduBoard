// Finds every interface string passed to tr(), trn() and trNodes() in source text. Used
// by the coverage test; kept apart so the app never loads it.
const STR = String.raw`'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"`

function unescape(s: string): string {
  return s.replace(/\\(.)/g, (_m, c: string) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))
}

/** English keys used in one file's source. */
export function keysInSource(source: string): string[] {
  const keys: string[] = []
  const single = new RegExp(String.raw`\b(?:tr|trNodes|trMaybe)\(\s*(?:${STR})`, 'g')
  for (const m of source.matchAll(single)) keys.push(unescape(m[1] ?? m[2]))
  const plural = new RegExp(String.raw`\btrn\(\s*(?:${STR})\s*,\s*(?:${STR})`, 'g')
  for (const m of source.matchAll(plural)) keys.push(unescape(m[3] ?? m[4]))
  return keys
}
