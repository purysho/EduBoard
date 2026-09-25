// The Portal address receives the teacher's sync secret and every student's data, so it
// must be encrypted in transit. Plain http:// is allowed only for a Portal on this same
// computer (local testing), where nothing crosses a network.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/** Why this Portal address can't be used, or null if it's fine. Empty means "not set". */
export function portalUrlProblem(value: string): string | null {
  const trimmed = value.trim()
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
