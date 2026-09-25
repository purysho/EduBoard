import { writeFileSync } from 'fs'
import { basename, extname, join, resolve, sep } from 'path'

// Files students upload through the Portal are untrusted twice over: the *name* is
// whatever their browser sent, and the *content* could be anything. The desktop app
// saves them to disk and hands them to the OS to open, so both need guarding.

/** A file name safe to create inside `dir`: no directories, no path traversal, no
 * characters Windows rejects, bounded length. Always returns a path inside `dir`. */
export function safeDownloadPath(dir: string, prefix: string, untrustedName: string): string {
  const base = basename(String(untrustedName).replace(/\\/g, '/'))
  const cleaned = `${prefix}-${base}`
    // Control characters are exactly what's being stripped here; Windows rejects them.
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/^\.+/, '_')
    .slice(-150)
  const full = resolve(dir, cleaned || `${prefix}-file`)
  if (!full.startsWith(resolve(dir) + sep)) return join(resolve(dir), `${prefix}-file`)
  return full
}

// Document types the OS will open in a viewer or editor rather than run. Anything else
// (.exe, .bat, .cmd, .js, .vbs, .lnk, .scr, .msi, .ps1, .jar, .app, .sh, ...) is revealed
// in its folder instead of launched, so a student can't run code on the teacher's computer.
const SAFE_TO_OPEN = new Set([
  '.pdf',
  '.txt',
  '.md',
  '.rtf',
  '.csv',
  '.doc',
  '.docx',
  '.odt',
  '.xls',
  '.xlsx',
  '.ods',
  '.ppt',
  '.pptx',
  '.odp',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.heic',
  '.mp3',
  '.m4a',
  '.wav',
  '.mp4',
  '.mov',
  '.webm'
])

export function isSafeToOpen(fileName: string): boolean {
  return SAFE_TO_OPEN.has(extname(fileName).toLowerCase())
}

/** Tags a downloaded file with Windows' Mark of the Web (the Zone.Identifier stream a
 * browser adds). Office then opens it in Protected View with macros blocked, and
 * SmartScreen warns before anything runs, the same as for a file from an email or a
 * website. No-op elsewhere, or on drives without NTFS streams. */
export function markAsDownloadedFromInternet(filePath: string): void {
  if (process.platform !== 'win32') return
  try {
    writeFileSync(`${filePath}:Zone.Identifier`, '[ZoneTransfer]\r\nZoneId=3\r\n')
  } catch {
    // FAT32/exFAT USB sticks have no alternate data streams. The content check still ran.
  }
}
