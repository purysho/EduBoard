// Is an uploaded file really what its name says, and is it free of anything that runs?
//
// The extension decides which program opens a file, so an allowlist of extensions stops
// "essay.bat" outright. It doesn't stop a program renamed "essay.docx", or a real Word
// file carrying macros. So every allowed type also has to *look* like that type from its
// first bytes, anything with an executable signature is refused whatever its name, and
// macro-capable containers are refused if they hold a macro project.
//
// portal/services/fileSafety.js is a plain-JS copy (the Portal has no build step). Both
// run against src/shared/__tests__/fileSafetyCases.json; change them together.

export type FileCheck = { ok: true; kind: string } | { ok: false; reason: string }

/** Extensions a student may submit. Kept in step with the desktop's open allowlist
 * (untrustedFiles.ts), so nothing accepted here is later refused there. */
export const SUBMISSION_EXTENSIONS = [
  'pdf',
  'txt',
  'md',
  'csv',
  'rtf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'heic',
  'mp3',
  'm4a',
  'wav',
  'mp4',
  'mov',
  'webm'
] as const

const ZIP_OFFICE = new Set(['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp'])
const OLE_OFFICE = new Set(['doc', 'xls', 'ppt'])
const TEXT = new Set(['txt', 'md', 'csv'])

function startsWith(b: Uint8Array, bytes: number[], offset = 0): boolean {
  if (b.length < offset + bytes.length) return false
  return bytes.every((v, i) => b[offset + i] === v)
}
const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0))

/** Byte search. Zip entry names and OLE directory names are stored uncompressed, so a
 * macro project's name is findable without unpacking anything. */
function contains(b: Uint8Array, needle: number[]): boolean {
  outer: for (let i = 0; i + needle.length <= b.length; i++) {
    for (let j = 0; j < needle.length; j++) if (b[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}
const utf16le = (s: string): number[] => Array.from(s).flatMap((c) => [c.charCodeAt(0), 0])

function executableSignature(b: Uint8Array): string | null {
  if (startsWith(b, ascii('MZ'))) return 'a Windows program'
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return 'a Linux program'
  if (
    startsWith(b, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(b, [0xfe, 0xed, 0xfa, 0xcf]) ||
    startsWith(b, [0xcf, 0xfa, 0xed, 0xfe]) ||
    startsWith(b, [0xce, 0xfa, 0xed, 0xfe]) ||
    startsWith(b, [0xca, 0xfe, 0xba, 0xbe])
  ) {
    return 'a macOS program'
  }
  if (startsWith(b, ascii('#!'))) return 'a script'
  if (startsWith(b, [0x4c, 0x00, 0x00, 0x00, 0x01, 0x14, 0x02, 0x00])) return 'a Windows shortcut'
  return null
}

function looksLikeText(b: Uint8Array): boolean {
  const n = Math.min(b.length, 8192)
  for (let i = 0; i < n; i++) if (b[i] === 0) return false
  return true
}

function isFtyp(b: Uint8Array, brands: string[]): boolean {
  if (!startsWith(b, ascii('ftyp'), 4)) return false
  const brand = String.fromCharCode(...b.slice(8, 12))
  return brands.some((x) => brand.startsWith(x))
}

/** Checks a whole uploaded file. `fileName` is only used for its extension. */
export function checkUpload(fileName: string, bytes: Uint8Array): FileCheck {
  const ext = (/\.([a-z0-9]+)$/i.exec(fileName)?.[1] ?? '').toLowerCase()
  if (!(SUBMISSION_EXTENSIONS as readonly string[]).includes(ext)) {
    return { ok: false, reason: `".${ext || '?'}" files can't be submitted` }
  }
  if (bytes.length === 0) return { ok: false, reason: 'the file is empty' }

  const exe = executableSignature(bytes)
  if (exe) return { ok: false, reason: `this is ${exe}, not a .${ext} file` }

  const mismatch: FileCheck = { ok: false, reason: `the file's contents don't match ".${ext}"` }

  if (ext === 'pdf') return startsWith(bytes, ascii('%PDF-')) ? { ok: true, kind: 'pdf' } : mismatch

  if (ZIP_OFFICE.has(ext)) {
    if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return mismatch
    const isOoxml = contains(bytes, ascii('[Content_Types].xml'))
    const isOdf = contains(bytes, ascii('mimetypeapplication/vnd.oasis.opendocument'))
    if (ext.startsWith('od') ? !isOdf : !isOoxml) return mismatch
    const hasMacros = ext.startsWith('od')
      ? contains(bytes, ascii('Basic/'))
      : contains(bytes, ascii('vbaProject.bin'))
    if (hasMacros) {
      return { ok: false, reason: 'the document contains macros' }
    }
    return { ok: true, kind: ext }
  }

  if (OLE_OFFICE.has(ext)) {
    if (!startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return mismatch
    if (contains(bytes, utf16le('_VBA_PROJECT')) || contains(bytes, utf16le('Macros'))) {
      return { ok: false, reason: 'the document contains macros' }
    }
    return { ok: true, kind: ext }
  }

  if (ext === 'rtf') {
    if (!startsWith(bytes, ascii('{\\rtf'))) return mismatch
    // Embedded OLE objects are how RTF files deliver exploits; ordinary essays have none.
    if (contains(bytes, ascii('\\objdata')) || contains(bytes, ascii('\\objupdate'))) {
      return { ok: false, reason: 'the document contains embedded objects' }
    }
    return { ok: true, kind: 'rtf' }
  }

  if (TEXT.has(ext)) return looksLikeText(bytes) ? { ok: true, kind: ext } : mismatch

  switch (ext) {
    case 'png':
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
        ? { ok: true, kind: ext }
        : mismatch
    case 'jpg':
    case 'jpeg':
      return startsWith(bytes, [0xff, 0xd8, 0xff]) ? { ok: true, kind: 'jpg' } : mismatch
    case 'gif':
      return startsWith(bytes, ascii('GIF87a')) || startsWith(bytes, ascii('GIF89a'))
        ? { ok: true, kind: ext }
        : mismatch
    case 'webp':
      return startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)
        ? { ok: true, kind: ext }
        : mismatch
    case 'wav':
      return startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WAVE'), 8)
        ? { ok: true, kind: ext }
        : mismatch
    case 'heic':
      return isFtyp(bytes, ['heic', 'heix', 'mif1', 'msf1']) ? { ok: true, kind: ext } : mismatch
    case 'mp4':
    case 'm4a':
    case 'mov':
      return startsWith(bytes, ascii('ftyp'), 4) ? { ok: true, kind: ext } : mismatch
    case 'webm':
      return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3]) ? { ok: true, kind: ext } : mismatch
    case 'mp3':
      return startsWith(bytes, ascii('ID3')) ||
        (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)
        ? { ok: true, kind: ext }
        : mismatch
  }
  return mismatch
}
