// Turns a failed Portal response into a sentence a teacher can act on. Servers (and
// proxies in front of them) often answer errors with an HTML page; showing that raw
// made "Portal sync failed: 413 <!DOCTYPE html>…" the whole message.

function readableBody(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  try {
    const json = JSON.parse(trimmed) as { error?: unknown }
    if (typeof json.error === 'string') return json.error
  } catch {
    // not JSON
  }
  if (trimmed.startsWith('<')) {
    // Express's default error page puts the message in <pre>; keep its first line only.
    const pre = /<pre>([\s\S]*?)<\/pre>/i.exec(trimmed)?.[1] ?? ''
    return pre
      .split(/<br\s*\/?>/i)[0]
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
  }
  return trimmed.slice(0, 300)
}

/** A plain explanation for a Portal HTTP failure. `action` says what was being done. */
export function describePortalFailure(action: string, status: number, bodyText: string): string {
  const detail = readableBody(bodyText)
  const withDetail = (message: string): string => (detail ? `${message} (${detail})` : message)
  switch (status) {
    case 401:
    case 403:
      return `${action}: the Portal didn't accept the sync secret. In Settings, it must be exactly the SYNC_SECRET set on the Portal server.`
    case 413:
      return withDetail(
        `${action}: the Portal server refused it as too large. Update the Portal server to the latest version, which accepts attachments one at a time.`
      )
    case 502:
    case 503:
    case 504:
      return withDetail(
        `${action}: the Portal server isn't responding right now. Try again in a minute.`
      )
  }
  return withDetail(`${action} (error ${status})`)
}

export async function portalFailure(action: string, res: Response): Promise<Error> {
  return new Error(describePortalFailure(action, res.status, await res.text().catch(() => '')))
}
