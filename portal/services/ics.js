// Plain iCalendar (RFC 5545) text helpers, with nothing else loaded.

/** Text as an iCalendar value: backslash, semicolon, comma and newlines escaped. */
function escapeText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Lines longer than 75 bytes continue on the next line after a space, never splitting
 * a character (Chinese is 3 bytes each in UTF-8). */
function fold(line) {
  const out = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch)
    if (bytes + size > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

module.exports = { escapeText, fold }
