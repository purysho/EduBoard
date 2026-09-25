// The Portal address receives the teacher's sync secret and every student's data, so it
// must be encrypted in transit. Plain http:// is allowed only for a Portal on this same
// computer (local testing), where nothing crosses a network.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** The address as it will be used: "portal.school.edu" becomes
 * "https://portal.school.edu" (and a bare localhost address becomes http://, for the
 * local test Portal), with no trailing slash. Anything else is returned as typed so
 * portalUrlProblem can explain what's wrong with it. */
export function normalizePortalUrl(value: string): string {
  let url = value.trim()
  if (!url) return ''
  // Only a missing scheme is filled in. "javascript:…" or "mailto:…" already has one;
  // "localhost:4790" doesn't (a colon followed by a port number isn't a scheme).
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(url)
  if (!hasScheme) {
    const host = url.split(/[/:]/)[0].toLowerCase()
    url = `${LOCAL_HOSTS.has(host) ? 'http' : 'https'}://${url}`
  }
  return url.replace(/\/+$/, '')
}

/** Why this Portal address can't be used, or null if it's fine. Empty means "not set". */
export function portalUrlProblem(value: string): string | null {
  const trimmed = normalizePortalUrl(value)
  if (!trimmed) return null
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return 'That isn’t a web address. It should look like https://portal.yourschool.edu'
  }
  if (url.protocol === 'https:') return null
  if (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname)) return null
  if (url.protocol === 'http:') {
    return 'Use https:// — over plain http:// your sync secret and students’ data travel unencrypted.'
  }
  return 'The Portal address must start with https://'
}
