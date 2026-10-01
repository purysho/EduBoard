import { isSafeExternalUrl } from '@shared/externalUrl'

export const APP_WINDOW_WEB_PREFERENCES = {
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true
} as const

export type NavigationDecision = 'allow' | 'external' | 'deny'

/** A renderer-triggered reload may revisit the exact app document. Hash changes are
 * same-document navigation and do not reach will-navigate, so hashes are deliberately
 * ignored here. No other file/path/origin is considered part of the current document. */
export function isSameAppDocument(currentUrl: string, targetUrl: string): boolean {
  try {
    const current = new URL(currentUrl)
    const target = new URL(targetUrl)
    return (
      current.protocol === target.protocol &&
      current.host === target.host &&
      current.pathname === target.pathname &&
      current.search === target.search
    )
  } catch {
    return false
  }
}

export function navigationDecision(currentUrl: string, targetUrl: string): NavigationDecision {
  if (isSameAppDocument(currentUrl, targetUrl)) return 'allow'
  if (isSafeExternalUrl(targetUrl)) return 'external'
  return 'deny'
}
