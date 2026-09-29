// Which links EduBoard hands to the system to open. A link's scheme decides what opens it,
// and on Windows some (file://\\server\…, ms-msdt:, search-ms: and others) can run a
// program with one click. Links can come from shared files (Course Packs, a colleague's
// resources), so only web pages and email addresses are ever opened.
const ALLOWED = new Set(['http:', 'https:', 'mailto:'])

export function isSafeExternalUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    return ALLOWED.has(new URL(url.trim()).protocol)
  } catch {
    return false
  }
}
