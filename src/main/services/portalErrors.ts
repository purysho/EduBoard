import { tr } from '@shared/i18n'
import { AppError, type AppErrorCode } from '@shared/errorCodes'
// Turns a failed Portal response into a sentence a teacher can act on. Servers (and
// proxies in front of them) often answer errors with an HTML page; showing that raw
// made "Portal sync failed: 413 <!DOCTYPE html>…" the whole message.

function readableBody(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''
  try {
    const json = JSON.parse(trimmed) as { error?: unknown; code?: unknown; ref?: unknown }
    if (typeof json.error === 'string') {
      // The Portal's own code (and reference, for its unexpected errors), for looking up.
      const code = typeof json.code === 'string' && /^PT-\d{4}$/.test(json.code) ? json.code : ''
      const ref = typeof json.ref === 'string' && /^[A-Z0-9]{4,12}$/.test(json.ref) ? json.ref : ''
      return [json.error, code, ref && `ref ${ref}`].filter(Boolean).join(' · ')
    }
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
      return tr(
        '{action}: the Portal didn’t accept the sync secret. In Settings, it must be exactly the SYNC_SECRET set on the Portal server.',
        { action }
      )
    case 413:
      return withDetail(
        tr(
          '{action}: the Portal server refused it as too large. Update the Portal server to the latest version, which accepts attachments one at a time.',
          { action }
        )
      )
    case 502:
    case 503:
    case 504:
      return withDetail(
        tr('{action}: the Portal server isn’t responding right now. Try again in a minute.', {
          action
        })
      )
  }
  return withDetail(tr('{action} (error {status})', { action, status }))
}

/** Which EB code a Portal HTTP status gets. */
export function portalFailureCode(status: number): AppErrorCode {
  if (status === 401 || status === 403) return 'EB-1004'
  if (status === 413) return 'EB-1005'
  if (status === 502 || status === 503 || status === 504) return 'EB-1006'
  return 'EB-1008'
}

export async function portalFailure(action: string, res: Response): Promise<AppError> {
  return new AppError(
    portalFailureCode(res.status),
    describePortalFailure(action, res.status, await res.text().catch(() => ''))
  )
}

/** fetch() for the Portal: a failure to connect at all (offline, wrong address, server
 * down, blocked) becomes EB-1003 in plain words instead of "fetch failed". */
export async function portalFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (err) {
    if ((err as Error)?.name === 'AbortError' || (err as Error)?.name === 'TimeoutError') {
      throw new AppError(
        'EB-1003',
        tr('The Portal took too long to answer. Check the internet connection and try again.')
      )
    }
    throw new AppError(
      'EB-1003',
      tr(
        'Couldn’t reach the Portal. Check the internet connection and the Portal address in Settings.'
      )
    )
  }
}
